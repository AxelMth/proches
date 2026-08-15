import { ajouterJours, aujourdhui, debutDeJournee } from '@/server/dates';
import { construireIcs } from '@/server/ics';
import { origine } from '@/server/liens';
import {
  evenements as listerEvenements,
  foyer as lireFoyer,
  membreParJetonAgenda,
  taches as listerTaches,
} from '@/server/store';

/**
 * Flux iCalendar personnel, en lecture seule.
 *
 * À coller dans Google Agenda (« Ajouter un agenda » → « À partir de l'URL »)
 * ou Calendrier Apple. Le jeton du chemin *est* l'authentification : c'est la
 * seule chose que ces clients savent envoyer. Il est propre à chaque membre,
 * ce qui permet de le révoquer sans couper les autres.
 *
 * Fenêtre volontairement bornée — six mois en arrière, deux ans en avant. Un
 * flux qui grossit indéfiniment finit par être tronqué côté client, sans
 * qu'aucune erreur ne le signale.
 */
export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ jeton: string }> },
): Promise<Response> {
  const { jeton } = await contexte.params;

  const membre = await membreParJetonAgenda(jeton);
  if (!membre) return new Response('Introuvable', { status: 404 });

  const jour = aujourdhui();
  const [foyer, evenements, taches] = await Promise.all([
    lireFoyer(),
    listerEvenements(membre.foyerId, {
      du: debutDeJournee(ajouterJours(jour, -180)),
      au: debutDeJournee(ajouterJours(jour, 730)),
    }),
    listerTaches(membre.foyerId, { faites: false }),
  ]);

  const ics = construireIcs({
    nomCalendrier: `Proches — ${foyer.nom}`,
    evenements,
    taches,
    domaine: new URL(origine()).hostname,
  });

  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="proches.ics"',
      // Les clients d'agenda relisent le flux d'eux-mêmes ; un cache
      // intermédiaire d'une heure suffit et évite de réveiller Neon à chaque
      // sondage d'un client un peu insistant.
      'cache-control': 'private, max-age=3600',
    },
  });
}
