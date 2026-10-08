'use client';

import { useState } from 'react';
import { FORMATS_ACCEPTES, formatTaille, refusLot, TOTAL_MAX_OCTETS } from '@/server/formats';

/**
 * Champ de dépôt de pièces, avec contrôle **avant** l'envoi.
 *
 * Le serveur reste l'autorité — cette vérification ne le remplace pas, elle
 * l'anticipe. Deux raisons de la faire ici :
 *
 *  - un fichier trop lourd part quand même sur le réseau avant d'être refusé,
 *    ce qui est long sur une connexion de campagne et donne l'impression que
 *    l'application a planté ;
 *  - surtout, dépasser la limite de corps des Server Actions ne produit pas un
 *    refus applicatif mais une erreur opaque, sans message exploitable. Le seul
 *    endroit où l'on peut encore parler clairement, c'est avant l'envoi.
 */
export function ChampFichiers({
  id,
  libelle,
  aide,
  tailleMax,
  onProbleme,
}: {
  id: string;
  libelle: string;
  aide?: string;
  tailleMax: number;
  onProbleme: (message: string | null) => void;
}) {
  const [probleme, setProbleme] = useState<string | null>(null);

  return (
    <div>
      <label htmlFor={id} className="libelle">
        {libelle}
      </label>
      <input
        id={id}
        name="fichier"
        type="file"
        multiple
        required
        accept={FORMATS_ACCEPTES}
        aria-invalid={probleme ? true : undefined}
        aria-describedby={probleme ? `${id}-probleme` : undefined}
        onChange={(evenement) => {
          const pieces = [...(evenement.target.files ?? [])];
          const motif = pieces.length > 0 ? refusLot(pieces, tailleMax) : null;
          setProbleme(motif);
          onProbleme(motif);
        }}
        className="champ py-2"
      />

      {probleme ? (
        <p
          id={`${id}-probleme`}
          role="alert"
          className="mt-1 rounded-xl bg-alerte-clair px-3 py-2 text-sm font-semibold text-alerte"
        >
          {probleme}
        </p>
      ) : (
        <p className="mt-1 text-sm text-doux">
          {aide ? `${aide} ` : ''}
          PDF, photo, CSV ou Excel, {formatTaille(tailleMax)} par pièce, {formatTaille(TOTAL_MAX_OCTETS)} en
          tout.
        </p>
      )}
    </div>
  );
}
