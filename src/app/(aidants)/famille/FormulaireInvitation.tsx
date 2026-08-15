'use client';

import { useActionState } from 'react';
import { BoutonSoumettre } from '@/components/BoutonSoumettre';
import { Alerte } from '@/components/Puces';
import { inviterAidant, type EtatInvitation } from './actions';

const INITIAL: EtatInvitation = { statut: 'inactif' };

export function FormulaireInvitation() {
  const [etat, action] = useActionState(inviterAidant, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="prenom" className="libelle">
            Prénom
          </label>
          <input id="prenom" name="prenom" required maxLength={80} className="champ" />
        </div>
        <div>
          <label htmlFor="email-invite" className="libelle">
            Adresse e-mail
          </label>
          <input
            id="email-invite"
            name="email"
            type="email"
            required
            autoComplete="off"
            className="champ"
          />
        </div>
      </div>

      {etat.statut === 'erreur' ? <Alerte>{etat.message}</Alerte> : null}
      {etat.statut === 'ok' ? (
        <p
          role="status"
          className="rounded-xl bg-sauge-clair px-3 py-2 text-sm font-semibold text-sauge"
        >
          {etat.message}
        </p>
      ) : null}

      <BoutonSoumettre enCours="Envoi de l’invitation…">Inviter</BoutonSoumettre>
    </form>
  );
}
