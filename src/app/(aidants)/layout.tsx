import { Marque } from '@/components/Marque';
import { Navigation } from '@/components/Navigation';
import { contexteAidant } from '@/server/session';

/**
 * Coquille commune des pages aidants. Le contrôle de session est ici, une
 * seule fois : aucune page du groupe ne peut être rendue sans être passée par
 * `contexteAidant`.
 */
export default async function LayoutAidants({ children }: { children: React.ReactNode }) {
  const { membre, foyer } = await contexteAidant();

  return (
    <div className="mx-auto flex w-full max-w-5xl">
      <Navigation prenom={membre.prenom} />

      <div className="min-w-0 flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-12 md:pt-8">
        <header className="mb-5 flex items-center justify-between md:hidden">
          <Marque taille={26} avecNom />
          <form action="/deconnexion" method="post">
            <button type="submit" className="bouton bouton-discret">
              Quitter
            </button>
          </form>
        </header>

        <main id="contenu">{children}</main>

        <footer className="mt-12 border-t pt-4 text-sm text-doux">
          Espace partagé pour accompagner {foyer.nom}.
        </footer>
      </div>
    </div>
  );
}
