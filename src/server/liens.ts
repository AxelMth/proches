import crypto from 'node:crypto';
import { exec, q1 } from './db';

/**
 * Liens magiques : se connecter en cliquant un lien reçu par courriel, sans
 * mot de passe.
 *
 * Le jeton envoyé n'existe nulle part en base : on n'y range que son SHA-256.
 * Une fuite de la base ne donne donc aucun moyen de se connecter — c'est la
 * même raison qui fait qu'on ne stocke pas les mots de passe en clair, et elle
 * vaut aussi pour un secret à usage unique.
 *
 * Usage unique : un lien qui traîne dans une boîte mail partagée ne doit pas
 * rester une porte ouverte.
 *
 * **Une heure de validité, et une confirmation explicite avant consommation.**
 * Les deux répondent au même incident : les analyseurs d'URL des messageries
 * — Microsoft Defender « Safe Links » chez Outlook, en tête — ouvrent chaque
 * lien reçu pour le vérifier. Constaté en production : un lien créé à 09:38:48,
 * consommé à 09:39:18, trente secondes plus tard, sans que personne n'ait
 * cliqué. La personne trouvait ensuite un lien « déjà utilisé ».
 *
 * D'où le découpage : ouvrir le lien (`GET`) ne consomme rien, c'est le bouton
 * de la page (`POST`) qui ouvre la session. Un analyseur suit les liens, il ne
 * soumet pas les formulaires.
 */

const DUREE_MINUTES = 60;

/** Jeton aléatoire lisible dans une URL. 32 octets = 256 bits d'entropie. */
export function jetonAleatoire(octets = 32): string {
  return crypto.randomBytes(octets).toString('base64url');
}

function empreinte(jeton: string): string {
  return crypto.createHash('sha256').update(jeton).digest('hex');
}

/** Crée un lien de connexion et renvoie le jeton **en clair**, à envoyer. */
export async function creerLienConnexion(membreId: string): Promise<string> {
  const jeton = jetonAleatoire();
  const expire = new Date(Date.now() + DUREE_MINUTES * 60 * 1000);

  await exec(
    'insert into lien_connexion (jeton_hash, membre_id, expire_le) values ($1, $2, $3)',
    [empreinte(jeton), membreId, expire],
  );

  // Ménage opportuniste : sans cela, la table grossit indéfiniment d'entrées
  // mortes. Une semaine de rétention suffit à diagnostiquer un souci d'envoi.
  await exec("delete from lien_connexion where cree_le < now() - interval '7 days'");

  return jeton;
}

export type EtatLien =
  | { statut: 'valide' | 'utilise' | 'expire'; membreId: string }
  | { statut: 'inconnu' };

/**
 * Consulte un lien **sans le consommer** — ce que fait l'ouverture de la page.
 *
 * Distinguer « déjà utilisé » d'« expiré » n'est pas cosmétique : les deux
 * appellent des explications différentes, et sans cette distinction personne ne
 * pouvait comprendre pourquoi un lien reçu à l'instant était refusé.
 */
export async function etatLien(jeton: string): Promise<EtatLien> {
  const ligne = await q1<{ membre_id: string; utilise: boolean; expire: boolean }>(
    `select membre_id,
            utilise_le is not null as utilise,
            expire_le <= now()     as expire
       from lien_connexion where jeton_hash = $1`,
    [empreinte(jeton)],
  );

  if (!ligne) return { statut: 'inconnu' };
  if (ligne.utilise) return { statut: 'utilise', membreId: ligne.membre_id };
  if (ligne.expire) return { statut: 'expire', membreId: ligne.membre_id };
  return { statut: 'valide', membreId: ligne.membre_id };
}

/**
 * Consomme un lien. Renvoie l'identifiant du membre, ou `null` si le jeton est
 * inconnu, expiré ou déjà utilisé.
 *
 * Le marquage « utilisé » se fait dans le `update` qui sélectionne : deux
 * requêtes concurrentes sur le même jeton n'en verront pas deux fois le succès.
 */
export async function consommerLien(jeton: string): Promise<string | null> {
  const ligne = await q1<{ membre_id: string }>(
    `update lien_connexion
        set utilise_le = now()
      where jeton_hash = $1 and utilise_le is null and expire_le > now()
      returning membre_id`,
    [empreinte(jeton)],
  );
  return ligne?.membre_id ?? null;
}

/**
 * URL publique de l'application. En développement on retombe sur localhost ;
 * en production, `PROCHES_URL` doit être posée, sinon les liens envoyés par
 * courriel pointeraient vers la machine de développement.
 */
export function origine(): string {
  const declaree = process.env.PROCHES_URL?.trim().replace(/\/$/, '');
  if (declaree) return declaree;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('PROCHES_URL absente : impossible de fabriquer les liens de connexion.');
  }
  return 'http://localhost:3000';
}
