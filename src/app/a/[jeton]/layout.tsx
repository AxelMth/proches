import { Rafraichir } from './Rafraichir';

/**
 * Coquille de la vue lue par la personne accompagnée.
 *
 * `vue-senior` porte la taille de base (24 px) et l'interlignage. Aucune
 * navigation, aucun en-tête : la page est ouverte depuis un favori et n'a
 * qu'une destination, ses documents.
 */
export default function LayoutVueSenior({ children }: { children: React.ReactNode }) {
  return (
    <div className="vue-senior mx-auto w-full max-w-2xl px-5 py-8">
      {children}
      <Rafraichir />
    </div>
  );
}
