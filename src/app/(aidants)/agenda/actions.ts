'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { instantDepuisLocal, midiUtc } from '@/server/dates';
import { contexteAidant } from '@/server/session';
import {
  evenementParId,
  insererEvenement,
  modifierEvenement,
  noter,
  supprimerEvenement,
} from '@/server/store';
import { CATEGORIES_EVENEMENT } from '@/server/types';

export interface EtatFormulaire {
  message?: string;
}

const optionnel = z
  .string()
  .trim()
  .transform((valeur) => valeur || null)
  .nullable();

const schema = z.object({
  titre: z.string().trim().min(1, 'Il faut un intitulé.').max(200),
  categorie: z.enum(CATEGORIES_EVENEMENT).default('autre'),
  lieu: optionnel,
  notes: optionnel,
  journeeEntiere: z.coerce.boolean().default(false),
  debut: z.string().trim().min(1, 'Il faut une date de début.'),
  fin: z.string().trim(),
});

/**
 * Convertit la saisie du formulaire en deux instants.
 *
 * Journée entière : on range midi UTC plutôt que minuit local — minuit à Paris
 * est 22 h la veille en UTC, et l'événement se retrouverait daté du jour
 * précédent dans le flux iCalendar. Voir `midiUtc`.
 *
 * Sinon : `<input type="datetime-local">` renvoie une heure murale sans fuseau,
 * qu'on interprète à Paris. Une fin absente ou antérieure au début devient
 * « début + 1 h » : c'est la durée par défaut d'un rendez-vous, et refuser la
 * saisie pour ça n'aiderait personne.
 */
function instants(entree: z.infer<typeof schema>):
  | { ok: true; debut: Date; fin: Date }
  | { ok: false; message: string } {
  if (entree.journeeEntiere) {
    const jourDebut = entree.debut.slice(0, 10);
    const jourFin = (entree.fin || entree.debut).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jourDebut)) {
      return { ok: false, message: 'Date invalide.' };
    }
    const debut = midiUtc(jourDebut);
    const fin = midiUtc(jourFin < jourDebut ? jourDebut : jourFin);
    return { ok: true, debut, fin };
  }

  const debut = instantDepuisLocal(entree.debut);
  if (Number.isNaN(debut.getTime())) {
    return { ok: false, message: 'Date ou heure invalide.' };
  }

  const finSaisie = entree.fin ? instantDepuisLocal(entree.fin) : null;
  const fin =
    finSaisie && !Number.isNaN(finSaisie.getTime()) && finSaisie > debut
      ? finSaisie
      : new Date(debut.getTime() + 60 * 60 * 1000);

  return { ok: true, debut, fin };
}

function lire(donnees: FormData) {
  return schema.safeParse({
    titre: donnees.get('titre') ?? '',
    categorie: donnees.get('categorie') ?? 'autre',
    lieu: donnees.get('lieu') ?? '',
    notes: donnees.get('notes') ?? '',
    journeeEntiere: donnees.get('journeeEntiere') === 'on',
    debut: donnees.get('debut') ?? '',
    fin: donnees.get('fin') ?? '',
  });
}

export async function ajouterEvenement(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const { membre, foyer } = await contexteAidant();
  const analyse = lire(donnees);
  if (!analyse.success) {
    return { message: analyse.error.issues[0]?.message ?? 'Saisie incorrecte.' };
  }

  const bornes = instants(analyse.data);
  if (!bornes.ok) return { message: bornes.message };

  await insererEvenement({
    foyerId: foyer.id,
    titre: analyse.data.titre,
    categorie: analyse.data.categorie,
    lieu: analyse.data.lieu,
    notes: analyse.data.notes,
    debut: bornes.debut,
    fin: bornes.fin,
    journeeEntiere: analyse.data.journeeEntiere,
    creePar: membre.id,
  });
  await noter(foyer.id, membre.id, 'a ajouté au calendrier', analyse.data.titre);

  revalidatePath('/agenda');
  revalidatePath('/');
  return {};
}

export async function enregistrerEvenement(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const { membre, foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');
  const analyse = lire(donnees);

  if (!id) return { message: 'Rendez-vous introuvable.' };
  if (!analyse.success) {
    return { message: analyse.error.issues[0]?.message ?? 'Saisie incorrecte.' };
  }

  const bornes = instants(analyse.data);
  if (!bornes.ok) return { message: bornes.message };

  await modifierEvenement(id, foyer.id, {
    titre: analyse.data.titre,
    categorie: analyse.data.categorie,
    lieu: analyse.data.lieu,
    notes: analyse.data.notes,
    debut: bornes.debut,
    fin: bornes.fin,
    journeeEntiere: analyse.data.journeeEntiere,
  });
  await noter(foyer.id, membre.id, 'a modifié un rendez-vous', analyse.data.titre);

  revalidatePath('/agenda');
  revalidatePath('/');
  return {};
}

export async function retirerEvenement(donnees: FormData): Promise<void> {
  const { membre, foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');
  if (!id) return;

  const evenement = await evenementParId(id, foyer.id);
  await supprimerEvenement(id, foyer.id);
  if (evenement) await noter(foyer.id, membre.id, 'a annulé', evenement.titre);

  revalidatePath('/agenda');
  revalidatePath('/');
}
