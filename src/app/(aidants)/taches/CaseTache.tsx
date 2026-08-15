'use client';

import { useOptimistic, useTransition } from 'react';
import { basculer } from './actions';

/**
 * Case à cocher d'une tâche.
 *
 * L'état bascule immédiatement à l'écran, avant même la réponse du serveur :
 * cocher une tâche est le geste le plus fréquent de l'application, il ne doit
 * pas donner l'impression d'attendre. Si le serveur refuse, `useOptimistic`
 * remet la case dans son état réel à la fin de la transition.
 *
 * C'est un vrai bouton, pas un `<input type="checkbox">` habillé : l'action
 * n'est pas « modifier un champ » mais « marquer comme fait », et le libellé
 * accessible doit le dire.
 */
export function CaseTache({
  id,
  faite,
  titre,
}: {
  id: string;
  faite: boolean;
  titre: string;
}) {
  const [enCours, demarrer] = useTransition();
  const [optimiste, marquer] = useOptimistic(faite);

  return (
    <button
      type="button"
      aria-pressed={optimiste}
      aria-label={optimiste ? `Rouvrir « ${titre} »` : `Marquer « ${titre} » comme fait`}
      disabled={enCours}
      onClick={() => {
        demarrer(async () => {
          marquer(!optimiste);
          await basculer(id);
        });
      }}
      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        optimiste ? 'border-sauge bg-sauge text-white' : 'border-bordure bg-surface hover:border-sauge'
      }`}
    >
      {optimiste ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </button>
  );
}
