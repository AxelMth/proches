import { aujourdhui, ecartJours, etiquetteJour } from '@/server/dates';
import type { Membre, Tache } from '@/server/types';
import { CaseTache } from './CaseTache';
import { FormulaireEdition } from './FormulaireTache';
import { retirerTache } from './actions';

/**
 * Une tâche dans une liste.
 *
 * En mode `compact` (tableau de bord), on ne montre que l'essentiel et pas le
 * formulaire d'édition : la page d'accueil sert à voir, la page « À faire » à
 * organiser.
 */
export function LigneTache({
  tache,
  membres,
  compact = false,
}: {
  tache: Tache;
  membres?: readonly Membre[];
  compact?: boolean;
}) {
  const faite = tache.faiteLe != null;
  const enRetard = !faite && tache.echeance != null && ecartJours(aujourdhui(), tache.echeance) < 0;

  return (
    <li className="carte px-4 py-3">
      <div className="flex items-start gap-3">
        <CaseTache id={tache.id} faite={faite} titre={tache.titre} />

        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${faite ? 'text-doux line-through' : ''}`}>
            {tache.priorite === 'haute' && !faite ? (
              <span className="mr-1.5 text-alerte" title="Important">
                !
              </span>
            ) : null}
            {tache.titre}
          </p>

          {tache.details ? (
            <p className="mt-0.5 whitespace-pre-line text-sm text-doux">{tache.details}</p>
          ) : null}

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-doux">
            {tache.echeance ? (
              <span className={enRetard ? 'font-semibold text-alerte' : ''}>
                {etiquetteJour(tache.echeance)}
              </span>
            ) : null}
            {tache.assigneePrenom ? <span>Pour {tache.assigneePrenom}</span> : null}
            {faite && tache.faiteParPrenom ? <span>Fait par {tache.faiteParPrenom}</span> : null}
          </p>

          {!compact && membres ? (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-doux hover:text-encre">Modifier</summary>
              <div className="mt-2 space-y-3">
                <FormulaireEdition tache={tache} membres={membres} />
                <form action={retirerTache}>
                  <input type="hidden" name="id" value={tache.id} />
                  <button type="submit" className="bouton bouton-discret text-alerte">
                    Supprimer cette tâche
                  </button>
                </form>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </li>
  );
}
