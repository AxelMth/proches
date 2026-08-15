import Link from 'next/link';
import { Marque } from '@/components/Marque';

/**
 * Aussi la page que voit une personne dont le lien permanent a été révoqué.
 * D'où le ton : ce n'est pas une erreur de sa part, et le premier réflexe utile
 * est de demander le nouveau lien à un proche.
 */
export default function Introuvable() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <Marque taille={44} />
      <h1 className="text-2xl font-bold">Cette page n’existe pas</h1>
      <p className="text-doux">
        Le lien est peut-être ancien : il a pu être remplacé par un nouveau. Demandez-le à la
        personne qui vous a donné celui-ci.
      </p>
      <Link href="/connexion" className="bouton">
        Aller à la connexion
      </Link>
    </main>
  );
}
