'use client';

import { useActionState } from 'react';
import { BoutonSoumettre } from '@/components/BoutonSoumettre';
import { renvoyerDepuisLien, type EtatRenvoi } from './actions';

const INITIAL: EtatRenvoi = { statut: 'inactif' };

/** « Recevoir un nouveau lien », depuis la page d'un lien périmé. */
export function BoutonRenvoi({ jeton }: { jeton: string }) {
  const [etat, action] = useActionState(renvoyerDepuisLien, INITIAL);

  if (etat.statut === 'ok') {
    return (
      <p role="status" className="rounded-xl bg-sauge-clair p-4 text-sauge">
        {etat.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="jeton" value={jeton} />
      {etat.statut === 'erreur' ? (
        <p
          role="alert"
          className="rounded-xl bg-alerte-clair px-3 py-2 text-sm font-semibold text-alerte"
        >
          {etat.message}
        </p>
      ) : null}
      <BoutonSoumettre className="bouton w-full" enCours="Envoi…">
        Recevoir un nouveau lien
      </BoutonSoumettre>
    </form>
  );
}
