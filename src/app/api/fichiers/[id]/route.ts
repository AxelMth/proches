import type { NextRequest } from 'next/server';
import { reponseDocument } from '@/server/reponseDocument';
import { membreConnecte } from '@/server/session';
import { lireFichier } from '@/server/stockage';

/**
 * Sert une pièce à un aidant connecté.
 *
 * Le foyer vient de la session, jamais de l'URL : un identifiant de fichier
 * seul ne donne accès à rien, et la requête en base repasse par le dossier
 * pour vérifier l'appartenance.
 *
 * `?telecharger=1` force l'enregistrement plutôt que l'affichage.
 */
export async function GET(
  requete: NextRequest,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const membre = await membreConnecte();
  if (!membre) return new Response('Non authentifié', { status: 401 });

  const { id } = await contexte.params;
  const fichier = await lireFichier(id, membre.foyerId);
  if (!fichier) return new Response('Introuvable', { status: 404 });

  return reponseDocument(fichier, requete.nextUrl.searchParams.has('telecharger'));
}
