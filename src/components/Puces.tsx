import {
  LIBELLES_CATEGORIE_CONTACT,
  LIBELLES_CATEGORIE_DOCUMENT,
  LIBELLES_CATEGORIE_EVENEMENT,
  type CategorieContact,
  type CategorieDocument,
  type CategorieEvenement,
} from '@/server/types';

/**
 * Pastilles de catégorie.
 *
 * La couleur ne porte jamais l'information seule : le libellé est toujours
 * écrit. C'est vrai pour les 8 % d'hommes daltoniens, et ça l'est tout autant
 * pour une tablette dont la luminosité est au minimum.
 */

const TONS_EVENEMENT: Record<CategorieEvenement, string> = {
  medical: 'bg-alerte-clair text-alerte',
  visite: 'bg-sauge-clair text-sauge',
  aide: 'bg-terre-clair text-terre',
  administratif: 'bg-ambre-clair text-ambre',
  autre: 'bg-surface-2 text-doux',
};

export function PuceEvenement({ categorie }: { categorie: CategorieEvenement }) {
  return (
    <span className={`puce ${TONS_EVENEMENT[categorie]}`}>
      {LIBELLES_CATEGORIE_EVENEMENT[categorie]}
    </span>
  );
}

const TONS_DOCUMENT: Record<CategorieDocument, string> = {
  sante: 'bg-alerte-clair text-alerte',
  administratif: 'bg-ambre-clair text-ambre',
  finances: 'bg-sauge-clair text-sauge',
  logement: 'bg-terre-clair text-terre',
  assurance: 'bg-surface-2 text-doux',
  autre: 'bg-surface-2 text-doux',
};

export function PuceDocument({ categorie }: { categorie: CategorieDocument }) {
  return (
    <span className={`puce ${TONS_DOCUMENT[categorie]}`}>
      {LIBELLES_CATEGORIE_DOCUMENT[categorie]}
    </span>
  );
}

const TONS_CONTACT: Record<CategorieContact, string> = {
  urgence: 'bg-alerte-clair text-alerte',
  medecin: 'bg-terre-clair text-terre',
  specialiste: 'bg-terre-clair text-terre',
  pharmacie: 'bg-sauge-clair text-sauge',
  soins: 'bg-sauge-clair text-sauge',
  aide: 'bg-ambre-clair text-ambre',
  famille: 'bg-surface-2 text-doux',
  autre: 'bg-surface-2 text-doux',
};

export function PuceContact({ categorie }: { categorie: CategorieContact }) {
  return (
    <span className={`puce ${TONS_CONTACT[categorie]}`}>
      {LIBELLES_CATEGORIE_CONTACT[categorie]}
    </span>
  );
}

/** Bandeau d'erreur d'une action, rendu au même endroit partout. */
export function Alerte({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-xl bg-alerte-clair px-3 py-2 text-sm font-semibold text-alerte"
    >
      {children}
    </p>
  );
}

/** État vide — dit ce qui manque *et* ce qu'on peut faire. */
export function Vide({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed px-4 py-6 text-center text-doux">{children}</p>
  );
}
