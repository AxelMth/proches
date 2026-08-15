/**
 * Les numéros d'urgence nationaux.
 *
 * Ils ne sont pas en base, et c'est délibéré. Un répertoire d'urgence qu'il
 * faut d'abord penser à remplir est un répertoire vide le jour où il sert :
 * personne n'ouvre l'application un dimanche calme pour y saisir le 15. Ces
 * numéros sont les mêmes pour tout le monde, ils ne changent pas, ils sont donc
 * là dès la première ouverture, sans qu'on ait rien fait.
 *
 * Ce que le foyer ajoute, lui — le médecin traitant, la pharmacie du coin, la
 * voisine qui a un double des clés — vit dans la table `contact`.
 */

import { lienTelephone } from './types';

export interface NumeroUrgence {
  numero: string;
  nom: string;
  /** Quand l'appeler — un numéro d'urgence sans son usage se compose au hasard. */
  quand: string;
  /** Le 114 se joint par SMS, pas par la voix : le lien ouvre les messages. */
  parSms?: boolean;
  /**
   * Repris dans la vue de la personne accompagnée. Les sept ne le sont pas :
   * sur une tablette, une liste courte se parcourt, une longue se subit.
   */
  essentiel?: boolean;
}

export const NUMEROS_URGENCE: readonly NumeroUrgence[] = [
  {
    numero: '15',
    nom: 'SAMU',
    quand: 'Malaise, chute grave, urgence médicale',
    essentiel: true,
  },
  {
    numero: '18',
    nom: 'Pompiers',
    quand: 'Incendie, accident, secours à personne',
    essentiel: true,
  },
  {
    numero: '112',
    nom: 'Urgences',
    quand: 'Depuis un mobile, partout en Europe',
    essentiel: true,
  },
  {
    numero: '114',
    nom: 'Urgences par SMS',
    quand: 'Si l’on n’entend pas ou ne peut pas parler',
    parSms: true,
    essentiel: true,
  },
  {
    numero: '17',
    nom: 'Police, gendarmerie',
    quand: 'Danger immédiat, cambriolage',
  },
  {
    numero: '116 117',
    nom: 'Médecin de garde',
    quand: 'Le soir et le week-end, quand ce n’est pas vital',
  },
  {
    numero: '3977',
    nom: 'Maltraitance des personnes âgées',
    quand: 'Écoute et orientation, du lundi au vendredi',
  },
];

/** Les quatre repris sur la tablette de la personne accompagnée. */
export const URGENCES_ESSENTIELLES = NUMEROS_URGENCE.filter((urgence) => urgence.essentiel);

/** `tel:` — sauf le 114, où le lien doit ouvrir un message, pas un appel. */
export function lienUrgence(urgence: NumeroUrgence): string {
  return urgence.parSms ? `sms:${urgence.numero}` : lienTelephone(urgence.numero);
}
