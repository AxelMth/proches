import { affichableEnLigne, nomSur } from './formats';

/**
 * Réponse HTTP servant les octets d'un document.
 *
 * Deux appelants (les aidants connectés, la vue de la personne accompagnée)
 * pour une seule construction de réponse : les en-têtes de sécurité ci-dessous
 * doivent être identiques dans les deux cas, et un fichier servi depuis notre
 * propre origine est exactement l'endroit où l'on paie une divergence.
 *
 *  - `nosniff` : sans lui, un navigateur peut décider qu'un fichier déclaré
 *    `image/png` est en réalité du HTML, et l'exécuter dans notre origine.
 *  - `default-src 'none'` : le document ne peut charger aucune ressource
 *    extérieure. `base-uri` et `form-action` ferment les deux détournements
 *    classiques, `frame-ancestors 'self'` interdit à un site tiers de nous
 *    encadrer tout en autorisant nos propres aperçus.
 *  - `private, no-store` : ce sont des ordonnances et des avis d'imposition,
 *    ils n'ont rien à faire dans un cache partagé.
 *
 * Il n'y a **pas** de directive `sandbox`, et c'est un choix mesuré : elle
 * place la réponse dans une origine opaque, ce qui empêche le lecteur PDF
 * intégré des navigateurs de fonctionner — le fichier est alors téléchargé au
 * lieu de s'afficher, aperçus compris. La protection réelle est ailleurs, dans
 * la liste blanche de `formats.ts` : SVG et HTML, les seuls formats vraiment
 * actifs, n'entrent jamais. Le script éventuellement contenu dans un PDF,
 * lui, s'exécute déjà dans le processus isolé du lecteur, sans accès à notre
 * DOM ni à nos cookies.
 */
export function reponseDocument(
  document: { contenu: Buffer; nomFichier: string; typeMime: string },
  telecharger: boolean,
): Response {
  const disposition = telecharger || !affichableEnLigne(document.typeMime)
    ? 'attachment'
    : 'inline';
  const nom = nomSur(document.nomFichier);

  return new Response(new Uint8Array(document.contenu), {
    headers: {
      'content-type': document.typeMime,
      'content-length': String(document.contenu.byteLength),
      'content-disposition': `${disposition}; filename="${nom}"; filename*=UTF-8''${encodeURIComponent(nom)}`,
      'x-content-type-options': 'nosniff',
      'content-security-policy':
        "default-src 'none'; object-src 'self'; base-uri 'none'; form-action 'none'; " +
        "frame-ancestors 'self'",
      'cache-control': 'private, no-store',
    },
  });
}
