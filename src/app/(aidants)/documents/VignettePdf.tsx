'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Vignette de la première page d'un PDF, rendue dans un canevas par pdf.js.
 *
 * ## Pourquoi pas un `<iframe>`
 *
 * C'était la solution évidente, et elle a été essayée : elle s'appuie sur le
 * lecteur PDF intégré du navigateur, qui n'est pas garanti. Là où il manque,
 * l'aperçu devient un rectangle noir. Ici on décode nous-mêmes et on peint des
 * pixels — il n'y a plus de lecteur à espérer.
 *
 * ## Ce que ça coûte, et comment on ne le paie pas
 *
 * pdf.js pèse ~350 ko. Il n'est donc **jamais** dans le paquet initial : le
 * module n'est importé qu'au moment où une vignette entre dans le champ de
 * vision (`IntersectionObserver`). Ouvrir la page en vue « liste » ou « cartes »,
 * ou n'avoir que des images, ne le charge pas du tout ; le charger une fois
 * sert ensuite toutes les vignettes de la page.
 *
 * C'est la version `legacy` qui est importée : la version courante suppose
 * `Promise.withResolvers`, absent de Safari avant 17.4 — soit exactement le
 * genre d'iPad qui traîne dans une famille.
 *
 * ## En cas d'échec
 *
 * PDF chiffré, corrompu, mémoire insuffisante : on retombe sur `children` —
 * la tuile typée d'avant, rendue côté serveur et passée telle quelle. Un
 * aperçu est une commodité, il ne doit jamais faire disparaître le lien vers
 * le fichier.
 */
export function VignettePdf({
  src,
  alt,
  classe,
  children,
}: {
  src: string;
  alt: string;
  /** Le cadre **sans fond** : la vignette pose le sien selon son état. */
  classe: string;
  /** Repli si le rendu échoue — la tuile typée. */
  children: React.ReactNode;
}) {
  const canevas = useRef<HTMLCanvasElement>(null);
  const [etat, setEtat] = useState<'attente' | 'rendu' | 'echec'>('attente');

  useEffect(() => {
    const element = canevas.current;
    if (!element) return;

    let annule = false;
    let observateur: IntersectionObserver | null = null;
    /** Gardée pour couper le worker si le composant part avant la fin. */
    let tache: import('pdfjs-dist').PDFDocumentLoadingTask | null = null;

    const dessiner = async (): Promise<void> => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

        // Le worker est servi depuis notre propre origine — aucune requête
        // vers un CDN, ici comme partout ailleurs dans ce projet. Webpack le
        // reconnaît à cette forme et l'émet dans `/_next/static`.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();

        tache = pdfjs.getDocument({
          url: src,
          // La route `/api/fichiers/…` vérifie la session : la requête doit
          // porter le cookie. Même origine, mais pdf.js passe par XHR et ne
          // l'envoie pas de lui-même.
          withCredentials: true,

          // Les glyphes sont tracés dans le canevas plutôt qu'injectés en
          // `@font-face` dans la page. Pour une vignette c'est ce qu'on veut —
          // rien à installer dans le document, rien à attendre du chargement
          // des polices, et un rendu qui ne dépend pas de `document.fonts`
          // (observé bloqué indéfiniment dans un environnement sans fenêtre).
          disableFontFace: true,

          // Ces deux chemins sont recopiés depuis `pdfjs-dist` par
          // `scripts/pdfjs-assets.mjs`, et servis depuis `public/`.
          //
          //  * `standardFontDataUrl` : les PDF qui n'embarquent pas leurs
          //    polices — Helvetica, Times — sont légion (formulaires, devis).
          //    Sans lui, leur page se peint blanche : pire que la tuile typée,
          //    puisqu'elle ne dit même plus qu'il y a un fichier.
          //  * `wasmUrl` : JBIG2 et JPEG 2000, les deux codecs des scanners.
          //    C'est exactement ce que produit un compte rendu numérisé.
          standardFontDataUrl: '/pdfjs/standard_fonts/',
          wasmUrl: '/pdfjs/wasm/',
        });
        const document = await tache.promise;

        if (annule) return;

        const page = await document.getPage(1);

        // On peint à la taille réelle du cadre, densité d'écran comprise :
        // sans cela la vignette est floue sur tout écran Retina.
        const cadre = element.getBoundingClientRect();
        const densite = Math.min(window.devicePixelRatio || 1, 2);
        const naturelle = page.getViewport({ scale: 1 });
        const echelle = (cadre.width / naturelle.width) * densite;
        const vue = page.getViewport({ scale: echelle });

        element.width = Math.max(1, Math.floor(vue.width));
        element.height = Math.max(1, Math.floor(vue.height));

        await page.render({ canvas: element, viewport: vue }).promise;

        if (!annule) setEtat('rendu');
      } catch {
        if (!annule) setEtat('echec');
      }
    };

    const lancer = (): void => {
      observateur?.disconnect();
      observateur = null;
      void dessiner();
    };

    // 200 px d'avance, dans les deux mécanismes : la vignette est prête avant
    // d'arriver à l'écran.
    const MARGE = 200;

    // Déjà à l'écran au montage : on n'attend pas le premier passage de
    // l'observateur. C'est le cas courant — les premières vignettes de la page
    // — et cela rend le composant indépendant d'un `IntersectionObserver` qui
    // tarde ou ne rapporte rien, ce que font certains environnements sans
    // fenêtre réelle.
    const position = element.getBoundingClientRect();
    if (position.top < window.innerHeight + MARGE && position.bottom > -MARGE) {
      lancer();
    } else {
      observateur = new IntersectionObserver(
        (entrees) => {
          if (entrees.some((entree) => entree.isIntersecting)) lancer();
        },
        { rootMargin: `${MARGE}px` },
      );
      observateur.observe(element);
    }

    return () => {
      annule = true;
      observateur?.disconnect();
      void tache?.destroy();
    };
  }, [src]);

  if (etat === 'echec') return <>{children}</>;

  return (
    <canvas
      ref={canevas}
      role="img"
      aria-label={alt}
      // Une fois peinte, la page est blanche : le cadre doit l'être aussi,
      // sinon un liseré beige apparaît autour d'elle. Tant que rien n'est
      // peint, le fond reste celui des autres tuiles.
      className={`${classe} object-contain ${etat === 'rendu' ? 'bg-surface' : 'bg-surface-2'}`}
    />
  );
}
