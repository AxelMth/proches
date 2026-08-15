'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { contexteAidant } from '@/server/session';
import {
  basculerTache,
  insererTache,
  modifierTache,
  noter,
  supprimerTache,
  tacheParId,
} from '@/server/store';

export interface EtatFormulaire {
  message?: string;
}

/** `''` arrive de tout `<select>` ou `<input>` vide ; en base c'est `null`. */
const optionnel = z
  .string()
  .trim()
  .transform((valeur) => valeur || null)
  .nullable();

const schemaTache = z.object({
  titre: z.string().trim().min(1, 'Il faut au moins un intitulé.').max(200),
  details: optionnel,
  echeance: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.')
    .or(z.literal(''))
    .transform((valeur) => valeur || null),
  priorite: z.enum(['normale', 'haute']).default('normale'),
  assigneeId: optionnel,
});

function lire(donnees: FormData) {
  return schemaTache.safeParse({
    titre: donnees.get('titre') ?? '',
    details: donnees.get('details') ?? '',
    echeance: donnees.get('echeance') ?? '',
    priorite: donnees.get('priorite') ?? 'normale',
    assigneeId: donnees.get('assigneeId') ?? '',
  });
}

export async function ajouterTache(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const { membre, foyer } = await contexteAidant();
  const analyse = lire(donnees);

  if (!analyse.success) {
    return { message: analyse.error.issues[0]?.message ?? 'Saisie incorrecte.' };
  }

  await insererTache({ foyerId: foyer.id, ...analyse.data, creePar: membre.id });
  await noter(foyer.id, membre.id, 'a ajouté une tâche', analyse.data.titre);

  revalidatePath('/taches');
  revalidatePath('/');
  return {};
}

export async function enregistrerTache(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const { membre, foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');
  const analyse = lire(donnees);

  if (!id || !analyse.success) {
    return { message: analyse.success ? 'Tâche introuvable.' : 'Saisie incorrecte.' };
  }

  await modifierTache(id, foyer.id, analyse.data);
  await noter(foyer.id, membre.id, 'a modifié une tâche', analyse.data.titre);

  revalidatePath('/taches');
  revalidatePath('/');
  return {};
}

/**
 * Coche ou décoche. Le nom de qui a coché est conservé : entre aidants, savoir
 * *qui* s'en est occupé vaut autant que savoir que c'est fait.
 */
export async function basculer(id: string): Promise<void> {
  const { membre, foyer } = await contexteAidant();

  const tache = await tacheParId(id, foyer.id);
  if (!tache) return;

  const faite = await basculerTache(id, foyer.id, membre.id);
  await noter(foyer.id, membre.id, faite ? 'a fait' : 'a rouvert', tache.titre);

  revalidatePath('/taches');
  revalidatePath('/');
}

export async function retirerTache(donnees: FormData): Promise<void> {
  const { membre, foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');
  if (!id) return;

  const tache = await tacheParId(id, foyer.id);
  await supprimerTache(id, foyer.id);
  if (tache) await noter(foyer.id, membre.id, 'a supprimé une tâche', tache.titre);

  revalidatePath('/taches');
  revalidatePath('/');
}
