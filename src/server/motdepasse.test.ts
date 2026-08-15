import { describe, expect, it } from 'vitest';
import { doitEtreRehache, hacher, refus, verifier } from './motdepasse';

describe('hachage', () => {
  it('reconnaît le bon mot de passe et refuse les autres', async () => {
    const empreinte = await hacher('le chat dort sur le radiateur');

    expect(await verifier('le chat dort sur le radiateur', empreinte)).toBe(true);
    expect(await verifier('le chien dort sur le radiateur', empreinte)).toBe(false);
    expect(await verifier('', empreinte)).toBe(false);
  });

  it('sale chaque empreinte : deux fois le même mot de passe, deux empreintes', async () => {
    const [a, b] = await Promise.all([hacher('la même phrase'), hacher('la même phrase')]);

    expect(a).not.toBe(b);
    expect(await verifier('la même phrase', a)).toBe(true);
    expect(await verifier('la même phrase', b)).toBe(true);
  });

  it('porte ses paramètres, ce qui permettra de relever le coût', async () => {
    const empreinte = await hacher('une phrase quelconque');

    expect(empreinte.split('$').slice(0, 4)).toEqual(['scrypt', '32768', '8', '1']);
    expect(doitEtreRehache(empreinte)).toBe(false);
    expect(doitEtreRehache('scrypt$1024$8$1$c2Vs$ZW1wcmVpbnRl')).toBe(true);
  });

  it('normalise l’Unicode : « é » composé ou précomposé ouvrent la même porte', async () => {
    // U+00E9 d'un côté, « e » + U+0301 de l'autre. Deux suites d'octets
    // différentes pour un caractère que l'utilisateur voit identique — et deux
    // claviers qui produisent l'un ou l'autre.
    const empreinte = await hacher('café du matin ensoleillé');

    expect(await verifier('café du matin ensoleillé', empreinte)).toBe(true);
  });

  it('ne casse pas sur une empreinte illisible', async () => {
    expect(await verifier('peu importe', 'nimportequoi')).toBe(false);
    expect(await verifier('peu importe', '')).toBe(false);
    expect(await verifier('peu importe', 'scrypt$0$0$0$$')).toBe(false);
  });
});

describe('exigences', () => {
  it('impose une longueur, et rien de plus', () => {
    expect(refus('court')).toMatch(/10 caractères/);
    expect(refus('phrase assez longue')).toBeNull();

    // Pas de majuscule ni de chiffre exigés : ces règles produisent des mots
    // de passe notés sur un papier, pas des mots de passe solides.
    expect(refus('que des minuscules sans chiffre')).toBeNull();
  });

  it('refuse ce qui ne rentrerait pas en base', () => {
    expect(refus('a'.repeat(201))).toMatch(/trop long/);
  });
});
