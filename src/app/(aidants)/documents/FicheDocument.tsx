import { PuceDocument } from '@/components/Puces';
import { formatJourCourt, jourDe } from '@/server/dates';
import { formatTaille } from '@/server/formats';
import { tailleTotale, type Document } from '@/server/types';
import { Apercu, IconeFichier } from './Apercu';
import { PanneauDocument } from './PanneauDocument';

export type Vue = 'liste' | 'cartes' | 'apercu';

/**
 * Une fiche de document, dans l'une des trois densités.
 *
 * Le même composant sert les trois vues plutôt que trois composants séparés :
 * les métadonnées, les actions et le panneau d'édition sont identiques, seul
 * l'encombrement change. Trois copies auraient divergé au premier ajout.
 */
export function FicheDocument({
  document,
  vue,
  tailleMax,
}: {
  document: Document;
  vue: Vue;
  tailleMax: number;
}) {
  const pieces = document.fichiers.length;
  const premiere = document.fichiers[0];

  const meta = (
    <p className="text-sm text-doux">
      {pieces} pièce{pieces > 1 ? 's' : ''} · {formatTaille(tailleTotale(document))} ·{' '}
      {formatJourCourt(jourDe(document.creeLe))}
      {document.ajouteParPrenom ? ` · ${document.ajouteParPrenom}` : ''}
    </p>
  );

  return (
    <li className={`carte ${vue === 'liste' ? 'px-4 py-3' : 'p-4'}`}>
      {vue === 'apercu' && premiere ? (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {document.fichiers.slice(0, 4).map((fichier) => (
            <a
              key={fichier.id}
              href={`/api/fichiers/${fichier.id}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Ouvrir ${fichier.nomFichier}`}
              className={pieces === 1 ? 'col-span-2' : ''}
            >
              <Apercu fichier={fichier} classe={pieces === 1 ? 'h-56' : 'h-28'} />
            </a>
          ))}
          {pieces > 4 ? (
            <p className="col-span-2 text-center text-sm text-doux">
              et {pieces - 4} autre{pieces - 4 > 1 ? 's' : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{document.titre}</h2>
          {document.notes ? <p className="text-sm text-doux">{document.notes}</p> : null}
          {vue === 'liste' ? meta : null}
        </div>
        <PuceDocument categorie={document.categorie} />
      </div>

      {vue !== 'liste' ? <div className="mt-1">{meta}</div> : null}

      {/* En vue liste et cartes, les pièces sont des liens nommés : on cherche
          « le verso », pas « la pièce 2 ». */}
      {vue !== 'apercu' ? (
        <ul className="mt-2 space-y-1">
          {document.fichiers.map((fichier) => (
            <li key={fichier.id} className="flex items-center gap-2 text-sm">
              <IconeFichier taille={16} />
              <a
                href={`/api/fichiers/${fichier.id}`}
                target="_blank"
                rel="noreferrer"
                className="lien min-w-0 truncate"
              >
                {fichier.nomFichier}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-doux hover:text-encre">
          Modifier, ajouter une pièce, supprimer
        </summary>
        <PanneauDocument document={document} tailleMax={tailleMax} />
      </details>
    </li>
  );
}
