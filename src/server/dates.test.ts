import { describe, expect, it } from 'vitest';
import {
  ajouterJours,
  aujourdhui,
  debutDeJournee,
  ecartJours,
  etiquetteJour,
  formatJourLong,
  grouperParJour,
  instantDepuisLocal,
  jourDe,
  localDepuisInstant,
  midiUtc,
} from './dates';

describe('jour de calendrier', () => {
  it('lit le jour parisien, pas le jour UTC', () => {
    // 23 h 30 UTC en été = 1 h 30 le lendemain à Paris.
    expect(jourDe(new Date('2026-08-08T23:30:00Z'))).toBe('2026-08-09');
    // 23 h 30 UTC en hiver = 0 h 30 le lendemain à Paris.
    expect(jourDe(new Date('2026-01-08T23:30:00Z'))).toBe('2026-01-09');
    expect(jourDe(new Date('2026-01-08T22:30:00Z'))).toBe('2026-01-08');
  });

  it('avance et recule sans dériver aux changements d’heure', () => {
    // Passage à l'heure d'été 2026 : nuit du 28 au 29 mars.
    expect(ajouterJours('2026-03-28', 1)).toBe('2026-03-29');
    expect(ajouterJours('2026-03-29', 1)).toBe('2026-03-30');
    // Passage à l'heure d'hiver 2026 : nuit du 24 au 25 octobre.
    expect(ajouterJours('2026-10-24', 1)).toBe('2026-10-25');
    expect(ajouterJours('2026-01-01', -1)).toBe('2025-12-31');
    expect(ajouterJours('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('compte les écarts en jours entiers', () => {
    expect(ecartJours('2026-08-08', '2026-08-08')).toBe(0);
    expect(ecartJours('2026-08-08', '2026-08-11')).toBe(3);
    expect(ecartJours('2026-08-08', '2026-08-05')).toBe(-3);
    // Traverse un changement d'heure : toujours des jours pleins.
    expect(ecartJours('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('heure murale parisienne', () => {
  it('convertit une saisie datetime-local en instant UTC, été comme hiver', () => {
    // Été : Paris = UTC+2.
    expect(instantDepuisLocal('2026-08-08T14:30').toISOString()).toBe('2026-08-08T12:30:00.000Z');
    // Hiver : Paris = UTC+1.
    expect(instantDepuisLocal('2026-01-08T14:30').toISOString()).toBe('2026-01-08T13:30:00.000Z');
  });

  it('fait l’aller-retour sans perte', () => {
    for (const local of ['2026-08-08T14:30', '2026-01-08T09:05', '2026-12-31T23:59']) {
      expect(localDepuisInstant(instantDepuisLocal(local))).toBe(local);
    }
  });

  it('tient la nuit du changement d’heure', () => {
    // 29 mars 2026, 2 h n'existe pas à Paris : l'horloge saute de 2 h à 3 h.
    // On n'exige pas un choix particulier, seulement de rester cohérent et de
    // ne jamais renvoyer une date invalide.
    const saut = instantDepuisLocal('2026-03-29T02:30');
    expect(Number.isNaN(saut.getTime())).toBe(false);

    // Avant et après la bascule, le décalage est bien différent.
    expect(instantDepuisLocal('2026-03-29T01:00').toISOString()).toBe('2026-03-29T00:00:00.000Z');
    expect(instantDepuisLocal('2026-03-29T04:00').toISOString()).toBe('2026-03-29T02:00:00.000Z');
  });
});

describe('bornes de journée', () => {
  it('commence à minuit à Paris, pas à midi UTC', () => {
    // Été : minuit à Paris = 22 h UTC la veille.
    expect(debutDeJournee('2026-08-08').toISOString()).toBe('2026-08-07T22:00:00.000Z');
    // Hiver : 23 h UTC la veille.
    expect(debutDeJournee('2026-01-08').toISOString()).toBe('2026-01-07T23:00:00.000Z');
  });

  it('encadre un rendez-vous du matin — la régression qui effaçait la matinée', () => {
    // `evenements()` filtre `fin >= du and debut < au`. Un rendez-vous de 9 h
    // à 10 h vaut 07:00–08:00 UTC en été : avec `midiUtc` comme borne basse
    // (12:00 UTC) il tombait hors de la fenêtre et disparaissait de l'écran.
    const debutRdv = instantDepuisLocal('2026-08-08T09:00');
    const finRdv = instantDepuisLocal('2026-08-08T10:00');

    const du = debutDeJournee('2026-08-08');
    const au = debutDeJournee(ajouterJours('2026-08-08', 1));

    expect(finRdv >= du).toBe(true);
    expect(debutRdv < au).toBe(true);

    // Et la démonstration du bug d'origine, pour qu'on ne le réintroduise pas.
    expect(finRdv >= midiUtc('2026-08-08')).toBe(false);
  });

  it('encadre aussi le dernier rendez-vous du soir', () => {
    const debutRdv = instantDepuisLocal('2026-08-08T23:30');
    expect(debutRdv < debutDeJournee(ajouterJours('2026-08-08', 1))).toBe(true);
  });

  it('reste juste la nuit du changement d’heure', () => {
    // Nuit courte (23 h) : du 29 mars 00:00 au 30 mars 00:00.
    const du = debutDeJournee('2026-03-29');
    const au = debutDeJournee('2026-03-30');
    expect((au.getTime() - du.getTime()) / 3_600_000).toBe(23);

    // Nuit longue (25 h) : du 25 octobre au 26 octobre.
    const duOct = debutDeJournee('2026-10-25');
    const auOct = debutDeJournee('2026-10-26');
    expect((auOct.getTime() - duOct.getTime()) / 3_600_000).toBe(25);
  });
});

describe('affichage', () => {
  it('écrit les jours en toutes lettres', () => {
    expect(formatJourLong('2026-08-08')).toBe('samedi 8 août');
  });

  it('préfère les repères relatifs aux dates', () => {
    const reference = '2026-08-08';
    expect(etiquetteJour('2026-08-08', reference)).toBe("Aujourd'hui");
    expect(etiquetteJour('2026-08-09', reference)).toBe('Demain');
    expect(etiquetteJour('2026-08-07', reference)).toBe('Hier');
    expect(etiquetteJour('2026-08-05', reference)).toBe('En retard de 3 jours');
    expect(etiquetteJour('2026-08-11', reference)).toBe('mardi 11 août');
  });

  it('regroupe par jour dans l’ordre chronologique', () => {
    const groupes = grouperParJour(
      [
        { j: '2026-08-09', t: 'b' },
        { j: '2026-08-08', t: 'a' },
        { j: '2026-08-09', t: 'c' },
      ],
      (e) => e.j,
    );
    expect(groupes.map((g) => g.jour)).toEqual(['2026-08-08', '2026-08-09']);
    expect(groupes[1]?.elements.map((e) => e.t)).toEqual(['b', 'c']);
  });
});

describe('aujourdhui', () => {
  it('accepte un instant de référence, pour rester testable', () => {
    expect(aujourdhui(new Date('2026-08-08T10:00:00Z'))).toBe('2026-08-08');
  });
});
