import crypto from 'node:crypto';

/**
 * Hachage des mots de passe, avec `scrypt` de `node:crypto`.
 *
 * ## Pourquoi scrypt et pas argon2 ou bcrypt
 *
 * Les deux sont d'excellents choix, et tous deux imposent une dépendance
 * native — donc une compilation à l'installation, une image Docker plus
 * lourde, et une chose de plus à réparer le jour où Node change de version.
 * `scrypt` est dans la bibliothèque standard de Node, il est conçu pour cet
 * usage précis, et il est recommandé par l'OWASP au même titre que les deux
 * autres. Sur un projet sans ORM et à sept dépendances, c'est le bon compromis.
 *
 * ## Le format stocké
 *
 * `scrypt$N$r$p$sel$empreinte` — le coût voyage **avec** l'empreinte. C'est ce
 * qui permettra de relever `N` dans dix ans sans invalider les mots de passe
 * déjà en base : les anciens continuent d'être vérifiés avec leurs propres
 * paramètres, et `doitEtreRehache` signale ceux à recalculer à la prochaine
 * connexion réussie.
 */

/**
 * 2^15, soit 32 Mio de mémoire et quelques dizaines de millisecondes par
 * calcul.
 *
 * C'est **en deçà** du 2^17 que recommande l'OWASP, et c'est un choix contraint :
 * `scrypt` réserve `128 · N · r` octets par calcul, donc 128 Mio à 2^17. La
 * machine Fly en a 512 en tout, Next en occupe déjà une bonne part, et deux
 * connexions simultanées suffiraient à la mettre à genoux — un serveur qui
 * tombe protège très mal.
 *
 * Le format porte ses paramètres : le jour où la machine grandit, relever `N`
 * ici suffit, `doitEtreRehache` s'occupe du reste à la connexion suivante.
 */
const N = 32768;
const R = 8;
const P = 1;
const LONGUEUR = 32;

/**
 * Le plafond par défaut de Node est de 32 Mio, soit exactement ce que demande
 * `128 · N · r` : sans marge, le calcul échoue en
 * `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`. On laisse de quoi relever `N` d'un cran
 * sans avoir à retoucher cette ligne.
 */
const MEMOIRE_MAX = 160 * 1024 * 1024;

function deriver(
  motDePasse: string,
  sel: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    crypto.scrypt(
      // Normalisation Unicode : « é » saisi sur un clavier Mac et « é » composé
      // sur un clavier Windows sont deux suites d'octets différentes pour le
      // même caractère. Sans NFKC, un mot de passe accentué ne se retape pas
      // d'une machine à l'autre.
      motDePasse.normalize('NFKC'),
      sel,
      LONGUEUR,
      { N: n, r, p, maxmem: MEMOIRE_MAX },
      (erreur, cle) => (erreur ? rejeter(erreur) : resoudre(cle)),
    );
  });
}

export async function hacher(motDePasse: string): Promise<string> {
  const sel = crypto.randomBytes(16);
  const empreinte = await deriver(motDePasse, sel, N, R, P);
  return ['scrypt', N, R, P, sel.toString('base64'), empreinte.toString('base64')].join('$');
}

/**
 * Vérifie un mot de passe contre une empreinte stockée.
 *
 * La comparaison est faite par `timingSafeEqual` : comparer deux empreintes
 * avec `===` s'arrête au premier octet différent, et ce temps de réponse
 * variable se mesure.
 */
export async function verifier(motDePasse: string, stocke: string): Promise<boolean> {
  const [algo, n, r, p, sel, empreinte] = stocke.split('$');
  if (algo !== 'scrypt' || !sel || !empreinte) return false;

  const attendu = Buffer.from(empreinte, 'base64');
  let calcule: Buffer;
  try {
    calcule = await deriver(motDePasse, Buffer.from(sel, 'base64'), Number(n), Number(r), Number(p));
  } catch {
    // Paramètres illisibles ou hors des bornes acceptées : l'empreinte est
    // inutilisable, pas valide.
    return false;
  }

  return attendu.length === calcule.length && crypto.timingSafeEqual(attendu, calcule);
}

/** L'empreinte a-t-elle été calculée avec un coût inférieur à celui d'aujourd'hui ? */
export function doitEtreRehache(stocke: string): boolean {
  const [algo, n, r, p] = stocke.split('$');
  return algo !== 'scrypt' || Number(n) < N || Number(r) < R || Number(p) < P;
}

/**
 * Empreinte de rechange, utilisée quand l'adresse saisie ne correspond à
 * personne — ou à quelqu'un qui n'a pas de mot de passe.
 *
 * Sans elle, la réponse revient instantanément dans ce cas et après ~100 ms de
 * scrypt dans l'autre : l'écart suffit à égrener des adresses pour savoir
 * lesquelles font partie du foyer. On dépense donc le même temps pour rien.
 *
 * Calculée une seule fois, à la demande : c'est le coût d'un hachage au
 * premier échec, pas au démarrage du serveur.
 */
let leurre: Promise<string> | null = null;

export function empreinteLeurre(): Promise<string> {
  leurre ??= hacher(crypto.randomBytes(32).toString('base64'));
  return leurre;
}

/**
 * Exigences de saisie.
 *
 * Une longueur minimale et rien d'autre — pas de majuscule obligatoire, pas de
 * chiffre imposé. Ces règles produisent `Motdepasse1!` et une note collée sous
 * le clavier ; la longueur, elle, est la seule contrainte qui augmente
 * réellement le coût d'une attaque. C'est aussi la position de l'OWASP et de
 * l'ANSSI depuis qu'elles ont cessé de recommander la complexité.
 */
export const LONGUEUR_MINIMALE = 10;

export function refus(motDePasse: string): string | null {
  if (motDePasse.length < LONGUEUR_MINIMALE) {
    return `Il faut au moins ${LONGUEUR_MINIMALE} caractères. Une phrase courte fait très bien l’affaire.`;
  }
  if (motDePasse.length > 200) return 'C’est trop long (200 caractères au maximum).';
  return null;
}
