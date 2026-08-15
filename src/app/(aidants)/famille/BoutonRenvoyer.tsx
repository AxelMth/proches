'use client';

import { useActionState } from 'react';
import { BoutonSoumettre } from '@/components/BoutonSoumettre';
import { renvoyerLien, type EtatInvitation } from './actions';

const INITIAL: EtatInvitation = { statut: 'inactif' };

/**
 * Renvoie un lien de connexion à un aidant.
 *
 * Le retour s'affiche sur la ligne de la personne concernée, pas en haut de
 * page : avec plusieurs aidants, un message global ne dirait pas *à qui* le
 * lien est parti.
 */
export function BoutonRenvoyer({ id, prenom }: { id: string; prenom: string }) {
  const [etat, action] = useActionState(renvoyerLien, INITIAL);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />

      <BoutonSoumettre
        className="bouton bouton-discret"
        enCours="Envoi…"
        aria-label={`Renvoyer un lien de connexion à ${prenom}`}
      >
        Renvoyer un lien
      </BoutonSoumettre>

      {etat.statut !== 'inactif' ? (
        <span
          role="status"
          className={`text-sm font-semibold ${
            etat.statut === 'ok' ? 'text-sauge' : 'text-alerte'
          }`}
        >
          {etat.message}
        </span>
      ) : null}
    </form>
  );
}
