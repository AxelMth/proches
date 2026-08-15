/**
 * Deux silhouettes qui se tiennent — l'une soutenue par l'autre.
 * Dessin en SVG plutôt qu'en image : net à toute taille, aucune requête.
 */
export function Marque({ taille = 28, avecNom = false }: { taille?: number; avecNom?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width={taille}
        height={taille}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        role="presentation"
      >
        <circle cx="16" cy="16" r="16" fill="var(--c-terre-clair)" />
        <circle cx="12" cy="11" r="3.6" fill="var(--c-terre)" />
        <circle cx="21" cy="12.5" r="2.8" fill="var(--c-sauge)" />
        <path
          d="M5.5 25c0-3.9 2.9-6.7 6.5-6.7s6.5 2.8 6.5 6.7z"
          fill="var(--c-terre)"
        />
        <path
          d="M17.5 25c0-3.2 2.2-5.4 5-5.4s5 2.2 5 5.4z"
          fill="var(--c-sauge)"
        />
      </svg>
      {avecNom ? <span className="text-lg font-bold tracking-tight">Proches</span> : null}
    </span>
  );
}
