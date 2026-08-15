'use client';

import './globals.css';

/**
 * Dernier recours : une erreur levée par le layout racine lui-même, que
 * `error.tsx` ne peut pas voir.
 *
 * Next remplace alors tout le document, d'où les balises `<html>` et `<body>`
 * — elles ne sont pas décoratives, la page ne s'affiche pas sans elles. On ne
 * s'appuie ici sur aucun composant de l'application : si le layout racine a
 * échoué, il faut supposer que rien d'autre ne tient debout.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
          <h1 className="text-2xl font-bold">Le site est momentanément indisponible</h1>
          <p className="text-doux">
            Réessayez dans quelques minutes. Si cela persiste, prévenez la personne qui
            administre cet espace.
          </p>
          <button type="button" onClick={reset} className="bouton">
            Réessayer
          </button>
          {error.digest ? <p className="text-sm text-doux">Référence : {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
