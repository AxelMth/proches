'use client';

import { useActionState, useRef, useState } from 'react';
import { BoutonSoumettre } from '@/components/BoutonSoumettre';
import { ChampFichiers } from '@/components/ChampFichiers';
import { Alerte } from '@/components/Puces';
import { LIBELLES_CATEGORIE_DOCUMENT, type CategorieDocument } from '@/server/types';
import { deposerDocument, type EtatDepot } from './actions';

const INITIAL: EtatDepot = { statut: 'inactif' };
const CATEGORIES = Object.entries(LIBELLES_CATEGORIE_DOCUMENT) as [CategorieDocument, string][];

export function FormulaireDocument({ tailleMax }: { tailleMax: number }) {
  const [etat, action] = useActionState(deposerDocument, INITIAL);
  const [probleme, setProbleme] = useState<string | null>(null);
  const formulaire = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formulaire}
      action={async (donnees) => {
        await action(donnees);
        formulaire.current?.reset();
      }}
      className="carte space-y-3 p-4"
    >
      <ChampFichiers
        id="fichier"
        libelle="Le ou les fichiers"
        aide="Plusieurs fichiers forment un seul document — recto et verso d’une carte, ou une ordonnance en plusieurs pages."
        tailleMax={tailleMax}
        onProbleme={setProbleme}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="titre" className="libelle">
            Comment l’appeler
          </label>
          <input
            id="titre"
            name="titre"
            maxLength={200}
            placeholder="Attestation mutuelle 2026"
            className="champ"
          />
        </div>

        <div>
          <label htmlFor="categorie" className="libelle">
            Ranger dans
          </label>
          <select id="categorie" name="categorie" defaultValue="administratif" className="champ">
            {CATEGORIES.map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="libelle">
          Une précision (facultatif)
        </label>
        <input
          id="notes"
          name="notes"
          maxLength={300}
          placeholder="Valable jusqu’au 31 décembre"
          className="champ"
        />
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

      <BoutonSoumettre enCours="Envoi…" desactive={probleme != null}>
        Déposer le document
      </BoutonSoumettre>
    </form>
  );
}
