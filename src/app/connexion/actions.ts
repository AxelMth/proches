'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { envoyerLienConnexion } from '@/server/courriel';
import { creerLienConnexion, origine } from '@/server/liens';
import {
  doitEtreRehache,
  empreinteLeurre,
  hacher,
  verifier,
} from '@/server/motdepasse';
import { cheminInterne } from '@/server/redirection';
import { ouvrirSession } from '@/server/session';
import {
  definirMotDePasse,
  empreinteMotDePasse,
  membreParEmail,
  oublierEchecs,
  reserverEssai,
} from '@/server/store';

export interface EtatConnexion {
  statut: 'inactif' | 'envoye' | 'erreur';
  message?: string;
}

/**
 * 254 octets, le maximum d'une adresse selon la RFC 5321.
 *
 * Ce n'est pas un raffinement : l'adresse sert de clé primaire à
 * `essai_connexion`, et un index btree de Postgres refuse une valeur de plus
 * de ~2 700 octets. Sans cette borne, une adresse absurdement longue —
 * syntaxiquement valide pour zod — faisait échouer l'insertion en 54000 et
 * répondre 500, là où tous les autres cas renvoient le même message neutre.
 */
const LONGUEUR_MAX_EMAIL = 254;

const schema = z.object({
  email: z.string().trim().email().max(LONGUEUR_MAX_EMAIL),
  // `.nullish()` et pas `.optional()` : un champ absent du formulaire ressort
  // de `FormData.get` en `null`, que `.optional()` refuse — et l'échec se
  // serait présenté à l'utilisateur comme une adresse invalide.
  suite: z.string().nullish(),
});

/**
 * Demande d'un lien de connexion.
 *
 * La réponse est **identique** que l'adresse soit connue ou non. Une page qui
 * répond « cette adresse n'existe pas » permet à n'importe qui d'apprendre qui
 * s'occupe de la personne accompagnée — sur un espace familial, c'est déjà une
 * fuite. Le seul écart : rien n'est envoyé si le membre n'existe pas.
 *
 * Il n'y a délibérément aucune création de compte ici. On entre dans un foyer
 * sur invitation d'un aidant, jamais en saisissant son adresse.
 */
export async function demanderLien(
  _precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const analyse = schema.safeParse({
    email: donnees.get('email'),
    suite: donnees.get('suite'),
  });

  if (!analyse.success) {
    return { statut: 'erreur', message: 'Cette adresse ne semble pas valide.' };
  }

  const { email, suite } = analyse.data;
  const membre = await membreParEmail(email);

  if (membre) {
    const jeton = await creerLienConnexion(membre.id);
    const url = new URL(`/connexion/${jeton}`, origine());
    // Seul un chemin interne est accepté comme destination : sans ce filtre,
    // le lien envoyé par courriel deviendrait une redirection ouverte.
    const destination = cheminInterne(suite);
    if (destination !== '/') url.searchParams.set('suite', destination);

    const envoi = await envoyerLienConnexion(membre.email, membre.prenom, url.toString());
    if (!envoi.ok) {
      // Distinguer les deux pannes : « réessayez » sur un défaut de
      // configuration fait tourner l'utilisateur en rond indéfiniment, alors
      // que seul l'exploitant peut le débloquer.
      return {
        statut: 'erreur',
        message:
          envoi.cause === 'configuration'
            ? "L'envoi de courriels est mal configuré sur ce serveur. Prévenez la personne " +
              'qui administre cet espace — réessayer n’y changera rien.'
            : "L'envoi a échoué. Réessayez dans un instant.",
      };
    }
  }

  return { statut: 'envoye' };
}

/** « 40 secondes », « 3 minutes » — jamais « 0 seconde ». */
function delai(jusqu: Date): string {
  const secondes = Math.max(1, Math.ceil((jusqu.getTime() - Date.now()) / 1000));
  if (secondes < 60) return `${secondes} seconde${secondes > 1 ? 's' : ''}`;
  const minutes = Math.ceil(secondes / 60);
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

const schemaMotDePasse = z.object({
  email: z.string().trim().email().max(LONGUEUR_MAX_EMAIL),
  motDePasse: z.string().min(1),
  suite: z.string().nullish(),
});

/**
 * Connexion par mot de passe.
 *
 * ## Un seul message d'erreur
 *
 * « Adresse ou mot de passe incorrect », quelle que soit la cause réelle —
 * adresse inconnue, compte sans mot de passe, mot de passe faux. Distinguer les
 * trois dirait à n'importe qui laquelle de ces adresses fait partie du foyer,
 * et sur un espace familial c'est déjà une fuite. Le même souci gouverne le
 * temps de réponse : quand il n'y a rien à vérifier, on vérifie quand même
 * contre une empreinte leurre, pour que les deux cas coûtent pareil.
 *
 * ## Le blocage n'enferme personne dehors
 *
 * Cinq échecs et le freinage démarre — mais uniquement sur ce chemin. Le lien
 * par courriel reste ouvert, et c'est ce qui rend le freinage tenable :
 * quelqu'un qui pilonnerait l'adresse d'un aidant ne lui coupe pas l'accès.
 */
export async function connecterAvecMotDePasse(
  _precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const analyse = schemaMotDePasse.safeParse({
    email: donnees.get('email'),
    motDePasse: donnees.get('motDePasse'),
    suite: donnees.get('suite'),
  });

  if (!analyse.success) {
    return { statut: 'erreur', message: 'Adresse ou mot de passe incorrect.' };
  }

  const { email, motDePasse, suite } = analyse.data;

  // L'essai est décompté AVANT le scrypt, pas après : c'est l'écriture qui
  // sert de garde, sinon cent requêtes simultanées passent toutes pendant les
  // dizaines de millisecondes du hachage. Une connexion réussie efface aussitôt
  // le compteur, ce qui rend l'avance sans effet pour qui connaît son mot de passe.
  const bloqueJusqu = await reserverEssai(email);
  if (bloqueJusqu) {
    return {
      statut: 'erreur',
      message:
        `Trop d’essais. Réessayez dans ${delai(bloqueJusqu)}, ou passez par ` +
        '« Recevoir un lien de connexion » — ce chemin-là reste ouvert.',
    };
  }

  const compte = await empreinteMotDePasse(email);
  const bon = await verifier(motDePasse, compte?.empreinte ?? (await empreinteLeurre()));

  if (!compte || !bon) {
    return { statut: 'erreur', message: 'Adresse ou mot de passe incorrect.' };
  }

  await oublierEchecs(email);

  // Le coût du hachage a pu être relevé depuis la dernière connexion. C'est le
  // seul instant où le mot de passe en clair est disponible pour le recalculer.
  if (doitEtreRehache(compte.empreinte)) {
    await definirMotDePasse(compte.membreId, await hacher(motDePasse));
  }

  await ouvrirSession(compte.membreId);

  // `cheminInterne` et pas un test de préfixe : le champ caché `suite` vient de
  // l'URL, et `/\exemple.fr` passerait un `startsWith('/')` pour finir résolu
  // en `https://exemple.fr/` par le navigateur.
  redirect(cheminInterne(suite));
}
