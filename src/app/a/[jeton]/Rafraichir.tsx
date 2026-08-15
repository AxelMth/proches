'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Recharge les données à intervalle régulier.
 *
 * La tablette reste allumée sur cette page toute la journée : sans cela, un
 * rendez-vous ajouté le matin par un aidant n'apparaîtrait jamais, et « Demain »
 * resterait affiché alors qu'on est passé au lendemain. On rafraîchit les
 * données côté Next plutôt que de recharger la page — pas de clignotement, pas
 * de perte de position dans la page.
 */
export function Rafraichir({ minutes = 5 }: { minutes?: number }) {
  const routeur = useRouter();

  useEffect(() => {
    const minuteur = setInterval(() => routeur.refresh(), minutes * 60_000);
    return () => clearInterval(minuteur);
  }, [routeur, minutes]);

  return null;
}
