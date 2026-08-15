import { describe, expect, it } from 'vitest';
import { formatTaille, formatTailleSup, nomSur, refusLot, refusPiece } from './formats';

const MO = 1024 * 1024;
const MAX = 25 * MO;

function piece(nom: string, taille: number, type: string) {
  return { name: nom, size: taille, type };
}

describe('refus d’une pièce', () => {
  it('accepte les formats attendus sous la limite', () => {
    expect(refusPiece(piece('scan.pdf', 5.6 * MO, 'application/pdf'), MAX)).toBeNull();
    expect(refusPiece(piece('photo.jpg', 2 * MO, 'image/jpeg'), MAX)).toBeNull();
    expect(refusPiece(piece('carte.heic', 3 * MO, 'image/heic'), MAX)).toBeNull();
  });

  it('refuse un fichier vide', () => {
    expect(refusPiece(piece('rien.pdf', 0, 'application/pdf'), MAX)).toContain('est vide');
  });

  it('donne un conseil APPLICABLE selon le format', () => {
    // Le défaut d'origine : « enregistrez en PDF » conseillé à propos d'un PDF.
    const pourPdf = refusPiece(piece('dossier.pdf', 30 * MO, 'application/pdf'), MAX) ?? '';
    expect(pourPdf).toContain('coupez-le en plusieurs morceaux');
    expect(pourPdf).not.toContain('enregistrez-la en PDF');

    const pourImage = refusPiece(piece('scan.jpg', 30 * MO, 'image/jpeg'), MAX) ?? '';
    expect(pourImage).toContain('Réduisez la résolution');
  });

  it('annonce une taille arrondie au supérieur, jamais égale à la limite', () => {
    const message = refusPiece(piece('juste.pdf', MAX + 1, 'application/pdf'), MAX) ?? '';
    expect(message).toContain('25,1 Mo');
    expect(message).toContain('la limite est 25,0 Mo');
  });

  it('refuse les formats actifs, qui sont la vraie surface d’attaque', () => {
    expect(refusPiece(piece('piege.svg', 1000, 'image/svg+xml'), MAX)).toContain('non accepté');
    expect(refusPiece(piece('piege.html', 1000, 'text/html'), MAX)).toContain('non accepté');
  });
});

describe('refus d’un lot', () => {
  it('accepte plusieurs pièces sous les deux plafonds', () => {
    expect(
      refusLot(
        [piece('recto.png', 2 * MO, 'image/png'), piece('verso.png', 2 * MO, 'image/png')],
        MAX,
      ),
    ).toBeNull();
  });

  it('signale la première pièce fautive', () => {
    const motif = refusLot(
      [piece('ok.pdf', MO, 'application/pdf'), piece('trop.pdf', 40 * MO, 'application/pdf')],
      MAX,
    );
    expect(motif).toContain('« trop.pdf »');
  });

  it('refuse un total trop lourd même si chaque pièce passe', () => {
    // Trois pièces de 20 Mo : chacune sous la limite, l'ensemble au-dessus.
    const lot = [1, 2, 3].map((n) => piece(`p${n}.pdf`, 20 * MO, 'application/pdf'));
    const motif = refusLot(lot, MAX, 50 * MO) ?? '';
    expect(motif).toContain('L’ensemble fait 60,0 Mo');
    expect(motif).toContain('en plusieurs fois');
  });

  it('un lot vide ne dit rien — c’est à l’appelant de l’exiger', () => {
    expect(refusLot([], MAX)).toBeNull();
  });
});

describe('formats d’affichage', () => {
  it('écrit les tailles à la française', () => {
    expect(formatTaille(512)).toBe('512 o');
    expect(formatTaille(2048)).toBe('2 ko');
    expect(formatTaille(5 * MO)).toBe('5,0 Mo');
    expect(formatTailleSup(5 * MO + 1)).toBe('5,1 Mo');
  });
});

describe('assainissement des noms de fichier', () => {
  it('retire ce qui permettrait d’injecter un en-tête HTTP', () => {
    expect(nomSur('or\r\ndonnance".pdf')).toBe('ordonnance.pdf');
    expect(nomSur('dossier/2026.pdf')).toBe('dossier-2026.pdf');
    expect(nomSur('   ')).toBe('document');
  });
});
