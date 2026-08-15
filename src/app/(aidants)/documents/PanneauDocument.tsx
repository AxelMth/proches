'use client';

import { useActionState, useState } from 'react';
import { BoutonSoumettre } from '@/components/BoutonSoumettre';
import { ChampFichiers } from '@/components/ChampFichiers';
import { Alerte } from '@/components/Puces';
import { formatTaille } from '@/server/formats';
import {
  LIBELLES_CATEGORIE_DOCUMENT,
  type CategorieDocument,
  type Document,
} from '@/server/types';
import { IconeFichier } from './Apercu';
import {
  ajouterPieces,
  enregistrerDetails,
  retirerDocument,
  retirerPiece,
  type EtatDepot,
} from './actions';

const INITIAL: EtatDepot = { statut: 'inactif' };
const CATEGORIES = Object.entries(LIBELLES_CATEGORIE_DOCUMENT) as [CategorieDocument, string][];

/**
 * Panneau d'édition d'un document, replié sous sa fiche.
 *
 * Trois choses distinctes, et c'est délibéré : corriger les étiquettes,
 * ajouter des pièces, retirer. Changer une catégorie mal choisie ne doit rien
 * coûter — avant, il fallait supprimer le document et le redéposer.
 */
export function PanneauDocument({
  document,
  tailleMax,
}: {
  document: Document;
  tailleMax: number;
}) {
  const [etatDetails, actionDetails] = useActionState(enregistrerDetails, INITIAL);
  const [etatPieces, actionPieces] = useActionState(ajouterPieces, INITIAL);
  const [probleme, setProbleme] = useState<string | null>(null);
  const seule = document.fichiers.length <= 1;

  return (
    <div className="mt-3 space-y-5 border-t pt-3 text-sm">
      <form action={actionDetails} className="space-y-3">
        <input type="hidden" name="id" value={document.id} />

        <div>
          <label htmlFor={`titre-${document.id}`} className="libelle">
            Titre
          </label>
          <input
            id={`titre-${document.id}`}
            name="titre"
            required
            maxLength={200}
            defaultValue={document.titre}
            className="champ"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`categorie-${document.id}`} className="libelle">
              Catégorie
            </label>
            <select
              id={`categorie-${document.id}`}
              name="categorie"
              defaultValue={document.categorie}
              className="champ"
            >
              {CATEGORIES.map(([valeur, libelle]) => (
                <option key={valeur} value={valeur}>
                  {libelle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`notes-${document.id}`} className="libelle">
              Précision
            </label>
            <input
              id={`notes-${document.id}`}
              name="notes"
              maxLength={300}
              defaultValue={document.notes ?? ''}
              className="champ"
            />
          </div>
        </div>

        {etatDetails.statut === 'erreur' ? <Alerte>{etatDetails.message}</Alerte> : null}
        {etatDetails.statut === 'ok' ? (
          <p role="status" className="font-semibold text-sauge">
            {etatDetails.message}
          </p>
        ) : null}

        <BoutonSoumettre className="bouton bouton-doux" enCours="Enregistrement…">
          Enregistrer
        </BoutonSoumettre>
      </form>

      <section>
        <h4 className="libelle">
          Pièces · {document.fichiers.length}
        </h4>
        <ul className="space-y-1">
          {document.fichiers.map((fichier) => (
            <li key={fichier.id} className="flex flex-wrap items-center gap-2">
              <IconeFichier taille={18} />
              <a
                href={`/api/fichiers/${fichier.id}`}
                target="_blank"
                rel="noreferrer"
                className="lien min-w-0 flex-1 truncate"
              >
                {fichier.nomFichier}
              </a>
              <span className="shrink-0 text-doux">{formatTaille(fichier.taille)}</span>

              {seule ? null : (
                <form action={retirerPiece}>
                  <input type="hidden" name="fichierId" value={fichier.id} />
                  <button type="submit" className="bouton bouton-discret text-alerte">
                    Retirer
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {seule ? (
          <p className="mt-1 text-doux">
            Dernière pièce du document : pour l’enlever, supprimez le document.
          </p>
        ) : null}
      </section>

      <form action={actionPieces} className="space-y-2">
        <input type="hidden" name="id" value={document.id} />
        <ChampFichiers
          id={`ajout-${document.id}`}
          libelle="Ajouter une pièce"
          tailleMax={tailleMax}
          onProbleme={setProbleme}
        />

        {etatPieces.statut === 'erreur' ? <Alerte>{etatPieces.message}</Alerte> : null}
        {etatPieces.statut === 'ok' ? (
          <p role="status" className="font-semibold text-sauge">
            {etatPieces.message}
          </p>
        ) : null}

        <BoutonSoumettre
          className="bouton bouton-doux"
          enCours="Envoi…"
          desactive={probleme != null}
        >
          Ajouter
        </BoutonSoumettre>
      </form>

      <form action={retirerDocument}>
        <input type="hidden" name="id" value={document.id} />
        <button type="submit" className="bouton bouton-discret text-alerte">
          Supprimer ce document et ses {document.fichiers.length} pièce
          {document.fichiers.length > 1 ? 's' : ''}
        </button>
      </form>
    </div>
  );
}
