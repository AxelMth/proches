'use client';

import { useActionState, useRef } from 'react';
import { BoutonSoumettre } from '@/components/BoutonSoumettre';
import { Alerte } from '@/components/Puces';
import {
  enregistrerMotDePasse,
  supprimerMotDePasse,
  type EtatMotDePasse,
} from './actions';

const INITIAL: EtatMotDePasse = { statut: 'inactif' };

/**
 * Définition ou changement du mot de passe.
 *
 * L'ancien mot de passe est demandé **s'il en existe un** : sans cela, un
 * appareil resté connecté chez quelqu'un d'autre suffirait à s'approprier le
 * compte pour de bon. À la première définition il n'y a rien à demander — la
 * session a été ouverte par un lien reçu sur la boîte mail du membre, ce qui
 * est déjà la preuve d'identité.
 */
export function FormulaireMotDePasse({
  existant,
  longueurMinimale,
}: {
  existant: boolean;
  /**
   * Passée par la page plutôt qu'importée de `motdepasse.ts` : ce module
   * charge `node:crypto`, qui n'a rien à faire dans un paquet de navigateur.
   * C'est la même valeur, elle vient juste par le serveur.
   */
  longueurMinimale: number;
}) {
  const [etat, action] = useActionState(enregistrerMotDePasse, INITIAL);
  const formulaire = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formulaire}
      action={async (donnees) => {
        await action(donnees);
        formulaire.current?.reset();
      }}
      className="mt-3 space-y-3"
    >
      {existant ? (
        <div>
          <label htmlFor="ancien" className="libelle">
            Mot de passe actuel
          </label>
          <input
            id="ancien"
            name="ancien"
            type="password"
            autoComplete="current-password"
            required
            className="champ"
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="nouveau" className="libelle">
          {existant ? 'Nouveau mot de passe' : 'Mot de passe'}
        </label>
        <input
          id="nouveau"
          name="nouveau"
          type="password"
          autoComplete="new-password"
          required
          minLength={longueurMinimale}
          className="champ"
        />
        <p className="mt-1 text-sm text-doux">
          {longueurMinimale} caractères au minimum. Une phrase dont vous vous souvenez vaut
          mieux qu’un assemblage de symboles que vous noterez quelque part.
        </p>
      </div>

      <div>
        <label htmlFor="confirmation" className="libelle">
          Répétez-le
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          className="champ"
        />
      </div>

      {etat.statut === 'ok' ? (
        <p role="status" className="rounded-xl bg-sauge-clair px-3 py-2 text-sm font-semibold text-sauge">
          {etat.message}
        </p>
      ) : (
        <Alerte>{etat.message}</Alerte>
      )}

      <BoutonSoumettre className="bouton bouton-doux" enCours="Enregistrement…">
        {existant ? 'Changer le mot de passe' : 'Définir ce mot de passe'}
      </BoutonSoumettre>
    </form>
  );
}

/**
 * Suppression du mot de passe — elle aussi demande le mot de passe actuel.
 *
 * Sans cette exigence, la protection du formulaire ci-dessus tombait : on
 * supprimait sans preuve, et le compte se retrouvait dans l'état « pas de mot
 * de passe », où en définir un n'en réclame aucun.
 */
export function FormulaireSuppressionMotDePasse() {
  const [etat, action] = useActionState(supprimerMotDePasse, INITIAL);
  const formulaire = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formulaire}
      action={async (donnees) => {
        await action(donnees);
        formulaire.current?.reset();
      }}
      className="mt-2 space-y-3 border-t pt-3"
    >
      <details className="text-sm">
        <summary className="cursor-pointer text-doux hover:text-encre">
          Supprimer mon mot de passe
        </summary>

        <div className="mt-3 space-y-3">
          <p className="text-doux">
            Vous entrerez de nouveau par un lien reçu par courriel, comme avant.
          </p>

          <div>
            <label htmlFor="ancien-suppression" className="libelle">
              Mot de passe actuel
            </label>
            <input
              id="ancien-suppression"
              name="ancien"
              type="password"
              autoComplete="current-password"
              required
              className="champ"
            />
          </div>

          {etat.statut === 'ok' ? (
            <p
              role="status"
              className="rounded-xl bg-sauge-clair px-3 py-2 text-sm font-semibold text-sauge"
            >
              {etat.message}
            </p>
          ) : (
            <Alerte>{etat.message}</Alerte>
          )}

          <BoutonSoumettre className="bouton bouton-discret text-alerte" enCours="Suppression…">
            Supprimer mon mot de passe
          </BoutonSoumettre>
        </div>
      </details>
    </form>
  );
}
