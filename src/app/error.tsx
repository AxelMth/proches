'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Filet de sécurité de toutes les pages.
 *
 * Sans ce fichier, la moindre exception serveur affiche la page technique de
 * Next — en anglais, avec un identifiant de trace et rien d'autre. Sur une
 * application ouverte par des gens qui s'occupent d'un parent, et parfois par
 * ce parent lui-même, c'est inacceptable.
 *
 * Il couvre aussi les erreurs levées par `(aidants)/layout.tsx` — donc
 * `contexteAidant()`, la session et la base : un `error.tsx` ne rattrape jamais
 * le layout de son propre segment, seulement ceux d'en dessous. C'est
 * précisément le point de levée le plus probable de l'application.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[proches] erreur de rendu :', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-2xl font-bold">Quelque chose n’a pas fonctionné</h1>
      <p className="text-doux">
        Ce n’est pas de votre fait. Réessayez dans un instant — si cela recommence, prévenez la
        personne qui administre cet espace.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="bouton">
          Réessayer
        </button>
        <Link href="/" className="bouton bouton-doux">
          Revenir à l’accueil
        </Link>
      </div>

      {/* L'identifiant est ce qui permet de retrouver la trace dans `fly logs`. */}
      {error.digest ? <p className="text-sm text-doux">Référence : {error.digest}</p> : null}
    </main>
  );
}
