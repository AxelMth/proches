import Link from 'next/link';
import { PuceDocument, Vide } from '@/components/Puces';
import {
  ajouterJours,
  aujourdhui,
  ecartJours,
  formatDepuis,
  formatJourComplet,
  formatJourLong,
  debutDeJournee,
  jourDe,
  majuscule,
} from '@/server/dates';
import { contexteAidant } from '@/server/session';
import {
  documents as listerDocuments,
  evenements as listerEvenements,
  journal as listerJournal,
  membres as listerMembres,
  taches as listerTaches,
} from '@/server/store';
import { CarteEvenement } from './agenda/CarteEvenement';
import { LigneTache } from './taches/LigneTache';

export const dynamic = 'force-dynamic';

/**
 * Tableau de bord — la page qu'on ouvre vingt fois par semaine.
 *
 * Elle répond à une seule question, sans un clic : « qu'est-ce qui bouge ? ».
 * D'où l'ordre retenu — ce qui est en retard d'abord, ce qui arrive ensuite,
 * ce qui s'est passé en dernier.
 */
export default async function TableauDeBord() {
  const { membre, foyer } = await contexteAidant('/');
  const jour = aujourdhui();

  const [aVenir, enCours, derniers, activite, tous] = await Promise.all([
    listerEvenements(foyer.id, { du: new Date(), au: debutDeJournee(ajouterJours(jour, 8)) }),
    listerTaches(foyer.id, { faites: false }),
    listerDocuments(foyer.id, { limite: 4 }),
    listerJournal(foyer.id, 8),
    listerMembres(foyer.id),
  ]);

  // Cf. /taches : une tâche ne se confie qu'à un aidant.
  const membres = tous.filter((personne) => personne.role === 'aidant');

  const enRetard = enCours.filter(
    (tache) => tache.echeance != null && ecartJours(jour, tache.echeance) < 0,
  );
  const pourAujourdhui = enCours.filter((tache) => tache.echeance === jour);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Bonjour {membre.prenom}</h1>
        <p className="text-doux">{majuscule(formatJourComplet(jour))}</p>
      </div>

      <section className="space-y-2">
        <EnTete titre="Les prochains jours" lien="/agenda" libelleLien="Tout l’agenda" />
        {aVenir.length === 0 ? (
          <Vide>Rien de prévu d’ici une semaine.</Vide>
        ) : (
          <ul className="space-y-3">
            {regrouperParJour(aVenir).map(({ jour: jourGroupe, elements }) => (
              <li key={jourGroupe}>
                <h3 className="mb-1.5 text-sm font-bold text-doux">
                  {jourGroupe === jour ? "Aujourd'hui" : majuscule(formatJourLong(jourGroupe))}
                </h3>
                <ul className="space-y-2">
                  {elements.map((evenement) => (
                    <CarteEvenement key={evenement.id} evenement={evenement} modifiable={false} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <EnTete
          titre="À faire"
          lien="/taches"
          libelleLien={`Les ${enCours.length} en attente`}
        />
        {enRetard.length === 0 && pourAujourdhui.length === 0 ? (
          <Vide>
            {enCours.length === 0
              ? 'Rien en attente.'
              : 'Rien d’urgent aujourd’hui — le reste est daté plus tard.'}
          </Vide>
        ) : (
          <>
            {enRetard.length > 0 ? (
              <>
                <h3 className="text-sm font-bold uppercase tracking-wide text-alerte">
                  En retard · {enRetard.length}
                </h3>
                <ul className="space-y-2">
                  {enRetard.map((tache) => (
                    <LigneTache key={tache.id} tache={tache} membres={membres} compact />
                  ))}
                </ul>
              </>
            ) : null}

            {pourAujourdhui.length > 0 ? (
              <>
                <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-doux">
                  Aujourd&apos;hui · {pourAujourdhui.length}
                </h3>
                <ul className="space-y-2">
                  {pourAujourdhui.map((tache) => (
                    <LigneTache key={tache.id} tache={tache} membres={membres} compact />
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-2">
        <EnTete titre="Derniers documents" lien="/documents" libelleLien="Tous les documents" />
        {derniers.length === 0 ? (
          <Vide>Aucun document déposé pour l’instant.</Vide>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {derniers.map((document) => (
              <li key={document.id} className="carte p-3">
                <div className="flex items-start justify-between gap-2">
                  {/* Vers la première pièce : un document en a désormais
                      plusieurs, et l'ouvrir directement reste le geste utile. */}
                  <a
                    href={
                      document.fichiers[0]
                        ? `/api/fichiers/${document.fichiers[0].id}`
                        : '/documents'
                    }
                    target={document.fichiers[0] ? '_blank' : undefined}
                    rel="noreferrer"
                    className="font-semibold hover:underline"
                  >
                    {document.titre}
                  </a>
                  <PuceDocument categorie={document.categorie} />
                </div>
                <p className="mt-0.5 text-sm text-doux">
                  {document.fichiers.length > 1
                    ? `${document.fichiers.length} pièces · `
                    : ''}
                  {formatDepuis(document.creeLe)}
                  {document.ajouteParPrenom ? ` · ${document.ajouteParPrenom}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activite.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Ce qui s’est passé</h2>
          <ul className="carte divide-y px-4">
            {activite.map((entree) => (
              <li key={entree.id} className="flex flex-wrap gap-x-2 py-2 text-sm">
                <span>
                  <span className="font-semibold">{entree.membrePrenom ?? 'Quelqu’un'}</span>{' '}
                  {entree.action}
                  {entree.cible ? ` « ${entree.cible} »` : ''}
                </span>
                <span className="ml-auto shrink-0 text-doux">{formatDepuis(entree.le)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function EnTete({
  titre,
  lien,
  libelleLien,
}: {
  titre: string;
  lien: string;
  libelleLien: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-bold">{titre}</h2>
      <Link href={lien} className="lien text-sm">
        {libelleLien}
      </Link>
    </div>
  );
}

function regrouperParJour<T extends { debut: Date }>(
  liste: readonly T[],
): { jour: string; elements: T[] }[] {
  const paquets = new Map<string, T[]>();
  for (const element of liste) {
    const cle = jourDe(element.debut);
    const existant = paquets.get(cle);
    if (existant) existant.push(element);
    else paquets.set(cle, [element]);
  }
  return [...paquets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([jour, elements]) => ({ jour, elements }));
}
