import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { envoyer } from '@/server/courriel';
import {
  ajouterJours,
  aujourdhui,
  debutDeJournee,
  ecartJours,
  formatHeure,
  formatJourLong,
  jourDe,
} from '@/server/dates';
import { origine } from '@/server/liens';
import {
  evenements as listerEvenements,
  foyer as lireFoyer,
  membres as listerMembres,
  taches as listerTaches,
} from '@/server/store';

/**
 * Récapitulatif quotidien envoyé aux aidants : les rendez-vous de demain, les
 * tâches en retard.
 *
 * Déclenché de l'extérieur (machine Fly planifiée, voir le README) et protégé
 * par `PROCHES_CRON_SECRET` — sans quoi n'importe qui pourrait déclencher un
 * envoi en boucle. La comparaison est à temps constant : un secret comparé avec
 * `===` se devine caractère par caractère.
 *
 * Rien n'est envoyé s'il n'y a rien à dire. Un courriel quotidien vide est la
 * façon la plus sûre de faire filtrer tous les suivants.
 */
export async function GET(requete: NextRequest): Promise<Response> {
  const attendu = process.env.PROCHES_CRON_SECRET?.trim();
  if (!attendu) {
    return Response.json({ erreur: 'PROCHES_CRON_SECRET non configuré' }, { status: 503 });
  }

  const fourni =
    requete.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    requete.nextUrl.searchParams.get('cle') ??
    '';

  const a = Buffer.from(fourni);
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return Response.json({ erreur: 'Clé invalide' }, { status: 401 });
  }

  const jour = aujourdhui();
  const demain = ajouterJours(jour, 1);
  const foyer = await lireFoyer();

  const [evenements, taches, membres] = await Promise.all([
    listerEvenements(foyer.id, {
      du: debutDeJournee(demain),
      au: debutDeJournee(ajouterJours(demain, 1)),
    }),
    listerTaches(foyer.id, { faites: false }),
    listerMembres(foyer.id),
  ]);

  const enRetard = taches.filter(
    (tache) => tache.echeance != null && ecartJours(jour, tache.echeance) < 0,
  );
  const pourDemain = taches.filter((tache) => tache.echeance === demain);

  if (evenements.length === 0 && enRetard.length === 0 && pourDemain.length === 0) {
    return Response.json({ envoyes: 0, raison: 'rien à signaler' });
  }

  const lignes = [`Bonjour,`, ``, `Pour ${foyer.nom}, demain ${formatJourLong(demain)} :`, ``];

  if (evenements.length > 0) {
    lignes.push('Rendez-vous');
    for (const evenement of evenements) {
      const heure = evenement.journeeEntiere
        ? 'toute la journée'
        : formatHeure(evenement.debut);
      lignes.push(
        `  · ${heure} — ${evenement.titre}${evenement.lieu ? ` (${evenement.lieu})` : ''}`,
      );
    }
    lignes.push('');
  }

  if (enRetard.length > 0) {
    lignes.push('En retard');
    for (const tache of enRetard) {
      lignes.push(
        `  · ${tache.titre} — était pour le ${formatJourLong(tache.echeance ?? jour)}` +
          `${tache.assigneePrenom ? `, ${tache.assigneePrenom}` : ''}`,
      );
    }
    lignes.push('');
  }

  if (pourDemain.length > 0) {
    lignes.push('À faire demain');
    for (const tache of pourDemain) {
      lignes.push(`  · ${tache.titre}${tache.assigneePrenom ? ` — ${tache.assigneePrenom}` : ''}`);
    }
    lignes.push('');
  }

  lignes.push(origine());

  const texte = lignes.join('\n');
  const destinataires = membres.filter((membre) => membre.role === 'aidant');

  // Envois en série, pas en parallèle : le palier gratuit de Resend plafonne
  // à environ deux requêtes par seconde, et un foyer nombreux ferait prendre
  // un 429 aux derniers aidants. Quelques courriels, personne n'attend.
  let envoyes = 0;
  const echecs: string[] = [];
  for (const membre of destinataires) {
    const envoi = await envoyer({
      destinataire: membre.email,
      sujet: `${foyer.nom} — demain ${formatJourLong(demain)}`,
      texte,
    });
    if (envoi.ok) envoyes += 1;
    else echecs.push(`${membre.prenom} (${envoi.cause})`);
  }

  if (echecs.length > 0) {
    console.error('[proches] rappel non remis à :', echecs.join(', '));
  }

  return Response.json(
    { jour: jourDe(new Date()), destinataires: destinataires.length, envoyes, echecs },
    // Un rappel non remis doit être visible depuis l'extérieur : sans statut
    // d'erreur, la machine planifiée conclurait au succès sans rien envoyer.
    { status: echecs.length > 0 ? 500 : 200 },
  );
}
