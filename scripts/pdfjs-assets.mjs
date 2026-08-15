#!/usr/bin/env node
//
// Recopie sous `public/pdfjs/` les deux jeux de ressources que pdf.js va
// chercher **par HTTP, au moment d'en avoir besoin** — et qu'un empaqueteur ne
// peut donc pas tracer depuis le code.
//
//  * `standard_fonts/` — les 14 polices dites standard (Helvetica, Times,
//    Courier…). Un PDF a le droit de ne pas les embarquer, et beaucoup ne le
//    font pas : formulaires administratifs, devis, courriers générés. Sans
//    elles, la vignette se peint blanche.
//  * `wasm/` — les décodeurs JBIG2 et JPEG 2000, soit exactement ce que
//    produisent les scanners. C'est le format d'un compte rendu numérisé.
//
// Rien n'est fait si les fichiers sont déjà en place et à jour : le script
// tourne avant chaque `dev` et chaque `build`, il doit être instantané au
// deuxième passage. `public/pdfjs/` est ignoré par git — c'est une copie, la
// source est dans `node_modules`.
//
// Ces deux dossiers pèsent 2,3 Mo en tout. Ils ne sont **pas** téléchargés par
// le navigateur à l'ouverture de la page : pdf.js ne demande une police ou un
// décodeur qu'au moment précis où un document en réclame un.

import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(racine, 'node_modules', 'pdfjs-dist');
const cible = path.join(racine, 'public', 'pdfjs');

const DOSSIERS = ['standard_fonts', 'wasm'];

async function existe(chemin) {
  try {
    await stat(chemin);
    return true;
  } catch {
    return false;
  }
}

if (!(await existe(source))) {
  // Pas une erreur : `pnpm install` n'a peut-être pas encore tourné. Échouer
  // ici casserait un `pnpm dev` qui, sans vignette de PDF, marcherait très
  // bien — le composant retombe sur sa tuile typée.
  console.warn('[pdfjs] pdfjs-dist absent, ressources non recopiées.');
  process.exit(0);
}

await mkdir(cible, { recursive: true });

let recopies = 0;
for (const dossier of DOSSIERS) {
  const depuis = path.join(source, dossier);
  const vers = path.join(cible, dossier);

  if (!(await existe(depuis))) {
    console.warn(`[pdfjs] ${dossier} introuvable dans pdfjs-dist.`);
    continue;
  }

  // `force: false` ne suffirait pas à détecter une mise à jour de pdfjs-dist :
  // on compare les dates, et on recopie tout dès que la source est plus
  // récente. Un dossier de moins d'un mégaoctet, la copie coûte quelques
  // millisecondes.
  const [dateSource, dateCible] = await Promise.all([
    stat(depuis).then((s) => s.mtimeMs),
    stat(vers).then((s) => s.mtimeMs, () => 0),
  ]);
  if (dateCible >= dateSource) continue;

  await cp(depuis, vers, { recursive: true });
  recopies += 1;
}

if (recopies > 0) console.log(`[pdfjs] ${recopies} dossier(s) recopié(s) sous public/pdfjs/.`);
