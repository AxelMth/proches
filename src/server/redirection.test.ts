import { describe, expect, it } from 'vitest';
import { cheminInterne } from './redirection';

/**
 * Ces cas viennent d'une relecture qui a trouvé le filtre précédent —
 * `startsWith('/') && !startsWith('//')` — contournable. Ils sont ici pour que
 * personne ne le réintroduise en croyant simplifier.
 */
describe('cheminInterne', () => {
  it('laisse passer une destination interne, avec sa requête et son ancre', () => {
    expect(cheminInterne('/contacts')).toBe('/contacts');
    expect(cheminInterne('/documents?vue=apercu')).toBe('/documents?vue=apercu');
    expect(cheminInterne('/agenda#mars')).toBe('/agenda#mars');
  });

  it('refuse l’antislash, que le navigateur relit comme une barre', () => {
    // `new URL('/\\exemple.fr', base)` est résolu en https://exemple.fr/ :
    // le parseur d'URL traite `\` comme `/` sur un schéma spécial.
    expect(cheminInterne('/\\exemple.fr')).toBe('/');
    expect(cheminInterne('\\\\exemple.fr')).toBe('/');
    expect(cheminInterne('/\\/exemple.fr')).toBe('/');
  });

  it('refuse une URL protocol-relative, y compris fabriquée par remontée', () => {
    expect(cheminInterne('//exemple.fr')).toBe('/');
    // Celui-ci reste sur notre origine, mais son *chemin* est `//exemple.fr` :
    // rendu tel quel, le navigateur le relirait comme protocol-relative.
    expect(cheminInterne('/..//exemple.fr')).toBe('/');
  });

  it('refuse une destination absolue vers un autre domaine', () => {
    expect(cheminInterne('https://exemple.fr/piege')).toBe('/');
    expect(cheminInterne('http://exemple.fr')).toBe('/');
    expect(cheminInterne('javascript:alert(1)')).toBe('/');
  });

  it('refuse ce qui est vide, absent ou illisible', () => {
    expect(cheminInterne('')).toBe('/');
    expect(cheminInterne(null)).toBe('/');
    expect(cheminInterne(undefined)).toBe('/');
  });

  it('neutralise les blancs que le parseur supprime avant analyse', () => {
    // Une tabulation au milieu ne doit pas servir à masquer une cible.
    expect(cheminInterne('/\tcontacts')).toBe('/contacts');
    expect(cheminInterne('/\t/exemple.fr')).toBe('/');
  });
});
