'use client';

import { useFormStatus } from 'react-dom';

/**
 * Bouton de soumission qui se désactive pendant l'envoi.
 *
 * Sans cela, un double-clic sur « Ajouter » crée deux tâches — et sur une
 * connexion lente, c'est le réflexe naturel de tout le monde.
 */
export function BoutonSoumettre({
  children,
  enCours,
  desactive = false,
  className = 'bouton',
  ...reste
}: {
  children: React.ReactNode;
  enCours?: string;
  /** Bloque l'envoi pour une raison métier — une pièce trop lourde, par exemple. */
  desactive?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'disabled'>) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending || desactive} {...reste}>
      {pending ? (enCours ?? 'Envoi…') : children}
    </button>
  );
}
