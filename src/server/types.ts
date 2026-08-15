/**
 * Types du domaine.
 *
 * Ils décalquent les tables de `schema.sql` sans couche de traduction : le
 * `store` renvoie directement ces objets. Une seule règle, tenue partout — les
 * colonnes `timestamptz` deviennent des `Date`, les colonnes `date` restent des
 * chaînes `AAAA-MM-JJ`. Convertir un jour de calendrier en `Date` réintroduit
 * un fuseau là où il n'y en a pas, et fait basculer « mardi » sur « lundi 23 h ».
 */

export type Role = 'aidant' | 'senior';

export const CATEGORIES_DOCUMENT = [
  'sante',
  'administratif',
  'finances',
  'logement',
  'assurance',
  'autre',
] as const;
export type CategorieDocument = (typeof CATEGORIES_DOCUMENT)[number];

export const LIBELLES_CATEGORIE_DOCUMENT: Record<CategorieDocument, string> = {
  sante: 'Santé',
  administratif: 'Administratif',
  finances: 'Finances',
  logement: 'Logement',
  assurance: 'Assurance',
  autre: 'Autre',
};

export const CATEGORIES_EVENEMENT = [
  'medical',
  'visite',
  'aide',
  'administratif',
  'autre',
] as const;
export type CategorieEvenement = (typeof CATEGORIES_EVENEMENT)[number];

export const LIBELLES_CATEGORIE_EVENEMENT: Record<CategorieEvenement, string> = {
  medical: 'Rendez-vous médical',
  visite: 'Visite',
  aide: 'Passage d’une aide',
  administratif: 'Démarche',
  autre: 'Autre',
};

/**
 * L'ordre de ce tableau est celui de l'affichage du répertoire — pas un ordre
 * alphabétique, un ordre d'urgence. Qui ouvre cette page pendant que quelque
 * chose se passe doit trouver le premier numéro utile en haut de l'écran.
 */
export const CATEGORIES_CONTACT = [
  'urgence',
  'medecin',
  'specialiste',
  'pharmacie',
  'soins',
  'aide',
  'famille',
  'autre',
] as const;
export type CategorieContact = (typeof CATEGORIES_CONTACT)[number];

export const LIBELLES_CATEGORIE_CONTACT: Record<CategorieContact, string> = {
  urgence: 'À prévenir en priorité',
  medecin: 'Médecin traitant',
  specialiste: 'Spécialiste',
  pharmacie: 'Pharmacie',
  soins: 'Infirmier, kiné',
  aide: 'Aide à domicile',
  famille: 'Famille, voisins',
  autre: 'Autre',
};

export type Priorite = 'normale' | 'haute';

export interface Foyer {
  id: string;
  nom: string;
  fuseau: string;
}

export interface Membre {
  id: string;
  foyerId: string;
  prenom: string;
  email: string;
  role: Role;
  /** Renseigné pour les seniors uniquement : c'est leur URL permanente. */
  jetonVue: string | null;
  jetonAgenda: string;
  actif: boolean;
}

/** Une pièce d'un document — sans les octets, qui ne sortent que par `stockage.ts`. */
export interface Fichier {
  id: string;
  nomFichier: string;
  typeMime: string;
  taille: number;
}

/**
 * Un document est un **dossier** : un titre, une catégorie, et une ou plusieurs
 * pièces. Le recto et le verso d'une carte Vitale, les trois pages d'une
 * ordonnance photographiées, un avis d'imposition et son annexe — les ranger
 * séparément obligerait à retrouver l'un après l'autre.
 */
export interface Document {
  id: string;
  foyerId: string;
  titre: string;
  categorie: CategorieDocument;
  notes: string | null;
  ajoutePar: string | null;
  ajouteParPrenom: string | null;
  creeLe: Date;
  fichiers: Fichier[];
}

/** Somme des pièces, pour l'affichage. */
export function tailleTotale(document: Document): number {
  return document.fichiers.reduce((somme, fichier) => somme + fichier.taille, 0);
}

/** Les images ont une vignette ; le reste s'annonce par son type. */
export function estImage(typeMime: string): boolean {
  return typeMime.startsWith('image/');
}

export interface Tache {
  id: string;
  foyerId: string;
  titre: string;
  details: string | null;
  /** Jour de calendrier `AAAA-MM-JJ`, ou `null` si la tâche n'a pas de date. */
  echeance: string | null;
  priorite: Priorite;
  assigneeId: string | null;
  assigneePrenom: string | null;
  faiteLe: Date | null;
  faitePar: string | null;
  faiteParPrenom: string | null;
  creeLe: Date;
}

export interface Evenement {
  id: string;
  foyerId: string;
  titre: string;
  categorie: CategorieEvenement;
  lieu: string | null;
  notes: string | null;
  debut: Date;
  fin: Date;
  journeeEntiere: boolean;
  creeLe: Date;
  majLe: Date;
}

/**
 * Une entrée du répertoire. Le numéro est conservé **tel qu'il a été saisi** —
 * `01 42 86 12 34` se relit à voix haute, `0142861234` se déchiffre.
 */
export interface Contact {
  id: string;
  foyerId: string;
  nom: string;
  categorie: CategorieContact;
  telephone: string;
  email: string | null;
  adresse: string | null;
  notes: string | null;
  creeLe: Date;
  majLe: Date;
}

/**
 * Le `href` d'un lien `tel:`, qui lui n'accepte pas la mise en forme.
 *
 * Le `+` initial est conservé — sans lui, un numéro international composé
 * depuis un mobile français n'aboutit pas. Les autres séparateurs (espaces,
 * points, parenthèses de l'indicatif) tombent, ainsi que tout ce qui n'est pas
 * un chiffre : `*` et `#` n'ont pas leur place dans un numéro à appeler et
 * ouvriraient la porte à une injection dans l'URL.
 */
export function lienTelephone(numero: string): string {
  const nettoye = numero.trim();
  const signe = nettoye.startsWith('+') ? '+' : '';
  return `tel:${signe}${nettoye.replace(/\D/g, '')}`;
}

export interface EntreeJournal {
  id: string;
  membreId: string | null;
  membrePrenom: string | null;
  action: string;
  cible: string | null;
  le: Date;
}
