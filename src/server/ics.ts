import { ajouterJours, jourDe } from './dates';
import { LIBELLES_CATEGORIE_EVENEMENT } from './types';
import type { Evenement, Tache } from './types';

/**
 * Flux iCalendar (RFC 5545) en lecture seule.
 *
 * C'est ce qui rend l'agenda réellement partagé sans écrire de synchronisation
 * bidirectionnelle : chaque aidant colle son URL personnelle dans Google ou
 * Apple Calendar et voit les rendez-vous apparaître au milieu des siens. Les
 * modifications, elles, se font toujours dans Proches — un flux abonné est en
 * lecture seule côté client, ce qui évite d'avoir à arbitrer des conflits.
 *
 * Les tâches datées sortent en événements « journée entière » plutôt qu'en
 * `VTODO` : Google Calendar ignore purement et simplement les `VTODO` d'un
 * calendrier abonné, elles n'apparaîtraient nulle part.
 */

/** Échappement RFC 5545 §3.3.11 — l'ordre compte, la barre oblique d'abord. */
function echapper(valeur: string): string {
  return valeur
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Repli de ligne à 75 octets (RFC 5545 §3.1). On compte en **octets**, pas en
 * caractères : « é » en pèse deux, et couper au milieu d'un caractère produit
 * un flux que certains clients refusent.
 */
function plier(ligne: string): string[] {
  const octets = Buffer.from(ligne, 'utf8');
  if (octets.length <= 75) return [ligne];

  const morceaux: string[] = [];
  let debut = 0;
  let limite = 75;

  while (debut < octets.length) {
    let fin = Math.min(debut + limite, octets.length);
    // Reculer tant qu'on est sur un octet de continuation UTF-8 (10xxxxxx).
    while (fin < octets.length && (octets[fin]! & 0xc0) === 0x80) fin--;

    morceaux.push(
      (debut === 0 ? '' : ' ') + octets.subarray(debut, fin).toString('utf8'),
    );
    debut = fin;
    limite = 74; // les lignes suivantes commencent par une espace
  }
  return morceaux;
}

/** `20260808T123000Z` */
function horodatage(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

/** `20260808` — pour les valeurs de type DATE. */
function jourCompact(jour: string): string {
  return jour.replaceAll('-', '');
}

export interface FluxIcs {
  nomCalendrier: string;
  evenements: readonly Evenement[];
  taches: readonly Tache[];
  /** Domaine utilisé dans les UID, pour qu'ils soient globalement uniques. */
  domaine: string;
  /** Injectable pour les tests — sinon l'instant courant. */
  genereLe?: Date;
}

export function construireIcs(flux: FluxIcs): string {
  const maintenant = flux.genereLe ?? new Date();
  const lignes: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Proches//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${echapper(flux.nomCalendrier)}`,
    'X-WR-TIMEZONE:Europe/Paris',
    // Les abonnements sont relus périodiquement ; 1 h est le compromis usuel
    // entre fraîcheur et charge, et Google l'ignore de toute façon souvent.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const evenement of flux.evenements) {
    lignes.push('BEGIN:VEVENT');
    lignes.push(`UID:evenement-${evenement.id}@${flux.domaine}`);
    lignes.push(`DTSTAMP:${horodatage(maintenant)}`);
    lignes.push(`SUMMARY:${echapper(evenement.titre)}`);

    if (evenement.journeeEntiere) {
      // DTEND est exclusif pour une valeur DATE : un événement d'un jour finit
      // le lendemain. L'oublier fait disparaître l'événement chez certains clients.
      //
      // Le jour est lu à l'heure de Paris, pas en UTC : un événement stocké à
      // minuit local retomberait sinon sur la veille.
      const debut = jourDe(evenement.debut);
      const fin = jourDe(evenement.fin);
      lignes.push(`DTSTART;VALUE=DATE:${jourCompact(debut)}`);
      lignes.push(`DTEND;VALUE=DATE:${jourCompact(ajouterJours(fin, 1))}`);
    } else {
      lignes.push(`DTSTART:${horodatage(evenement.debut)}`);
      lignes.push(`DTEND:${horodatage(evenement.fin)}`);
    }

    if (evenement.lieu) lignes.push(`LOCATION:${echapper(evenement.lieu)}`);

    const description = [LIBELLES_CATEGORIE_EVENEMENT[evenement.categorie], evenement.notes]
      .filter(Boolean)
      .join('\n');
    if (description) lignes.push(`DESCRIPTION:${echapper(description)}`);

    lignes.push(`LAST-MODIFIED:${horodatage(evenement.majLe)}`);
    lignes.push('END:VEVENT');
  }

  for (const tache of flux.taches) {
    if (!tache.echeance) continue;

    lignes.push('BEGIN:VEVENT');
    lignes.push(`UID:tache-${tache.id}@${flux.domaine}`);
    lignes.push(`DTSTAMP:${horodatage(maintenant)}`);
    lignes.push(`SUMMARY:${echapper(`À faire : ${tache.titre}`)}`);
    lignes.push(`DTSTART;VALUE=DATE:${jourCompact(tache.echeance)}`);
    lignes.push(`DTEND;VALUE=DATE:${jourCompact(ajouterJours(tache.echeance, 1))}`);
    lignes.push('TRANSP:TRANSPARENT');

    const description = [
      tache.assigneePrenom ? `Pour ${tache.assigneePrenom}` : null,
      tache.details,
    ]
      .filter(Boolean)
      .join('\n');
    if (description) lignes.push(`DESCRIPTION:${echapper(description)}`);

    lignes.push('END:VEVENT');
  }

  lignes.push('END:VCALENDAR');

  // CRLF obligatoire, y compris en fin de flux.
  return lignes.flatMap(plier).join('\r\n') + '\r\n';
}
