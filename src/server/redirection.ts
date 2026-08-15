import { NextResponse } from 'next/server';

/**
 * Redirection vers une page de l'application, depuis un *route handler*.
 *
 * L'en-tête `Location` est volontairement **relatif**. `NextResponse.redirect`
 * exige une URL absolue, ce qui pousse à écrire `new URL(chemin, requete.url)`
 * — et c'est un piège en production : dans l'image issue de
 * `output: 'standalone'`, `requete.url` porte l'adresse d'écoute du conteneur,
 * pas le domaine public. Derrière le proxy de Fly, le lien de connexion reçu
 * par courriel renvoyait ainsi vers `https://0.0.0.0:3000/`.
 *
 * Une `Location` relative (RFC 9110 §10.2.2) est résolue par le navigateur
 * contre l'URL qu'il a réellement demandée. Elle est donc juste quel que soit
 * le domaine, sans dépendre d'aucune variable d'environnement — c'est
 * exactement ce que fait `redirect()` de `next/navigation`, qui n'a jamais eu
 * le problème.
 */
export function versInterne(chemin: string, statut: 302 | 303 | 307 = 303): NextResponse {
  // `//exemple.fr` est une URL protocol-relative : acceptée comme « chemin »,
  // elle enverrait l'utilisateur sur un autre domaine. Dernier filet avant
  // l'en-tête, en plus des contrôles faits par les appelants.
  const sur = chemin.startsWith('/') && !chemin.startsWith('//') ? chemin : '/';

  return new NextResponse(null, { status: statut, headers: { location: sur } });
}
