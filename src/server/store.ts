import { exec, nouvelId, q, q1 } from './db';
import { CATEGORIES_CONTACT } from './types';
import type {
  CategorieContact,
  CategorieDocument,
  CategorieEvenement,
  Contact,
  Document,
  EntreeJournal,
  Evenement,
  Foyer,
  Membre,
  Priorite,
  Role,
  Tache,
} from './types';

/**
 * Toutes les requêtes SQL de l'application, une fonction par intention.
 *
 * Aucune requête n'est construite ailleurs : les pages et les actions parlent
 * de « tâches en retard », pas de `select ... where`. C'est ce qui rend le jour
 * du changement de schéma supportable, et ce qui garantit qu'aucun `foyer_id`
 * n'est oublié dans un `where` — l'isolation du foyer est ici, à un seul endroit.
 *
 * Les colonnes `bigint` (`taille`, `journal.id`) reviennent du driver `pg` sous
 * forme de chaînes : c'est volontaire de sa part, un `int8` déborde le `number`
 * de JavaScript. On convertit explicitement là où l'on sait que la valeur est
 * petite.
 */

/* ── Foyer ──────────────────────────────────────────────────────────────── */

interface LigneFoyer {
  id: string;
  nom: string;
  fuseau: string;
}

/**
 * Le foyer de cette instance. Une installation en accompagne un seul : plutôt
 * que de traîner un identifiant dans toutes les signatures, on le lit ici.
 */
export async function foyer(): Promise<Foyer> {
  const ligne = await q1<LigneFoyer>('select id, nom, fuseau from foyer order by cree_le limit 1');
  if (!ligne) {
    throw new Error(
      'Aucun foyer en base. Lancez `pnpm db:inviter` pour créer le foyer et le premier aidant.',
    );
  }
  return ligne;
}

export async function creerFoyer(nom: string): Promise<Foyer> {
  const id = nouvelId();
  await exec('insert into foyer (id, nom) values ($1, $2)', [id, nom]);
  return { id, nom, fuseau: 'Europe/Paris' };
}

/* ── Membres ────────────────────────────────────────────────────────────── */

interface LigneMembre {
  id: string;
  foyer_id: string;
  prenom: string;
  email: string;
  role: Role;
  jeton_vue: string | null;
  jeton_agenda: string;
  actif: boolean;
}

function versMembre(ligne: LigneMembre): Membre {
  return {
    id: ligne.id,
    foyerId: ligne.foyer_id,
    prenom: ligne.prenom,
    email: ligne.email,
    role: ligne.role,
    jetonVue: ligne.jeton_vue,
    jetonAgenda: ligne.jeton_agenda,
    actif: ligne.actif,
  };
}

const COLONNES_MEMBRE = 'id, foyer_id, prenom, email, role, jeton_vue, jeton_agenda, actif';

export async function membres(foyerId: string): Promise<Membre[]> {
  const lignes = await q<LigneMembre>(
    `select ${COLONNES_MEMBRE} from membre
      where foyer_id = $1 and actif
      order by role, prenom`,
    [foyerId],
  );
  return lignes.map(versMembre);
}

export async function membreParId(id: string): Promise<Membre | null> {
  const ligne = await q1<LigneMembre>(
    `select ${COLONNES_MEMBRE} from membre where id = $1 and actif`,
    [id],
  );
  return ligne ? versMembre(ligne) : null;
}

export async function membreParEmail(email: string): Promise<Membre | null> {
  const ligne = await q1<LigneMembre>(
    `select ${COLONNES_MEMBRE} from membre where lower(email) = lower($1) and actif`,
    [email],
  );
  return ligne ? versMembre(ligne) : null;
}

/**
 * Recherche par e-mail **sans filtrer sur `actif`**.
 *
 * Réservé au parcours d'invitation. Retirer un accès ne supprime pas la ligne
 * (les documents déposés et les tâches cochées gardent le nom de leur auteur),
 * si bien que `membreParEmail` — qui n'existe que pour la connexion et doit
 * donc ignorer les comptes retirés — ne voit plus rien, alors que l'index
 * unique sur `lower(email)`, lui, voit toujours la ligne. Sans cette fonction,
 * réinviter quelqu'un qu'on venait de retirer levait une violation de
 * contrainte 23505 au visage de l'utilisateur.
 */
export async function membreParEmailMemeInactif(email: string): Promise<Membre | null> {
  const ligne = await q1<LigneMembre>(
    `select ${COLONNES_MEMBRE} from membre where lower(email) = lower($1)`,
    [email],
  );
  return ligne ? versMembre(ligne) : null;
}

/** Rend l'accès à un membre retiré, en rafraîchissant son prénom au passage. */
export async function reactiverMembre(id: string, prenom: string): Promise<void> {
  await exec('update membre set actif = true, prenom = $2 where id = $1', [id, prenom]);
}

/** Résout le lien permanent de la personne accompagnée. */
export async function membreParJetonVue(jeton: string): Promise<Membre | null> {
  const ligne = await q1<LigneMembre>(
    `select ${COLONNES_MEMBRE} from membre where jeton_vue = $1 and actif`,
    [jeton],
  );
  return ligne ? versMembre(ligne) : null;
}

export async function membreParJetonAgenda(jeton: string): Promise<Membre | null> {
  const ligne = await q1<LigneMembre>(
    `select ${COLONNES_MEMBRE} from membre where jeton_agenda = $1 and actif`,
    [jeton],
  );
  return ligne ? versMembre(ligne) : null;
}

export async function creerMembre(entree: {
  foyerId: string;
  prenom: string;
  email: string;
  role: Role;
  jetonVue: string | null;
  jetonAgenda: string;
}): Promise<Membre> {
  const id = nouvelId();
  await exec(
    `insert into membre (id, foyer_id, prenom, email, role, jeton_vue, jeton_agenda)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      entree.foyerId,
      entree.prenom,
      entree.email,
      entree.role,
      entree.jetonVue,
      entree.jetonAgenda,
    ],
  );
  return { id, ...entree, actif: true };
}

/**
 * On désactive, on ne supprime pas : les documents déposés et les tâches
 * cochées gardent ainsi le nom de qui s'en est occupé.
 */
export async function desactiverMembre(id: string): Promise<void> {
  await exec('update membre set actif = false, jeton_vue = null where id = $1', [id]);
  // Fermer aussi les appareils déjà connectés : retirer un accès qui ne prend
  // effet qu'à la prochaine expiration de cookie n'est pas un retrait d'accès.
  await exec('delete from session where membre_id = $1', [id]);
  await exec('delete from lien_connexion where membre_id = $1', [id]);
}

export async function remplacerJetonVue(id: string, jeton: string): Promise<void> {
  await exec('update membre set jeton_vue = $2 where id = $1', [id, jeton]);
}

/* ── Documents ──────────────────────────────────────────────────────────── */

interface LigneDocument {
  id: string;
  foyer_id: string;
  titre: string;
  categorie: CategorieDocument;
  notes: string | null;
  ajoute_par: string | null;
  ajoute_par_prenom: string | null;
  cree_le: Date;
  fichiers: { id: string; nom_fichier: string; type_mime: string; taille: number }[];
}

function versDocument(ligne: LigneDocument): Document {
  return {
    id: ligne.id,
    foyerId: ligne.foyer_id,
    titre: ligne.titre,
    categorie: ligne.categorie,
    notes: ligne.notes,
    ajoutePar: ligne.ajoute_par,
    ajouteParPrenom: ligne.ajoute_par_prenom,
    creeLe: ligne.cree_le,
    fichiers: (ligne.fichiers ?? []).map((fichier) => ({
      id: fichier.id,
      nomFichier: fichier.nom_fichier,
      typeMime: fichier.type_mime,
      taille: Number(fichier.taille),
    })),
  };
}

/**
 * Les pièces sont agrégées en JSON dans la même requête.
 *
 * Une seconde requête par document (ou pire, une par document dans une boucle)
 * multiplierait les allers-retours vers Neon, qui dort entre deux visites et
 * facture chaque réveil en latence. `filter (where f.id is not null)` évite le
 * `[null]` que produirait un `json_agg` sur une jointure externe sans
 * correspondance — un document sans pièce doit rendre un tableau vide.
 */
const COLONNES_DOCUMENT = `d.id, d.foyer_id, d.titre, d.categorie, d.notes,
  d.ajoute_par, m.prenom as ajoute_par_prenom, d.cree_le,
  coalesce(
    json_agg(
      json_build_object('id', f.id, 'nom_fichier', f.nom_fichier,
                        'type_mime', f.type_mime, 'taille', f.taille)
      order by f.ordre, f.cree_le
    ) filter (where f.id is not null),
    '[]'::json
  ) as fichiers`;

const JOINTURES_DOCUMENT = `from document d
  left join membre m on m.id = d.ajoute_par
  left join fichier f on f.document_id = d.id`;

const GROUPE_DOCUMENT = `group by d.id, m.prenom`;

export async function documents(
  foyerId: string,
  filtre: { categorie?: CategorieDocument; recherche?: string; limite?: number } = {},
): Promise<Document[]> {
  const conditions = ['d.foyer_id = $1'];
  const valeurs: unknown[] = [foyerId];

  if (filtre.categorie) {
    valeurs.push(filtre.categorie);
    conditions.push(`d.categorie = $${valeurs.length}`);
  }
  if (filtre.recherche?.trim()) {
    valeurs.push(`%${filtre.recherche.trim()}%`);
    // La recherche porte aussi sur les notes et sur le nom des pièces : on
    // cherche « mutuelle » sans se souvenir du titre exact qu'on avait donné.
    conditions.push(
      `(d.titre ilike $${valeurs.length}
        or d.notes ilike $${valeurs.length}
        or exists (select 1 from fichier fx
                    where fx.document_id = d.id
                      and fx.nom_fichier ilike $${valeurs.length}))`,
    );
  }

  const limite = filtre.limite ? `limit ${Number(filtre.limite)}` : '';
  const lignes = await q<LigneDocument>(
    `select ${COLONNES_DOCUMENT} ${JOINTURES_DOCUMENT}
      where ${conditions.join(' and ')}
      ${GROUPE_DOCUMENT}
      order by d.cree_le desc ${limite}`,
    valeurs,
  );
  return lignes.map(versDocument);
}

export async function documentParId(id: string, foyerId: string): Promise<Document | null> {
  const ligne = await q1<LigneDocument>(
    `select ${COLONNES_DOCUMENT} ${JOINTURES_DOCUMENT}
      where d.id = $1 and d.foyer_id = $2
      ${GROUPE_DOCUMENT}`,
    [id, foyerId],
  );
  return ligne ? versDocument(ligne) : null;
}

/** Crée le dossier, sans aucune pièce. Les fichiers suivent. */
export async function insererDocument(entree: {
  foyerId: string;
  titre: string;
  categorie: CategorieDocument;
  notes: string | null;
  ajoutePar: string;
}): Promise<string> {
  const id = nouvelId();
  await exec(
    `insert into document (id, foyer_id, titre, categorie, notes, ajoute_par)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, entree.foyerId, entree.titre, entree.categorie, entree.notes, entree.ajoutePar],
  );
  return id;
}

export async function modifierDocument(
  id: string,
  foyerId: string,
  entree: { titre: string; categorie: CategorieDocument; notes: string | null },
): Promise<void> {
  await exec(
    `update document set titre = $3, categorie = $4, notes = $5
      where id = $1 and foyer_id = $2`,
    [id, foyerId, entree.titre, entree.categorie, entree.notes],
  );
}

/** Ajoute une pièce à un dossier. `ordre` la place après les précédentes. */
export async function insererFichier(entree: {
  documentId: string;
  nomFichier: string;
  typeMime: string;
  taille: number;
  /** Clé de l'objet dans le stockage ; les octets ne passent jamais par ici. */
  cle: string;
  ordre: number;
}): Promise<string> {
  const id = nouvelId();
  await exec(
    `insert into fichier (id, document_id, nom_fichier, type_mime, taille, cle, ordre)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      entree.documentId,
      entree.nomFichier,
      entree.typeMime,
      entree.taille,
      entree.cle,
      entree.ordre,
    ],
  );
  return id;
}

/** Rang à donner à la prochaine pièce d'un dossier. */
export async function prochainOrdre(documentId: string): Promise<number> {
  const ligne = await q1<{ suivant: number }>(
    'select coalesce(max(ordre) + 1, 0) as suivant from fichier where document_id = $1',
    [documentId],
  );
  return ligne?.suivant ?? 0;
}

/**
 * Résout une pièce, **en repassant par son dossier** pour vérifier le foyer.
 * Un identifiant de fichier seul ne donne accès à rien.
 */
export async function lireCleFichier(
  fichierId: string,
  foyerId: string,
): Promise<{ cle: string; nomFichier: string; typeMime: string } | null> {
  const ligne = await q1<{ cle: string; nom_fichier: string; type_mime: string }>(
    `select f.cle, f.nom_fichier, f.type_mime
       from fichier f join document d on d.id = f.document_id
      where f.id = $1 and d.foyer_id = $2`,
    [fichierId, foyerId],
  );
  if (!ligne) return null;
  return { cle: ligne.cle, nomFichier: ligne.nom_fichier, typeMime: ligne.type_mime };
}

/**
 * Supprime le dossier et renvoie les clés des objets à effacer. L'appelant
 * s'occupe des octets : le magasin, lui, ne les connaît pas.
 */
export async function supprimerDocument(id: string, foyerId: string): Promise<string[]> {
  const lignes = await q<{ cle: string }>(
    `delete from fichier
      where document_id in (select id from document where id = $1 and foyer_id = $2)
      returning cle`,
    [id, foyerId],
  );
  await exec('delete from document where id = $1 and foyer_id = $2', [id, foyerId]);
  return lignes.map((ligne) => ligne.cle);
}

/**
 * Retire une pièce. Renvoie `null` si elle est introuvable, ou si c'est la
 * dernière du dossier — un dossier sans pièce n'a rien à montrer, et supprimer
 * un document entier par un bouton « retirer cette pièce » serait une surprise
 * désagréable. L'interface renvoie alors vers la suppression du document.
 */
export async function supprimerFichier(
  fichierId: string,
  foyerId: string,
): Promise<{ cle: string } | null> {
  const ligne = await q1<{ cle: string }>(
    `delete from fichier f
      using document d
      where f.id = $1
        and d.id = f.document_id
        and d.foyer_id = $2
        and (select count(*) from fichier autre where autre.document_id = d.id) > 1
      returning f.cle`,
    [fichierId, foyerId],
  );
  return ligne ? { cle: ligne.cle } : null;
}

/* ── Tâches ─────────────────────────────────────────────────────────────── */

interface LigneTache {
  id: string;
  foyer_id: string;
  titre: string;
  details: string | null;
  echeance: string | null;
  priorite: Priorite;
  assignee_id: string | null;
  assignee_prenom: string | null;
  faite_le: Date | null;
  faite_par: string | null;
  faite_par_prenom: string | null;
  cree_le: Date;
}

function versTache(ligne: LigneTache): Tache {
  return {
    id: ligne.id,
    foyerId: ligne.foyer_id,
    titre: ligne.titre,
    details: ligne.details,
    echeance: ligne.echeance,
    priorite: ligne.priorite,
    assigneeId: ligne.assignee_id,
    assigneePrenom: ligne.assignee_prenom,
    faiteLe: ligne.faite_le,
    faitePar: ligne.faite_par,
    faiteParPrenom: ligne.faite_par_prenom,
    creeLe: ligne.cree_le,
  };
}

// `to_char` plutôt que la conversion automatique du driver : `pg` transforme un
// `date` en `Date` à minuit UTC, ce qui décale l'échéance d'un jour dès qu'on
// l'affiche à Paris. On garde la chaîne `AAAA-MM-JJ` telle que Postgres la voit.
const COLONNES_TACHE = `t.id, t.foyer_id, t.titre, t.details,
  to_char(t.echeance, 'YYYY-MM-DD') as echeance,
  t.priorite, t.assignee_id, a.prenom as assignee_prenom,
  t.faite_le, t.faite_par, f.prenom as faite_par_prenom, t.cree_le`;

const JOINTURES_TACHE = `from tache t
  left join membre a on a.id = t.assignee_id
  left join membre f on f.id = t.faite_par`;

export async function taches(
  foyerId: string,
  filtre: { faites?: boolean } = {},
): Promise<Tache[]> {
  const conditions = ['t.foyer_id = $1'];
  if (filtre.faites === true) conditions.push('t.faite_le is not null');
  if (filtre.faites === false) conditions.push('t.faite_le is null');

  const lignes = await q<LigneTache>(
    `select ${COLONNES_TACHE} ${JOINTURES_TACHE}
      where ${conditions.join(' and ')}
      order by t.faite_le desc nulls first,
               t.echeance asc nulls last,
               t.priorite desc,
               t.cree_le asc`,
    [foyerId],
  );
  return lignes.map(versTache);
}

export async function tacheParId(id: string, foyerId: string): Promise<Tache | null> {
  const ligne = await q1<LigneTache>(
    `select ${COLONNES_TACHE} ${JOINTURES_TACHE} where t.id = $1 and t.foyer_id = $2`,
    [id, foyerId],
  );
  return ligne ? versTache(ligne) : null;
}

export async function insererTache(entree: {
  foyerId: string;
  titre: string;
  details: string | null;
  echeance: string | null;
  priorite: Priorite;
  assigneeId: string | null;
  creePar: string;
}): Promise<string> {
  const id = nouvelId();
  await exec(
    `insert into tache (id, foyer_id, titre, details, echeance, priorite, assignee_id, cree_par)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      entree.foyerId,
      entree.titre,
      entree.details,
      entree.echeance,
      entree.priorite,
      entree.assigneeId,
      entree.creePar,
    ],
  );
  return id;
}

export async function modifierTache(
  id: string,
  foyerId: string,
  entree: {
    titre: string;
    details: string | null;
    echeance: string | null;
    priorite: Priorite;
    assigneeId: string | null;
  },
): Promise<void> {
  await exec(
    `update tache
        set titre = $3, details = $4, echeance = $5, priorite = $6, assignee_id = $7
      where id = $1 and foyer_id = $2`,
    [
      id,
      foyerId,
      entree.titre,
      entree.details,
      entree.echeance,
      entree.priorite,
      entree.assigneeId,
    ],
  );
}

/**
 * Coche / décoche, en une requête. Le `case` évite le aller-retour
 * lire-puis-écrire, et donc la course entre deux aidants qui cliquent en même
 * temps sur la même tâche.
 */
export async function basculerTache(
  id: string,
  foyerId: string,
  membreId: string,
): Promise<boolean> {
  const ligne = await q1<{ faite_le: Date | null }>(
    `update tache
        set faite_le  = case when faite_le is null then now() else null end,
            faite_par = case when faite_le is null then $3::text else null end
      where id = $1 and foyer_id = $2
      returning faite_le`,
    [id, foyerId, membreId],
  );
  return ligne?.faite_le != null;
}

export async function supprimerTache(id: string, foyerId: string): Promise<void> {
  await exec('delete from tache where id = $1 and foyer_id = $2', [id, foyerId]);
}

/* ── Événements ─────────────────────────────────────────────────────────── */

interface LigneEvenement {
  id: string;
  foyer_id: string;
  titre: string;
  categorie: CategorieEvenement;
  lieu: string | null;
  notes: string | null;
  debut: Date;
  fin: Date;
  journee_entiere: boolean;
  cree_le: Date;
  maj_le: Date;
}

function versEvenement(ligne: LigneEvenement): Evenement {
  return {
    id: ligne.id,
    foyerId: ligne.foyer_id,
    titre: ligne.titre,
    categorie: ligne.categorie,
    lieu: ligne.lieu,
    notes: ligne.notes,
    debut: ligne.debut,
    fin: ligne.fin,
    journeeEntiere: ligne.journee_entiere,
    creeLe: ligne.cree_le,
    majLe: ligne.maj_le,
  };
}

const COLONNES_EVENEMENT = `id, foyer_id, titre, categorie, lieu, notes,
  debut, fin, journee_entiere, cree_le, maj_le`;

/** Événements qui *chevauchent* la fenêtre — pas seulement ceux qui y commencent. */
export async function evenements(
  foyerId: string,
  fenetre: { du: Date; au: Date },
): Promise<Evenement[]> {
  const lignes = await q<LigneEvenement>(
    `select ${COLONNES_EVENEMENT} from evenement
      where foyer_id = $1 and fin >= $2 and debut < $3
      order by debut asc`,
    [foyerId, fenetre.du, fenetre.au],
  );
  return lignes.map(versEvenement);
}

export async function evenementParId(id: string, foyerId: string): Promise<Evenement | null> {
  const ligne = await q1<LigneEvenement>(
    `select ${COLONNES_EVENEMENT} from evenement where id = $1 and foyer_id = $2`,
    [id, foyerId],
  );
  return ligne ? versEvenement(ligne) : null;
}

export async function insererEvenement(entree: {
  foyerId: string;
  titre: string;
  categorie: CategorieEvenement;
  lieu: string | null;
  notes: string | null;
  debut: Date;
  fin: Date;
  journeeEntiere: boolean;
  creePar: string;
}): Promise<string> {
  const id = nouvelId();
  await exec(
    `insert into evenement
       (id, foyer_id, titre, categorie, lieu, notes, debut, fin, journee_entiere, cree_par)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      entree.foyerId,
      entree.titre,
      entree.categorie,
      entree.lieu,
      entree.notes,
      entree.debut,
      entree.fin,
      entree.journeeEntiere,
      entree.creePar,
    ],
  );
  return id;
}

export async function modifierEvenement(
  id: string,
  foyerId: string,
  entree: {
    titre: string;
    categorie: CategorieEvenement;
    lieu: string | null;
    notes: string | null;
    debut: Date;
    fin: Date;
    journeeEntiere: boolean;
  },
): Promise<void> {
  await exec(
    `update evenement
        set titre = $3, categorie = $4, lieu = $5, notes = $6,
            debut = $7, fin = $8, journee_entiere = $9, maj_le = now()
      where id = $1 and foyer_id = $2`,
    [
      id,
      foyerId,
      entree.titre,
      entree.categorie,
      entree.lieu,
      entree.notes,
      entree.debut,
      entree.fin,
      entree.journeeEntiere,
    ],
  );
}

export async function supprimerEvenement(id: string, foyerId: string): Promise<void> {
  await exec('delete from evenement where id = $1 and foyer_id = $2', [id, foyerId]);
}

/* ── Mots de passe ──────────────────────────────────────────────────────── */

/**
 * L'empreinte d'un membre, cherchée par adresse.
 *
 * Elle n'est **jamais** portée par l'objet `Membre` : celui-ci circule dans
 * toutes les pages et jusque dans les composants clients, une empreinte n'a
 * rien à y faire. Elle ne sort que par cette fonction, appelée d'un seul
 * endroit — l'action de connexion.
 */
export async function empreinteMotDePasse(
  email: string,
): Promise<{ membreId: string; empreinte: string } | null> {
  const ligne = await q1<{ id: string; mot_de_passe: string | null }>(
    'select id, mot_de_passe from membre where lower(email) = lower($1) and actif and role = $2',
    [email, 'aidant'],
  );
  return ligne?.mot_de_passe ? { membreId: ligne.id, empreinte: ligne.mot_de_passe } : null;
}

export async function definirMotDePasse(membreId: string, empreinte: string): Promise<void> {
  await exec('update membre set mot_de_passe = $2, mot_de_passe_le = now() where id = $1', [
    membreId,
    empreinte,
  ]);
}

export async function retirerMotDePasse(membreId: string): Promise<void> {
  await exec('update membre set mot_de_passe = null, mot_de_passe_le = null where id = $1', [
    membreId,
  ]);
}

/** Pour la page Famille : dire « vous en avez un » sans jamais le sortir. */
export async function dateMotDePasse(membreId: string): Promise<Date | null> {
  const ligne = await q1<{ mot_de_passe_le: Date | null }>(
    'select mot_de_passe_le from membre where id = $1 and mot_de_passe is not null',
    [membreId],
  );
  return ligne?.mot_de_passe_le ?? null;
}

/* ── Freinage des essais ────────────────────────────────────────────────── */

/**
 * Combien d'échecs avant de freiner, et pour combien de temps.
 *
 * Le blocage double à chaque échec supplémentaire et plafonne à un quart
 * d'heure. Il ne ferme jamais la porte : le lien par courriel reste ouvert, ce
 * qui permet de freiner franchement sans offrir le moyen d'enfermer dehors un
 * aidant en pilonnant son adresse.
 */
const SEUIL = 5;
const PALIER_S = 30;
const PLAFOND_S = 15 * 60;

export async function essaiBloqueJusqu(cle: string): Promise<Date | null> {
  const ligne = await q1<{ bloque_jusqu: Date | null }>(
    'select bloque_jusqu from essai_connexion where cle = $1',
    [cle.toLowerCase()],
  );
  const jusqu = ligne?.bloque_jusqu ?? null;
  return jusqu && jusqu > new Date() ? jusqu : null;
}

/**
 * Compte un échec et pose le blocage s'il y a lieu, en une seule requête —
 * deux essais concurrents ne peuvent donc pas s'écraser l'un l'autre.
 *
 * Le compteur repart de zéro après une heure sans le moindre essai : sans quoi
 * quatre fautes de frappe étalées sur un an finiraient par bloquer quelqu'un
 * qui n'a rien fait de mal.
 */
export async function noterEchec(cle: string): Promise<void> {
  await exec(
    `insert into essai_connexion (cle, echecs, maj_le) values ($1, 1, now())
     on conflict (cle) do update
        set echecs = case when essai_connexion.maj_le < now() - interval '1 hour'
                          then 1 else essai_connexion.echecs + 1 end,
            maj_le = now(),
            bloque_jusqu = case
              when (case when essai_connexion.maj_le < now() - interval '1 hour'
                         then 1 else essai_connexion.echecs + 1 end) >= $2
              then now() + least(
                     $3 * power(2, (case when essai_connexion.maj_le < now() - interval '1 hour'
                                         then 1 else essai_connexion.echecs + 1 end) - $2),
                     $4
                   ) * interval '1 second'
              else null end`,
    [cle.toLowerCase(), SEUIL, PALIER_S, PLAFOND_S],
  );

  // Ménage opportuniste : la table ne sert qu'à freiner, une journée de
  // mémoire suffit largement.
  await exec("delete from essai_connexion where maj_le < now() - interval '1 day'");
}

export async function oublierEchecs(cle: string): Promise<void> {
  await exec('delete from essai_connexion where cle = $1', [cle.toLowerCase()]);
}

/* ── Contacts ───────────────────────────────────────────────────────────── */

interface LigneContact {
  id: string;
  foyer_id: string;
  nom: string;
  categorie: CategorieContact;
  telephone: string;
  email: string | null;
  adresse: string | null;
  notes: string | null;
  cree_le: Date;
  maj_le: Date;
}

function versContact(ligne: LigneContact): Contact {
  return {
    id: ligne.id,
    foyerId: ligne.foyer_id,
    nom: ligne.nom,
    categorie: ligne.categorie,
    telephone: ligne.telephone,
    email: ligne.email,
    adresse: ligne.adresse,
    notes: ligne.notes,
    creeLe: ligne.cree_le,
    majLe: ligne.maj_le,
  };
}

const COLONNES_CONTACT = `id, foyer_id, nom, categorie, telephone, email, adresse,
  notes, cree_le, maj_le`;

/**
 * Le répertoire, dans l'ordre d'urgence de `CATEGORIES_CONTACT` puis par nom.
 *
 * L'ordre des catégories est passé en paramètre plutôt que recopié en `case`
 * dans le SQL : la liste TypeScript reste la seule source, et réordonner une
 * catégorie ne peut pas laisser cette requête derrière.
 *
 * `array_position` renvoie `null` pour une valeur inconnue, que `order by`
 * placerait en tête — d'où le `nulls last`, qui garde une catégorie ajoutée en
 * base sans passer par ici en fin de liste plutôt qu'au-dessus des urgences.
 */
export async function contacts(foyerId: string): Promise<Contact[]> {
  const lignes = await q<LigneContact>(
    `select ${COLONNES_CONTACT} from contact
      where foyer_id = $1
      order by array_position($2::text[], categorie) nulls last, lower(nom)`,
    [foyerId, [...CATEGORIES_CONTACT]],
  );
  return lignes.map(versContact);
}

export async function contactParId(id: string, foyerId: string): Promise<Contact | null> {
  const ligne = await q1<LigneContact>(
    `select ${COLONNES_CONTACT} from contact where id = $1 and foyer_id = $2`,
    [id, foyerId],
  );
  return ligne ? versContact(ligne) : null;
}

export async function insererContact(entree: {
  foyerId: string;
  nom: string;
  categorie: CategorieContact;
  telephone: string;
  email: string | null;
  adresse: string | null;
  notes: string | null;
  creePar: string;
}): Promise<string> {
  const id = nouvelId();
  await exec(
    `insert into contact (id, foyer_id, nom, categorie, telephone, email, adresse,
                          notes, cree_par)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      entree.foyerId,
      entree.nom,
      entree.categorie,
      entree.telephone,
      entree.email,
      entree.adresse,
      entree.notes,
      entree.creePar,
    ],
  );
  return id;
}

export async function modifierContact(
  id: string,
  foyerId: string,
  entree: {
    nom: string;
    categorie: CategorieContact;
    telephone: string;
    email: string | null;
    adresse: string | null;
    notes: string | null;
  },
): Promise<void> {
  await exec(
    `update contact
        set nom = $3, categorie = $4, telephone = $5, email = $6, adresse = $7,
            notes = $8, maj_le = now()
      where id = $1 and foyer_id = $2`,
    [
      id,
      foyerId,
      entree.nom,
      entree.categorie,
      entree.telephone,
      entree.email,
      entree.adresse,
      entree.notes,
    ],
  );
}

export async function supprimerContact(id: string, foyerId: string): Promise<void> {
  await exec('delete from contact where id = $1 and foyer_id = $2', [id, foyerId]);
}

/* ── Sessions ───────────────────────────────────────────────────────────── */

export interface SessionOuverte {
  id: string;
  appareil: string | null;
  creeLe: Date;
  vuLe: Date;
}

export async function creerSession(entree: {
  jetonHash: string;
  membreId: string;
  appareil: string | null;
  expireLe: Date;
}): Promise<string> {
  const id = nouvelId();
  await exec(
    `insert into session (id, jeton_hash, membre_id, appareil, expire_le)
     values ($1, $2, $3, $4, $5)`,
    [id, entree.jetonHash, entree.membreId, entree.appareil, entree.expireLe],
  );
  return id;
}

/**
 * Résout une session **et** son membre en une seule requête.
 *
 * Appelée à chaque affichage de page : deux allers-retours vers Neon, qui dort
 * entre deux visites, se paieraient en latence à chaque navigation. `vu_le` est
 * renvoyé pour que l'appelant décide s'il vaut la peine d'écrire.
 */
export async function sessionActive(jetonHash: string): Promise<{
  sessionId: string;
  vuLe: Date;
  membre: Membre;
} | null> {
  const ligne = await q1<LigneMembre & { session_id: string; vu_le: Date }>(
    `select s.id as session_id, s.vu_le,
            m.id, m.foyer_id, m.prenom, m.email, m.role,
            m.jeton_vue, m.jeton_agenda, m.actif
       from session s join membre m on m.id = s.membre_id
      where s.jeton_hash = $1 and s.expire_le > now() and m.actif`,
    [jetonHash],
  );
  if (!ligne) return null;
  return { sessionId: ligne.session_id, vuLe: ligne.vu_le, membre: versMembre(ligne) };
}

/** Fait glisser l'échéance : c'est ce qui évite de déconnecter un habitué. */
export async function prolongerSession(sessionId: string, expireLe: Date): Promise<void> {
  await exec('update session set vu_le = now(), expire_le = $2 where id = $1', [
    sessionId,
    expireLe,
  ]);
}

export async function supprimerSessionParJeton(jetonHash: string): Promise<void> {
  await exec('delete from session where jeton_hash = $1', [jetonHash]);
}

/** Révocation d'un appareil depuis la page Famille. */
export async function supprimerSession(id: string, membreId: string): Promise<void> {
  await exec('delete from session where id = $1 and membre_id = $2', [id, membreId]);
}

export async function sessionsDe(membreId: string): Promise<SessionOuverte[]> {
  const lignes = await q<{
    id: string;
    appareil: string | null;
    cree_le: Date;
    vu_le: Date;
  }>(
    `select id, appareil, cree_le, vu_le
       from session where membre_id = $1 and expire_le > now()
      order by vu_le desc`,
    [membreId],
  );
  return lignes.map((ligne) => ({
    id: ligne.id,
    appareil: ligne.appareil,
    creeLe: ligne.cree_le,
    vuLe: ligne.vu_le,
  }));
}

/** Ménage opportuniste : les sessions mortes n'ont pas à s'accumuler. */
export async function purgerSessions(): Promise<void> {
  await exec('delete from session where expire_le <= now()');
}

/* ── Journal ────────────────────────────────────────────────────────────── */

/**
 * Consigne une action. Ne lève jamais : perdre une ligne de journal est un
 * incident mineur, faire échouer le dépôt d'un document parce que le journal a
 * échoué serait absurde.
 */
export async function noter(
  foyerId: string,
  membreId: string | null,
  action: string,
  cible: string | null = null,
): Promise<void> {
  try {
    await exec('insert into journal (foyer_id, membre_id, action, cible) values ($1, $2, $3, $4)', [
      foyerId,
      membreId,
      action,
      cible,
    ]);
  } catch (erreur) {
    console.error('[proches] écriture au journal impossible :', (erreur as Error).message);
  }
}

export async function journal(foyerId: string, limite = 20): Promise<EntreeJournal[]> {
  const lignes = await q<{
    id: string;
    membre_id: string | null;
    membre_prenom: string | null;
    action: string;
    cible: string | null;
    le: Date;
  }>(
    `select j.id, j.membre_id, m.prenom as membre_prenom, j.action, j.cible, j.le
       from journal j left join membre m on m.id = j.membre_id
      where j.foyer_id = $1
      order by j.le desc
      limit $2`,
    [foyerId, limite],
  );

  return lignes.map((ligne) => ({
    id: String(ligne.id),
    membreId: ligne.membre_id,
    membrePrenom: ligne.membre_prenom,
    action: ligne.action,
    cible: ligne.cible,
    le: ligne.le,
  }));
}
