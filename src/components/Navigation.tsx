'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Marque } from './Marque';

/**
 * Chrome de navigation des aidants — un seul élément pour les deux mises en
 * page : barre basse sur mobile (là où le pouce arrive), colonne de gauche à
 * partir de `md`.
 *
 * Un seul `<nav>` dans le document, plutôt qu'une version mobile et une
 * version bureau toutes deux présentes : un lecteur d'écran annoncerait
 * autrement deux fois la même navigation.
 *
 * Chaque onglet porte son libellé en toutes lettres. Une icône seule s'apprend,
 * un mot se lit — et l'apprentissage n'a pas à être demandé ici.
 */

const ONGLETS = [
  { href: '/', libelle: 'Accueil', icone: MaisonIcone },
  { href: '/taches', libelle: 'À faire', icone: ListeIcone },
  { href: '/agenda', libelle: 'Agenda', icone: CalendrierIcone },
  { href: '/documents', libelle: 'Documents', icone: DossierIcone },
  { href: '/contacts', libelle: 'Contacts', icone: TelephoneIcone },
  { href: '/famille', libelle: 'Famille', icone: PersonnesIcone },
] as const;

export function Navigation({ prenom }: { prenom: string }) {
  const chemin = usePathname();
  const actif = (href: string): boolean => (href === '/' ? chemin === '/' : chemin.startsWith(href));

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-surface pb-[env(safe-area-inset-bottom)] md:sticky md:inset-x-auto md:bottom-auto md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:gap-6 md:border-r md:border-t-0 md:bg-transparent md:p-4 md:pb-4"
    >
      <Link href="/" className="hidden md:inline-flex" aria-label="Proches, accueil">
        <Marque taille={30} avecNom />
      </Link>

      <ul className="flex md:flex-col md:gap-1">
        {ONGLETS.map(({ href, libelle, icone: Icone }) => {
          const courant = actif(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={courant ? 'page' : undefined}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 whitespace-nowrap text-[0.7rem] font-semibold md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:text-base ${
                  courant ? 'text-terre md:bg-terre-clair' : 'text-doux md:hover:bg-surface-2'
                }`}
              >
                <Icone actif={courant} />
                {libelle}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto hidden md:block">
        <p className="px-3 text-sm text-doux">Connecté en tant que</p>
        <p className="px-3 font-semibold">{prenom}</p>
        <form action="/deconnexion" method="post" className="mt-1">
          <button type="submit" className="bouton bouton-discret w-full justify-start">
            Se déconnecter
          </button>
        </form>
      </div>
    </nav>
  );
}

/* Icônes au trait, décoratives : le libellé porte le sens. */

function base(actif: boolean) {
  return {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: actif ? 2.2 : 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

function MaisonIcone({ actif }: { actif: boolean }) {
  return (
    <svg {...base(actif)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

function ListeIcone({ actif }: { actif: boolean }) {
  return (
    <svg {...base(actif)}>
      <path d="m3.5 7 1.8 1.8L8.5 5.5M3.5 17l1.8 1.8L8.5 15.5" />
      <path d="M12 7h8.5M12 17h8.5" />
    </svg>
  );
}

function CalendrierIcone({ actif }: { actif: boolean }) {
  return (
    <svg {...base(actif)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function DossierIcone({ actif }: { actif: boolean }) {
  return (
    <svg {...base(actif)}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h3.4a2 2 0 0 1 1.5.7l1 1.3h7.1a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function TelephoneIcone({ actif }: { actif: boolean }) {
  return (
    <svg {...base(actif)}>
      <path d="M6.6 3.5h2.2l1.6 4-2 1.4a12.5 12.5 0 0 0 6.7 6.7l1.4-2 4 1.6v2.2a2 2 0 0 1-2.2 2A16.4 16.4 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />
    </svg>
  );
}

function PersonnesIcone({ actif }: { actif: boolean }) {
  return (
    <svg {...base(actif)}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M18 19.5c0-2.4-.9-4.2-2.4-5.2" />
    </svg>
  );
}
