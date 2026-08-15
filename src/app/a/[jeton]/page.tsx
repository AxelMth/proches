import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ajouterJours,
  aujourdhui,
  formatHeure,
  formatJourComplet,
  formatJourLong,
  debutDeJournee,
  jourDe,
  majuscule,
} from '@/server/dates';
import { evenements as listerEvenements, membreParJetonVue } from '@/server/store';
import type { Evenement } from '@/server/types';

export const metadata = { title: 'Aujourd’hui' };
export const dynamic = 'force-dynamic';

/**
 * La page de la personne accompagnée.
 *
 * Elle est résolue **entièrement depuis le jeton de l'URL**, sans cookie : un
 * favori posé sur l'écran d'accueil d'une tablette doit fonctionner
 * indéfiniment, y compris après un effacement des données de navigation. Le
 * jeton est régénérable depuis la page Famille le jour où l'appareil change de
 * mains.
 *
 * Trois blocs, dans cet ordre, et rien d'autre. En particulier : **pas de
 * liste de tâches**. Une liste de choses que d'autres doivent faire pour soi
 * est une source d'inquiétude, pas d'information.
 */
export default async function PageAujourdhui({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  const { jeton } = await params;
  const membre = await membreParJetonVue(jeton);
  if (!membre) notFound();

  const jour = aujourdhui();
  const demain = ajouterJours(jour, 1);

  const liste = await listerEvenements(membre.foyerId, {
    du: debutDeJournee(jour),
    au: debutDeJournee(ajouterJours(jour, 8)),
  });

  const duJour = (cible: string): Evenement[] =>
    liste.filter((evenement) => {
      const debut = jourDe(evenement.debut);
      const fin = jourDe(evenement.fin);
      return debut <= cible && cible <= fin;
    });

  const aujourdhuiListe = duJour(jour);
  const demainListe = duJour(demain);
  const plusTard = liste.filter((evenement) => jourDe(evenement.debut) > demain);

  return (
    <main id="contenu" className="space-y-10">
      <header>
        <p className="text-3xl font-bold leading-tight">{majuscule(formatJourComplet(jour))}</p>
        <p className="mt-1 text-doux">Bonjour {membre.prenom}</p>
      </header>

      <Bloc titre="Aujourd’hui" evenements={aujourdhuiListe} vide="Rien de prévu aujourd’hui." />

      <Bloc titre="Demain" evenements={demainListe} vide="Rien de prévu demain." />

      {plusTard.length > 0 ? (
        <section>
          <h2 className="mb-3 text-2xl font-bold">Cette semaine</h2>
          <ul className="space-y-4">
            {plusTard.map((evenement) => (
              <li key={evenement.id} className="carte p-5">
                <p className="font-bold">{majuscule(formatJourLong(jourDe(evenement.debut)))}</p>
                <p className="mt-1">
                  {evenement.journeeEntiere ? '' : `${formatHeure(evenement.debut)} — `}
                  {evenement.titre}
                </p>
                {evenement.lieu ? <p className="mt-1 text-doux">{evenement.lieu}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="space-y-4">
        <Link
          href={`/a/${jeton}/documents`}
          className="bouton w-full justify-center py-5 text-center"
        >
          Voir mes documents
        </Link>
        <Link
          href={`/a/${jeton}/contacts`}
          className="bouton w-full justify-center py-5 text-center"
        >
          Qui appeler
        </Link>
      </div>
    </main>
  );
}

function Bloc({
  titre,
  evenements,
  vide,
}: {
  titre: string;
  evenements: readonly Evenement[];
  vide: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-2xl font-bold">{titre}</h2>

      {evenements.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-5 py-6 text-doux">{vide}</p>
      ) : (
        <ul className="space-y-4">
          {evenements.map((evenement) => (
            <li key={evenement.id} className="carte p-5">
              <p className="text-3xl font-bold text-terre">
                {evenement.journeeEntiere ? 'Toute la journée' : formatHeure(evenement.debut)}
              </p>
              <p className="mt-1 font-semibold">{evenement.titre}</p>
              {evenement.lieu ? <p className="mt-1 text-doux">{evenement.lieu}</p> : null}
              {evenement.notes ? (
                <p className="mt-2 whitespace-pre-line text-doux">{evenement.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
