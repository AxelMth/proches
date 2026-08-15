import { PuceEvenement } from '@/components/Puces';
import { formatHeure, jourDe, localDepuisInstant } from '@/server/dates';
import type { Evenement } from '@/server/types';
import { FormulaireEvenement } from './FormulaireEvenement';
import { retirerEvenement } from './actions';

/** « 14:30 – 15:30 », « Toute la journée », « du 8 au 12 ». */
export function quand(evenement: Evenement): string {
  if (!evenement.journeeEntiere) {
    return `${formatHeure(evenement.debut)} – ${formatHeure(evenement.fin)}`;
  }
  const debut = jourDe(evenement.debut);
  const fin = jourDe(evenement.fin);
  return debut === fin ? 'Toute la journée' : `Du ${debut.slice(8)} au ${fin.slice(8)}`;
}

export function CarteEvenement({
  evenement,
  modifiable = true,
}: {
  evenement: Evenement;
  modifiable?: boolean;
}) {
  return (
    <li className="carte px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold">{evenement.titre}</p>
        <p className="text-sm font-semibold text-doux">{quand(evenement)}</p>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <PuceEvenement categorie={evenement.categorie} />
        {evenement.lieu ? <span className="text-sm text-doux">{evenement.lieu}</span> : null}
      </div>

      {evenement.notes ? (
        <p className="mt-1.5 whitespace-pre-line text-sm text-doux">{evenement.notes}</p>
      ) : null}

      {modifiable ? (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-doux hover:text-encre">Modifier</summary>
          <div className="mt-3 space-y-3 border-t pt-3">
            <FormulaireEvenement
              edition
              valeurs={{
                id: evenement.id,
                titre: evenement.titre,
                categorie: evenement.categorie,
                lieu: evenement.lieu ?? '',
                notes: evenement.notes ?? '',
                journeeEntiere: evenement.journeeEntiere,
                debut: localDepuisInstant(evenement.debut),
                fin: localDepuisInstant(evenement.fin),
              }}
            />
            <form action={retirerEvenement}>
              <input type="hidden" name="id" value={evenement.id} />
              <button type="submit" className="bouton bouton-discret text-alerte">
                Supprimer ce rendez-vous
              </button>
            </form>
          </div>
        </details>
      ) : null}
    </li>
  );
}
