import fs from 'node:fs';
import path from 'node:path';

/**
 * Charge `.env.local` puis `.env` dans `process.env`.
 *
 * Next le fait tout seul pour l'application ; les scripts lancés par
 * `vite-node`, eux, démarrent avec un environnement nu. Cinquante lignes ici
 * évitent une dépendance de plus.
 *
 * Une variable déjà définie n'est jamais écrasée : `DATABASE_URL=… pnpm
 * db:migrate` doit pouvoir viser une autre base sans toucher aux fichiers.
 */

function charger(fichier: string): void {
  if (!fs.existsSync(fichier)) return;

  for (const ligne of fs.readFileSync(fichier, 'utf8').split('\n')) {
    const nette = ligne.trim();
    if (!nette || nette.startsWith('#')) continue;

    const separateur = nette.indexOf('=');
    if (separateur <= 0) continue;

    const cle = nette.slice(0, separateur).trim();
    if (process.env[cle] !== undefined) continue;

    let valeur = nette.slice(separateur + 1).trim();
    if (
      (valeur.startsWith('"') && valeur.endsWith('"')) ||
      (valeur.startsWith("'") && valeur.endsWith("'"))
    ) {
      valeur = valeur.slice(1, -1);
    }
    process.env[cle] = valeur;
  }
}

const racine = process.cwd();
charger(path.join(racine, '.env.local'));
charger(path.join(racine, '.env'));
