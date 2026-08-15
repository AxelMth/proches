import Link from 'next/link';
import { Vide } from '@/components/Puces';
import {
  ajouterJours,
  aujourdhui,
  decalerMois,
  formatJourLong,
  formatMois,
  grilleDuMois,
  debutDeJournee,
  jourDe,
  majuscule,
  moisDe,
} from '@/server/dates';
import { origine } from '@/server/liens';
import { contexteAidant } from '@/server/session';
import { evenements as listerEvenements } from '@/server/store';
import type { Evenement } from '@/server/types';
import { CarteEvenement } from './CarteEvenement';
import { FormulaireEvenement } from './FormulaireEvenement';

export const metadata = { title: 'Agenda' };
export const dynamic = 'force-dynamic';

const JOURS_SEMAINE = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

export default async function PageAgenda({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { membre, foyer } = await contexteAidant('/agenda');
  const params = await searchParams;

  const jour = aujourdhui();
  const mois =
    typeof params.mois === 'string' && /^\d{4}-\d{2}$/.test(params.mois)
      ? params.mois
      : moisDe(jour);

  const grille = grilleDuMois(mois);
  const premier = grille[0] ?? jour;
  const dernier = grille[grille.length - 1] ?? jour;

  const liste = await listerEvenements(foyer.id, {
    du: debutDeJournee(premier),
    au: debutDeJournee(ajouterJours(dernier, 1)),
  });

  // Un événement de plusieurs jours doit apparaître dans chaque case qu'il
  // traverse, pas seulement le jour où il commence.
  const parJour = new Map<string, Evenement[]>();
  for (const evenement of liste) {
    const fin = jourDe(evenement.fin);
    for (let j = jourDe(evenement.debut); j <= fin; j = ajouterJours(j, 1)) {
      const paquet = parJour.get(j);
      if (paquet) paquet.push(evenement);
      else parJour.set(j, [evenement]);
    }
  }

  const duMois = liste.filter((evenement) => moisDe(jourDe(evenement.debut)) === mois);
  const urlIcs = `${origine()}/api/agenda/${membre.jetonAgenda}/proches.ics`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <Link href="/agenda" className="lien text-sm">
          Revenir à aujourd’hui
        </Link>
      </div>

      <section className="carte p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link
            href={`/agenda?mois=${decalerMois(mois, -1)}`}
            className="bouton bouton-doux"
            aria-label={`Mois précédent, ${formatMois(decalerMois(mois, -1))}`}
          >
            ←
          </Link>
          <h2 className="text-lg font-bold">{majuscule(formatMois(mois))}</h2>
          <Link
            href={`/agenda?mois=${decalerMois(mois, 1)}`}
            className="bouton bouton-doux"
            aria-label={`Mois suivant, ${formatMois(decalerMois(mois, 1))}`}
          >
            →
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-doux">
          {JOURS_SEMAINE.map((nom) => (
            <div key={nom} className="py-1">
              {nom}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grille.map((jourCase) => {
            const duJour = parJour.get(jourCase) ?? [];
            const horsMois = moisDe(jourCase) !== mois;
            const cestAujourdhui = jourCase === jour;

            const style =
              `flex min-h-16 flex-col rounded-lg border p-1 text-left ` +
              `${horsMois ? 'opacity-40 ' : ''}` +
              `${cestAujourdhui ? 'border-terre bg-terre-clair' : 'border-transparent'}`;

            const contenu = (
              <>
                <span
                  className={`text-xs font-semibold ${cestAujourdhui ? 'text-terre' : 'text-doux'}`}
                >
                  {Number(jourCase.slice(8))}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-0.5" aria-hidden="true">
                  {duJour.slice(0, 4).map((evenement) => (
                    <span key={evenement.id} className="size-1.5 rounded-full bg-terre" />
                  ))}
                </span>
              </>
            );

            // Une journée vide n'est pas un lien. Un `<a>` sans `href` reste
            // annoncé comme tel par un lecteur d'écran : sur un mois calme,
            // cela ferait quarante « liens » qui ne mènent nulle part.
            return duJour.length === 0 ? (
              <div key={jourCase} className={style} aria-hidden={horsMois || undefined}>
                {contenu}
              </div>
            ) : (
              <a
                key={jourCase}
                href={`#j-${jourCase}`}
                aria-label={`${formatJourLong(jourCase)} — ${duJour.length} rendez-vous : ${duJour
                  .map((evenement) => evenement.titre)
                  .join(', ')}`}
                className={`${style} hover:bg-surface-2`}
              >
                {contenu}
              </a>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-doux">
          {majuscule(formatMois(mois))} en détail
        </h2>

        {duMois.length === 0 ? (
          <Vide>Rien de prévu ce mois-ci.</Vide>
        ) : (
          <ul className="space-y-4">
            {regrouper(duMois).map(({ jour: jourGroupe, elements }) => (
              <li key={jourGroupe} id={`j-${jourGroupe}`} className="scroll-mt-4">
                <h3
                  className={`mb-1.5 font-bold ${
                    jourGroupe === jour ? 'text-terre' : ''
                  }`}
                >
                  {majuscule(formatJourLong(jourGroupe))}
                  {jourGroupe === jour ? " — aujourd'hui" : ''}
                </h3>
                <ul className="space-y-2">
                  {elements.map((evenement) => (
                    <CarteEvenement key={evenement.id} evenement={evenement} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="carte p-4">
        <summary className="cursor-pointer font-semibold">Ajouter un rendez-vous</summary>
        <div className="mt-4">
          <FormulaireEvenement
            valeurs={{
              titre: '',
              categorie: 'medical',
              lieu: '',
              notes: '',
              journeeEntiere: false,
              debut: `${jour}T09:00`,
              fin: '',
            }}
          />
        </div>
      </details>

      <section className="carte p-4">
        <h2 className="font-semibold">Voir cet agenda dans votre téléphone</h2>
        <p className="mt-1 text-sm text-doux">
          Ajoutez cette adresse comme calendrier « par URL » dans Google Agenda ou Calendrier
          Apple : les rendez-vous apparaîtront au milieu des vôtres, et se mettront à jour tout
          seuls. Cette adresse vous est personnelle — ne la partagez pas.
        </p>
        <code className="mt-2 block overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 text-sm">
          {urlIcs}
        </code>
      </section>
    </div>
  );
}

function regrouper(liste: readonly Evenement[]): { jour: string; elements: Evenement[] }[] {
  const paquets = new Map<string, Evenement[]>();
  for (const evenement of liste) {
    const cle = jourDe(evenement.debut);
    const existant = paquets.get(cle);
    if (existant) existant.push(evenement);
    else paquets.set(cle, [evenement]);
  }
  return [...paquets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([jour, elements]) => ({ jour, elements }));
}
