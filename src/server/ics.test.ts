import { describe, expect, it } from 'vitest';
import { construireIcs } from './ics';
import type { Evenement, Tache } from './types';

const GENERE_LE = new Date('2026-08-01T09:00:00Z');

function evenement(surcharge: Partial<Evenement> = {}): Evenement {
  return {
    id: 'ev1',
    foyerId: 'f1',
    titre: 'Cardiologue',
    categorie: 'medical',
    lieu: null,
    notes: null,
    debut: new Date('2026-08-08T12:30:00Z'),
    fin: new Date('2026-08-08T13:30:00Z'),
    journeeEntiere: false,
    creeLe: GENERE_LE,
    majLe: GENERE_LE,
    ...surcharge,
  };
}

function tache(surcharge: Partial<Tache> = {}): Tache {
  return {
    id: 't1',
    foyerId: 'f1',
    titre: 'Renouveler l’ordonnance',
    details: null,
    echeance: '2026-08-10',
    priorite: 'normale',
    assigneeId: null,
    assigneePrenom: null,
    faiteLe: null,
    faitePar: null,
    faiteParPrenom: null,
    creeLe: GENERE_LE,
    ...surcharge,
  };
}

function construire(evenements: Evenement[] = [], taches: Tache[] = []): string {
  return construireIcs({
    nomCalendrier: 'Proches — Mamie',
    evenements,
    taches,
    domaine: 'proches.fly.dev',
    genereLe: GENERE_LE,
  });
}

describe('enveloppe du calendrier', () => {
  it('respecte la structure et les fins de ligne CRLF', () => {
    const ics = construire();
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0\r\n');
    // Aucun LF isolé : certains clients rejettent le flux entier.
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });
});

describe('événements', () => {
  it('écrit les instants en UTC', () => {
    const ics = construire([evenement()]);
    expect(ics).toContain('DTSTART:20260808T123000Z');
    expect(ics).toContain('DTEND:20260808T133000Z');
    expect(ics).toContain('UID:evenement-ev1@proches.fly.dev');
    expect(ics).toContain('SUMMARY:Cardiologue');
  });

  it('rend DTEND exclusif pour une journée entière', () => {
    const ics = construire([
      evenement({
        journeeEntiere: true,
        debut: new Date('2026-08-08T00:00:00Z'),
        fin: new Date('2026-08-08T00:00:00Z'),
      }),
    ]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260808');
    expect(ics).toContain('DTEND;VALUE=DATE:20260809');
  });

  it('échappe les caractères réservés', () => {
    const ics = construire([
      evenement({ titre: 'Docteur Martin; cabinet A, B', notes: 'Ligne 1\nLigne 2' }),
    ]);
    expect(ics).toContain('SUMMARY:Docteur Martin\\; cabinet A\\, B');
    expect(ics).toContain('Ligne 1\\nLigne 2');
  });

  it('reporte le lieu et la catégorie', () => {
    const ics = construire([evenement({ lieu: '12 rue des Lilas', categorie: 'visite' })]);
    expect(ics).toContain('LOCATION:12 rue des Lilas');
    expect(ics).toContain('DESCRIPTION:Visite');
  });
});

describe('tâches', () => {
  it('sort une tâche datée en journée entière, marquée disponible', () => {
    const ics = construire([], [tache({ assigneePrenom: 'Axel' })]);
    expect(ics).toContain('UID:tache-t1@proches.fly.dev');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260810');
    expect(ics).toContain('DTEND;VALUE=DATE:20260811');
    expect(ics).toContain('TRANSP:TRANSPARENT');
    expect(ics).toContain('DESCRIPTION:Pour Axel');
  });

  it('ignore les tâches sans échéance', () => {
    const ics = construire([], [tache({ echeance: null })]);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});

describe('repli des lignes longues', () => {
  it('coupe à 75 octets et poursuit avec une espace', () => {
    const ics = construire([evenement({ titre: 'A'.repeat(200) })]);
    const lignes = ics.split('\r\n');
    for (const ligne of lignes) {
      expect(Buffer.from(ligne, 'utf8').length).toBeLessThanOrEqual(75);
    }
    expect(lignes.some((l) => l.startsWith(' AAA'))).toBe(true);
  });

  it('ne coupe jamais au milieu d’un caractère accentué', () => {
    const ics = construire([evenement({ titre: 'é'.repeat(120) })]);
    for (const ligne of ics.split('\r\n')) {
      expect(ligne).not.toContain('�');
      expect(Buffer.from(ligne, 'utf8').length).toBeLessThanOrEqual(75);
    }
    // Le titre reste intact une fois les replis défaits.
    const deplie = ics.replace(/\r\n /g, '');
    expect(deplie).toContain(`SUMMARY:${'é'.repeat(120)}`);
  });
});
