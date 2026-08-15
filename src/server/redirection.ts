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
  // Dernier filet avant l'en-tête, en plus des contrôles faits par les appelants.
  return new NextResponse(null, {
    status: statut,
    headers: { location: cheminInterne(chemin) },
  });
}

/** Base opaque : ce qui parvient à en sortir n'était pas une destination interne. */
const BASE_OPAQUE = 'https://proches.invalid';

/**
 * Ne garde d'une destination que ce qui reste sur ce domaine.
 *
 * Tout endroit où l'application redirige d'après une valeur venue de l'URL ou
 * d'un champ de formulaire passe par ici — sinon on offre une redirection
 * ouverte, c'est-à-dire une page d'hameçonnage hébergée par notre propre
 * domaine, atteinte juste après une connexion réussie.
 *
 * **Tester `startsWith('/')` ne suffit pas**, et c'est le piège de cette
 * fonction. Le parseur d'URL des navigateurs traite `\` comme `/` sur un schéma
 * spécial : `/\exemple.fr` est résolu en `https://exemple.fr/`. Il supprime
 * aussi les tabulations et les retours ligne avant d'analyser. On laisse donc
 * le parseur trancher plutôt que de deviner à coups de préfixes.
 *
 * Et une fois qu'il a tranché, il reste un cas à couvrir : `/..//exemple.fr`
 * reste bien sur notre origine, mais son *chemin* est `//exemple.fr` — que le
 * navigateur relira comme une URL protocol-relative si on le lui rend tel quel.
 * D'où le refus explicite des chemins commençant par `//`.
 */
export function cheminInterne(suite?: string | null): string {
  if (!suite) return '/';

  let url: URL;
  try {
    url = new URL(suite, BASE_OPAQUE);
  } catch {
    return '/';
  }

  if (url.origin !== BASE_OPAQUE) return '/';

  const chemin = `${url.pathname}${url.search}${url.hash}`;
  return chemin.startsWith('//') ? '/' : chemin;
}
