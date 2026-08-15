import { estImage, type Fichier } from '@/server/types';
import { VignettePdf } from './VignettePdf';

/**
 * Vignette d'une pièce.
 *
 * Les images sont rendues telles quelles — le navigateur les redimensionne, et
 * à 5 Mo par pièce cela reste raisonnable. Les PDF sont décodés par pdf.js et
 * peints dans un canevas : voir `VignettePdf`, qui explique pourquoi ce n'est
 * pas un `<iframe>` et à quel prix. Le reste reçoit une tuile typée, qui sert
 * aussi de repli quand le rendu d'un PDF échoue.
 *
 * Tout passe par `/api/fichiers/…`, qui vérifie la session : le bucket n'est
 * jamais public, et une vignette n'est pas une porte dérobée.
 */
export function Apercu({
  fichier,
  base = '/api/fichiers',
  classe = 'h-40',
}: {
  fichier: Fichier;
  /** `/a/<jeton>/fichiers` pour la vue de la personne accompagnée. */
  base?: string;
  classe?: string;
}) {
  // Le fond est séparé du reste : la vignette d'un PDF le remplace par du
  // blanc une fois la page peinte.
  const contour = `w-full ${classe} rounded-lg border`;
  const cadre = `${contour} bg-surface-2`;

  if (estImage(fichier.typeMime)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- fichier privé,
      // servi par notre route authentifiée : `next/image` n'y a pas accès.
      <img
        src={`${base}/${fichier.id}`}
        alt={fichier.nomFichier}
        loading="lazy"
        className={`${cadre} object-contain`}
      />
    );
  }

  if (fichier.typeMime === 'application/pdf') {
    return (
      <VignettePdf
        src={`${base}/${fichier.id}`}
        alt={`Première page de ${fichier.nomFichier}`}
        classe={contour}
      >
        <TuileTypee fichier={fichier} cadre={cadre} />
      </VignettePdf>
    );
  }

  return <TuileTypee fichier={fichier} cadre={cadre} />;
}

/** Ce qu'on montre quand il n'y a rien à peindre : le type et le nom. */
function TuileTypee({ fichier, cadre }: { fichier: Fichier; cadre: string }) {
  const etiquette = fichier.typeMime === 'application/pdf' ? 'PDF' : 'Fichier';

  return (
    <div className={`${cadre} flex flex-col items-center justify-center gap-1 px-2`}>
      <IconeFichier taille={28} />
      <span className="text-xs font-bold uppercase tracking-wide text-doux">{etiquette}</span>
      <span className="line-clamp-2 text-center text-xs text-doux">{fichier.nomFichier}</span>
    </div>
  );
}

export function IconeFichier({ taille = 32 }: { taille?: number }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-doux"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
