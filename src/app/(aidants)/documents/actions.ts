'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { contexteAidant } from '@/server/session';
import { ajouterFichiers, creerDocument, effacer } from '@/server/stockage';
import {
  documentParId,
  modifierDocument,
  noter,
  supprimerDocument,
  supprimerFichier,
} from '@/server/store';
import { CATEGORIES_DOCUMENT } from '@/server/types';

export interface EtatDepot {
  statut: 'inactif' | 'ok' | 'erreur';
  message?: string;
}

const details = z.object({
  titre: z.string().trim().max(200),
  categorie: z.enum(CATEGORIES_DOCUMENT).default('autre'),
  notes: z
    .string()
    .trim()
    .transform((valeur) => valeur || null)
    .nullable(),
});

/** Toutes les pièces d'un champ `<input type="file" multiple>`. */
function fichiersDe(donnees: FormData, champ = 'fichier'): File[] {
  return donnees
    .getAll(champ)
    .filter((valeur): valeur is File => valeur instanceof File && valeur.size > 0);
}

export async function deposerDocument(
  _precedent: EtatDepot,
  donnees: FormData,
): Promise<EtatDepot> {
  const { membre, foyer } = await contexteAidant();

  const fichiers = fichiersDe(donnees);
  if (fichiers.length === 0) {
    return { statut: 'erreur', message: 'Choisissez au moins un fichier.' };
  }

  const analyse = details.safeParse({
    titre: donnees.get('titre') ?? '',
    categorie: donnees.get('categorie') ?? 'autre',
    notes: donnees.get('notes') ?? '',
  });
  if (!analyse.success) return { statut: 'erreur', message: 'Saisie incorrecte.' };

  // Sans intitulé, le nom du premier fichier fait l'affaire : mieux vaut un
  // document rangé sous « scan_20260808.pdf » qu'un document jamais déposé.
  const titre = analyse.data.titre || (fichiers[0]?.name ?? 'Document').replace(/\.[^.]+$/, '');

  const resultat = await creerDocument(fichiers, {
    foyerId: foyer.id,
    titre,
    categorie: analyse.data.categorie,
    notes: analyse.data.notes,
    ajoutePar: membre.id,
  });
  if (!resultat.ok) return { statut: 'erreur', message: resultat.message };

  await noter(foyer.id, membre.id, 'a déposé un document', titre);
  revalidatePath('/documents');
  revalidatePath('/');
  return {
    statut: 'ok',
    message:
      fichiers.length === 1 ? 'Document ajouté.' : `Document ajouté (${fichiers.length} pièces).`,
  };
}

/**
 * Modifie le titre, la catégorie et les notes — sans toucher aux pièces.
 *
 * Ranger un document dans la mauvaise catégorie ne doit pas obliger à le
 * supprimer et à le redéposer : c'est une correction d'étiquette, pas un
 * nouveau document.
 */
export async function enregistrerDetails(
  _precedent: EtatDepot,
  donnees: FormData,
): Promise<EtatDepot> {
  const { membre, foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');

  const analyse = details.safeParse({
    titre: donnees.get('titre') ?? '',
    categorie: donnees.get('categorie') ?? 'autre',
    notes: donnees.get('notes') ?? '',
  });
  if (!id || !analyse.success) return { statut: 'erreur', message: 'Saisie incorrecte.' };
  if (!analyse.data.titre) {
    return { statut: 'erreur', message: 'Le titre ne peut pas être vide.' };
  }

  const avant = await documentParId(id, foyer.id);
  if (!avant) return { statut: 'erreur', message: 'Document introuvable.' };

  await modifierDocument(id, foyer.id, {
    titre: analyse.data.titre,
    categorie: analyse.data.categorie,
    notes: analyse.data.notes,
  });
  await noter(foyer.id, membre.id, 'a modifié un document', analyse.data.titre);

  revalidatePath('/documents');
  revalidatePath('/');
  return { statut: 'ok', message: 'Modifications enregistrées.' };
}

export async function ajouterPieces(
  _precedent: EtatDepot,
  donnees: FormData,
): Promise<EtatDepot> {
  const { membre, foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');

  const document = id ? await documentParId(id, foyer.id) : null;
  if (!document) return { statut: 'erreur', message: 'Document introuvable.' };

  const fichiers = fichiersDe(donnees);
  if (fichiers.length === 0) {
    return { statut: 'erreur', message: 'Choisissez au moins un fichier.' };
  }

  const resultat = await ajouterFichiers(fichiers, { foyerId: foyer.id, documentId: id });
  if (!resultat.ok) return { statut: 'erreur', message: resultat.message };

  await noter(foyer.id, membre.id, 'a ajouté une pièce à', document.titre);
  revalidatePath('/documents');
  return {
    statut: 'ok',
    message: fichiers.length === 1 ? 'Pièce ajoutée.' : `${fichiers.length} pièces ajoutées.`,
  };
}

export async function retirerPiece(donnees: FormData): Promise<void> {
  const { membre, foyer } = await contexteAidant();
  const fichierId = String(donnees.get('fichierId') ?? '');
  if (!fichierId) return;

  // `supprimerFichier` refuse de retirer la dernière pièce d'un dossier : on
  // ne supprime pas un document entier par un bouton « retirer cette pièce ».
  const retire = await supprimerFichier(fichierId, foyer.id);
  if (!retire) return;

  await effacer(retire.cle);
  await noter(foyer.id, membre.id, 'a retiré une pièce', null);
  revalidatePath('/documents');
}

export async function retirerDocument(donnees: FormData): Promise<void> {
  const { membre, foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');
  if (!id) return;

  const document = await documentParId(id, foyer.id);
  // La ligne d'abord, les octets ensuite : dans l'autre ordre, un échec
  // laisserait un document listé mais illisible.
  const cles = await supprimerDocument(id, foyer.id);
  await Promise.all(cles.map(effacer));
  if (document) await noter(foyer.id, membre.id, 'a supprimé un document', document.titre);

  revalidatePath('/documents');
  revalidatePath('/');
}
