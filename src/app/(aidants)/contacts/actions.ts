'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { contexteAidant } from '@/server/session';
import {
  contactParId,
  insererContact,
  modifierContact,
  noter,
  supprimerContact,
} from '@/server/store';
import { CATEGORIES_CONTACT } from '@/server/types';

export interface EtatFormulaire {
  message?: string;
}

const optionnel = z
  .string()
  .trim()
  .transform((valeur) => valeur || null)
  .nullable();

/**
 * Le numéro est gardé tel quel — on ne reformate pas la saisie de quelqu'un.
 *
 * Le seul contrôle est qu'il reste au moins deux chiffres : un `tel:` vide ne
 * compose rien, et un champ où quelqu'un a écrit « à demander » se découvrirait
 * le jour où l'on appuie dessus. Deux chiffres, et non trois, parce que le 15
 * et le 18 sont des numéros valides.
 */
const telephone = z
  .string()
  .trim()
  .min(1, 'Il faut un numéro — c’est tout l’intérêt de la fiche.')
  .max(40)
  .refine((valeur) => (valeur.match(/\d/g)?.length ?? 0) >= 2, 'Ce numéro ne ressemble à rien.');

const schema = z.object({
  nom: z.string().trim().min(1, 'Il faut un nom.').max(120),
  categorie: z.enum(CATEGORIES_CONTACT).default('autre'),
  telephone,
  email: optionnel.refine(
    (valeur) => valeur === null || z.string().email().safeParse(valeur).success,
    'Cette adresse électronique ne semble pas valide.',
  ),
  adresse: optionnel,
  notes: optionnel,
});

function lire(donnees: FormData) {
  return schema.safeParse({
    nom: donnees.get('nom') ?? '',
    categorie: donnees.get('categorie') ?? 'autre',
    telephone: donnees.get('telephone') ?? '',
    email: donnees.get('email') ?? '',
    adresse: donnees.get('adresse') ?? '',
    notes: donnees.get('notes') ?? '',
  });
}

/**
 * Seule la page des aidants est invalidée. La tablette de la personne
 * accompagnée n'a rien à recevoir d'ici : elle est rendue à la demande et se
 * rafraîchit d'elle-même toutes les cinq minutes (`Rafraichir`), sur un autre
 * appareil que celui qui vient de saisir le numéro.
 */
export async function ajouterContact(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const { membre, foyer } = await contexteAidant();
  const analyse = lire(donnees);

  if (!analyse.success) {
    return { message: analyse.error.issues[0]?.message ?? 'Saisie incorrecte.' };
  }

  await insererContact({ foyerId: foyer.id, ...analyse.data, creePar: membre.id });
  await noter(foyer.id, membre.id, 'a ajouté un contact', analyse.data.nom);

  revalidatePath('/contacts');
  return {};
}

export async function enregistrerContact(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const { membre, foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');
  const analyse = lire(donnees);

  // Le message précis d'abord : « Ce numéro ne ressemble à rien » se corrige,
  // « Saisie incorrecte » laisse chercher lequel des six champs est en cause.
  if (!analyse.success) {
    return { message: analyse.error.issues[0]?.message ?? 'Saisie incorrecte.' };
  }
  if (!id) return { message: 'Contact introuvable.' };

  await modifierContact(id, foyer.id, analyse.data);
  await noter(foyer.id, membre.id, 'a modifié un contact', analyse.data.nom);

  revalidatePath('/contacts');
  return {};
}

export async function retirerContact(donnees: FormData): Promise<void> {
  const { membre, foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');
  if (!id) return;

  const contact = await contactParId(id, foyer.id);
  await supprimerContact(id, foyer.id);
  if (contact) await noter(foyer.id, membre.id, 'a supprimé un contact', contact.nom);

  revalidatePath('/contacts');
}
