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

import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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

// Créé avant tout le reste, y compris avant d'abandonner faute de pdfjs-dist :
// le Dockerfile fait `COPY /app/public ./public`, et un `public/` absent ferait
// échouer le build entier — pour une commodité d'affichage.
await mkdir(cible, { recursive: true });

if (!(await existe(source))) {
  // Pas une erreur : `pnpm install` n'a peut-être pas encore tourné. Échouer
  // ici casserait un `pnpm dev` qui, sans vignette de PDF, marcherait très
  // bien — le composant retombe sur sa tuile typée.
  console.warn('[pdfjs] pdfjs-dist absent, ressources non recopiées.');
  process.exit(0);
}

/**
 * La version de pdfjs-dist sert de sceau, et il n'est posé qu'une fois les
 * deux dossiers ENTIÈREMENT recopiés.
 *
 * Comparer les dates de modification ne marchait pas : la mtime d'un dossier
 * remonte dès qu'on y crée une entrée, si bien qu'une copie interrompue
 * laissait un dossier partiel *plus récent* que sa source — donc considéré à
 * jour pour toujours, et expédié tel quel en production. Une copie interrompue
 * ne laisse aucun sceau, et le passage suivant repart de zéro.
 */
const { version } = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
const sceau = path.join(cible, '.version');
const pose = await readFile(sceau, 'utf8').catch(() => null);

if (pose === version) process.exit(0);

for (const dossier of DOSSIERS) {
  const depuis = path.join(source, dossier);
  const vers = path.join(cible, dossier);

  if (!(await existe(depuis))) {
    console.warn(`[pdfjs] ${dossier} introuvable dans pdfjs-dist.`);
    continue;
  }

  // On efface avant de recopier : sans cela, les restes d'une version
  // précédente survivraient à côté des nouveaux fichiers.
  await rm(vers, { recursive: true, force: true });
  await cp(depuis, vers, { recursive: true });
}

await writeFile(sceau, version);
console.log(`[pdfjs] ressources de pdfjs-dist ${version} recopiées sous public/pdfjs/.`);
