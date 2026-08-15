import { reponseDocument } from '@/server/reponseDocument';
import { lireFichier } from '@/server/stockage';
import { membreParJetonVue } from '@/server/store';

/**
 * Sert une pièce à la personne accompagnée.
 *
 * L'autorisation est le jeton du chemin, le même que celui de la page qui a
 * mené ici — la pièce n'est donc jamais plus accessible que la vue elle-même.
 * Un jeton renouvelé depuis la page Famille ferme immédiatement les deux.
 */
export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ jeton: string; id: string }> },
): Promise<Response> {
  const { jeton, id } = await contexte.params;

  const membre = await membreParJetonVue(jeton);
  if (!membre) return new Response('Introuvable', { status: 404 });

  const fichier = await lireFichier(id, membre.foyerId);
  if (!fichier) return new Response('Introuvable', { status: 404 });

  return reponseDocument(fichier, false);
}
