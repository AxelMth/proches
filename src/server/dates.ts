/**
 * Dates et heures, toujours vues depuis Paris.
 *
 * Deux représentations coexistent dans l'application, et les confondre est la
 * source de bug la plus probable de tout le projet :
 *
 *  - un **jour de calendrier** (`AAAA-MM-JJ`) — l'échéance d'une tâche. « Pour
 *    mardi » ne dépend d'aucun fuseau ; le passer par un `Date` le fait
 *    basculer sur lundi 23 h dès qu'on est à l'est de Greenwich.
 *  - un **instant** (`Date`) — le début d'un rendez-vous. Stocké en UTC, affiché
 *    à l'heure de Paris.
 *
 * Les champs `<input type="datetime-local">` renvoient une heure murale sans
 * fuseau (`2026-08-08T14:30`) : `instantDepuisLocal` fait la conversion dans un
 * sens, `localDepuisInstant` dans l'autre. Le serveur peut tourner en UTC sur
 * Fly, jamais on ne s'appuie sur son fuseau.
 */

export const FUSEAU = 'Europe/Paris';

const CHAMPS_HORLOGE = {
  timeZone: FUSEAU,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  // `hour12: false` produit « 24 » à minuit sur certains navigateurs ;
  // `hourCycle: 'h23'` est la formulation sans surprise.
  hourCycle: 'h23',
} as const;

const horloge = new Intl.DateTimeFormat('en-GB', CHAMPS_HORLOGE);

interface Horloge {
  annee: number;
  mois: number;
  jour: number;
  heure: number;
  minute: number;
  seconde: number;
}

/** Heure murale à Paris pour un instant donné. */
function horlogeParis(instant: Date): Horloge {
  const parts = horloge.formatToParts(instant);
  const lire = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  return {
    annee: lire('year'),
    mois: lire('month'),
    jour: lire('day'),
    heure: lire('hour'),
    minute: lire('minute'),
    seconde: lire('second'),
  };
}

/** Décalage de Paris par rapport à UTC à cet instant, en millisecondes. */
function decalageParis(instant: Date): number {
  const h = horlogeParis(instant);
  const murale = Date.UTC(h.annee, h.mois - 1, h.jour, h.heure, h.minute, h.seconde);
  // On tronque à la seconde des deux côtés : `formatToParts` n'a pas les ms.
  return murale - Math.floor(instant.getTime() / 1000) * 1000;
}

function deuxChiffres(n: number): string {
  return String(n).padStart(2, '0');
}

/** Jour de calendrier `AAAA-MM-JJ` sur lequel tombe cet instant, à Paris. */
export function jourDe(instant: Date): string {
  const h = horlogeParis(instant);
  return `${h.annee}-${deuxChiffres(h.mois)}-${deuxChiffres(h.jour)}`;
}

/** Aujourd'hui, à Paris. */
export function aujourdhui(maintenant: Date = new Date()): string {
  return jourDe(maintenant);
}

/** Décale un jour de calendrier, sans jamais traverser un fuseau. */
export function ajouterJours(jour: string, n: number): string {
  const [a = 0, m = 1, j = 1] = jour.split('-').map(Number);
  // Midi UTC : un changement d'heure ne peut pas faire changer de date.
  const d = new Date(Date.UTC(a, m - 1, j + n, 12));
  return `${d.getUTCFullYear()}-${deuxChiffres(d.getUTCMonth() + 1)}-${deuxChiffres(d.getUTCDate())}`;
}

/** Nombre de jours de `depuis` (inclus) à `jusqua`, négatif si `jusqua` est passé. */
export function ecartJours(depuis: string, jusqua: string): number {
  const ms = (jour: string): number => {
    const [a = 0, m = 1, j = 1] = jour.split('-').map(Number);
    return Date.UTC(a, m - 1, j, 12);
  };
  return Math.round((ms(jusqua) - ms(depuis)) / 86_400_000);
}

/**
 * Instant correspondant à une heure murale parisienne (`2026-08-08T14:30`).
 *
 * On part de l'heure lue comme si elle était en UTC, puis on retire le décalage
 * que Paris appliquait *à cet instant-là*. Une seconde passe rattrape le cas
 * limite des nuits de changement d'heure, où la première estimation tombe du
 * mauvais côté de la bascule.
 */
export function instantDepuisLocal(local: string): Date {
  const [datePart = '', heurePart = '00:00'] = local.split('T');
  const [a = 0, m = 1, j = 1] = datePart.split('-').map(Number);
  const [h = 0, min = 0] = heurePart.split(':').map(Number);

  const naif = Date.UTC(a, m - 1, j, h, min);
  let instant = new Date(naif);
  for (let passe = 0; passe < 2; passe++) {
    instant = new Date(naif - decalageParis(instant));
  }
  return instant;
}

/** Réciproque : valeur d'un `<input type="datetime-local">` pour cet instant. */
export function localDepuisInstant(instant: Date): string {
  const h = horlogeParis(instant);
  return (
    `${h.annee}-${deuxChiffres(h.mois)}-${deuxChiffres(h.jour)}` +
    `T${deuxChiffres(h.heure)}:${deuxChiffres(h.minute)}`
  );
}

/* --------------------------------------------------------------------------
   Affichage
   -------------------------------------------------------------------------- */

const jourLong = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const jourComplet = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const jourCourt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const heureSeule = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Midi UTC du jour donné.
 *
 * C'est aussi la convention de stockage des événements « journée entière » :
 * midi UTC tombe le même jour de calendrier dans tous les fuseaux d'Europe, là
 * où minuit local bascule sur la veille en UTC et fait glisser la date d'un
 * jour dans le flux iCalendar.
 */
export function midiUtc(jour: string): Date {
  const [a = 0, m = 1, j = 1] = jour.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12));
}

const instantMidi = midiUtc;

/**
 * Premier instant d'un jour de calendrier, **à Paris**. C'est la borne basse
 * d'une fenêtre « à partir du jour J ».
 *
 * À ne surtout pas confondre avec `midiUtc`, qui est la convention de
 * *stockage* des journées entières. Prendre midi UTC comme borne basse décale
 * la fenêtre de quatorze heures en été : un rendez-vous de 9 h à Paris se
 * termine à 08:00 UTC, donc avant midi, et n'est jamais renvoyé par la requête.
 * C'est ce qui effaçait les rendez-vous du matin de la vue de la personne
 * accompagnée — sans erreur ni trace, le pire des symptômes.
 *
 * La borne haute s'écrit `debutDeJournee(jour suivant)` : l'intervalle est
 * semi-ouvert, jamais une « fin de journée » à 23:59.
 */
export function debutDeJournee(jour: string): Date {
  return instantDepuisLocal(`${jour}T00:00`);
}

/**
 * Majuscule initiale, et elle seule.
 *
 * `Intl` renvoie « samedi 8 août 2026 » tout en minuscules : correct au fil du
 * texte, pas en tête de page. La classe CSS `capitalize` ne convient pas, elle
 * capitalise *chaque* mot et produit « Samedi 8 Août 2026 », qui est une faute
 * en français.
 */
export function majuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** « samedi 8 août » */
export function formatJourLong(jour: string): string {
  return jourLong.format(instantMidi(jour));
}

/** « samedi 8 août 2026 » */
export function formatJourComplet(jour: string): string {
  return jourComplet.format(instantMidi(jour));
}

/** « sam. 8 août » */
export function formatJourCourt(jour: string): string {
  return jourCourt.format(instantMidi(jour));
}

/** « 14:30 » */
export function formatHeure(instant: Date): string {
  return heureSeule.format(instant);
}

/**
 * « à l'instant », « il y a 20 min », « il y a 3 h », puis la date.
 * Utilisé par le journal d'activité, où seule la fraîcheur compte.
 */
export function formatDepuis(instant: Date, maintenant: Date = new Date()): string {
  const minutes = Math.round((maintenant.getTime() - instant.getTime()) / 60_000);
  if (minutes < 2) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;

  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;

  const jours = ecartJours(jourDe(instant), jourDe(maintenant));
  if (jours === 1) return 'hier';
  if (jours < 7) return `il y a ${jours} jours`;
  return formatJourCourt(jourDe(instant));
}

/**
 * Étiquette relative parlante : « Aujourd'hui », « Demain », « Hier »,
 * « En retard de 3 jours », sinon la date. C'est ce qui permet de lire une
 * liste de tâches sans calculer mentalement des dates.
 */
export function etiquetteJour(jour: string, reference: string = aujourdhui()): string {
  const ecart = ecartJours(reference, jour);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return 'Demain';
  if (ecart === -1) return 'Hier';
  if (ecart < 0) return `En retard de ${-ecart} jours`;
  if (ecart < 7) return formatJourLong(jour);
  return formatJourCourt(jour);
}

/* --------------------------------------------------------------------------
   Mois — pour la grille de l'agenda
   -------------------------------------------------------------------------- */

const moisAnnee = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU,
  month: 'long',
  year: 'numeric',
});

/** Mois `AAAA-MM` auquel appartient un jour. */
export function moisDe(jour: string): string {
  return jour.slice(0, 7);
}

export function decalerMois(mois: string, n: number): string {
  const [a = 0, m = 1] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1, 12));
  return `${d.getUTCFullYear()}-${deuxChiffres(d.getUTCMonth() + 1)}`;
}

/** « août 2026 » */
export function formatMois(mois: string): string {
  const [a = 0, m = 1] = mois.split('-').map(Number);
  return moisAnnee.format(new Date(Date.UTC(a, m - 1, 1, 12)));
}

/**
 * Jours à afficher pour un mois, semaines complètes, **lundi en premier**.
 * On déborde volontairement sur les mois voisins : une grille tronquée oblige à
 * compter les cases pour retrouver le bon jour de la semaine.
 */
export function grilleDuMois(mois: string): string[] {
  const [a = 0, m = 1] = mois.split('-').map(Number);
  const premier = new Date(Date.UTC(a, m - 1, 1, 12));
  // `getUTCDay` met dimanche à 0 ; en France la semaine commence le lundi.
  const decalage = (premier.getUTCDay() + 6) % 7;
  const joursDansLeMois = new Date(Date.UTC(a, m, 0, 12)).getUTCDate();
  const cases = Math.ceil((decalage + joursDansLeMois) / 7) * 7;

  const debut = `${a}-${deuxChiffres(m)}-01`;
  return Array.from({ length: cases }, (_, i) => ajouterJours(debut, i - decalage));
}

/** Regroupe des éléments datés par jour de calendrier, dans l'ordre. */
export function grouperParJour<T>(
  elements: readonly T[],
  jourDeLElement: (element: T) => string,
): { jour: string; elements: T[] }[] {
  const paquets = new Map<string, T[]>();
  for (const element of elements) {
    const jour = jourDeLElement(element);
    const existant = paquets.get(jour);
    if (existant) existant.push(element);
    else paquets.set(jour, [element]);
  }
  return [...paquets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([jour, elements]) => ({ jour, elements }));
}
