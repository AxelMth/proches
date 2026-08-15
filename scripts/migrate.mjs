import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * Applique `src/server/schema.sql`. Idempotent, rejouable sans risque : tout
 * est en `create ... if not exists`.
 *
 * **En JavaScript simple, et c'est délibéré.** Ce script doit tourner dans deux
 * mondes très différents :
 *
 *  - en développement, `pnpm db:migrate`, avec tout le dépôt sous la main ;
 *  - sur Fly, comme `release_command`, dans l'image de production — laquelle ne
 *    contient ni TypeScript, ni `vite-node`, ni les dépendances de
 *    développement. `output: 'standalone'` n'y recopie que ce que le serveur
 *    importe réellement, soit `next`, `react` et `pg`.
 *
 * Une version TypeScript aurait donc échoué exactement là où elle compte le
 * plus. Le prix à payer est de n'utiliser ici que `pg` et la bibliothèque
 * standard de Node.
 *
 * Fly interrompt le déploiement si ce script sort en erreur : une migration qui
 * échoue ne laisse jamais passer une version d'application qui en dépend.
 */

const schemaPath = fileURLToPath(new URL('../src/server/schema.sql', import.meta.url));

/**
 * Contrôle de configuration.
 *
 * Le release_command est le seul endroit qui s'exécute avec les secrets de
 * production **avant** que le trafic ne bascule : c'est donc là qu'il faut
 * refuser un déploiement mal configuré. Sans ce contrôle, `PROCHES_URL` ou
 * `PROCHES_SECRET` manquantes passent le déploiement, le health check reste
 * vert — et l'application lève à la première tentative de connexion, en
 * brûlant au passage le jeton de l'utilisateur.
 *
 * `DATABASE_URL` seule est exigée hors production : cloner et lancer doit
 * rester possible sans rien configurer d'autre.
 */
function verifierConfiguration() {
  const manquantes = [];
  const fautives = [];

  if (!process.env.DATABASE_URL?.trim()) manquantes.push('DATABASE_URL');

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.PROCHES_SECRET?.trim()) manquantes.push('PROCHES_SECRET');

    const url = process.env.PROCHES_URL?.trim();
    if (!url) manquantes.push('PROCHES_URL');
    else if (!url.startsWith('https://')) {
      fautives.push(
        `PROCHES_URL doit commencer par https:// (reçu « ${url} ») — les liens envoyés ` +
          'par courriel en dépendent.',
      );
    }

    // Sans bucket, `stockage.ts` retombe sur le disque de la machine — qui est
    // éphémère chez Fly. Les documents déposés disparaîtraient au premier
    // redémarrage, sans aucun signe avant-coureur.
    if (!process.env.BUCKET_NAME?.trim()) {
      fautives.push(
        'BUCKET_NAME absente : les documents seraient écrits sur le disque éphémère de la ' +
          'machine et perdus au redémarrage. Créez le bucket avec `fly storage create`.',
      );
    }
  }

  if (manquantes.length === 0 && fautives.length === 0) return;

  console.error(
    'Configuration incomplète, déploiement interrompu.\n' +
      manquantes.map((nom) => `  · ${nom} absente`).join('\n') +
      (manquantes.length && fautives.length ? '\n' : '') +
      fautives.map((message) => `  · ${message}`).join('\n') +
      '\n\nEn local : .env.local (voir .env.example).' +
      '\nSur Fly   : fly secrets set NOM=…',
  );
  process.exit(1);
}

async function main() {
  verifierConfiguration();
  const connectionString = process.env.DATABASE_URL.trim();

  const client = new pg.Client({
    connectionString,
    // Même règle que `src/server/db.ts` : TLS partout, sauf demande explicite
    // de s'en passer pour un Postgres local sans certificat.
    ssl: /[?&]sslmode=disable\b/.test(connectionString) ? false : { rejectUnauthorized: true },
    // Neon réveille sa compute à la connexion ; laisser le temps au démarrage
    // à froid plutôt que d'échouer le déploiement pour une seconde d'attente.
    connectionTimeoutMillis: 30_000,
  });

  // Annoncer la cible avant d'agir. `pnpm db:migrate` lit `.env` puis
  // `.env.local` — et Node donne la priorité au dernier fichier. Une inversion
  // de cet ordre fait migrer la production depuis un poste de développement
  // sans que rien ne le signale ; c'est arrivé. L'hôte affiché rend la méprise
  // visible immédiatement. Jamais les identifiants, seulement l'hôte et la base.
  const cible = new URL(connectionString);
  console.log(`Migration de ${cible.pathname.slice(1)} sur ${cible.hostname}`);

  const debut = Date.now();
  await client.connect();

  try {
    await client.query(readFileSync(schemaPath, 'utf8'));

    const { rows } = await client.query('select count(*)::int as n from foyer');
    const foyers = rows[0]?.n ?? 0;

    console.log(`Schéma appliqué en ${Date.now() - debut} ms.`);
    if (foyers === 0) {
      // Commande complète, préfixes compris : `pnpm db:inviter` seul amorcerait
      // la base pointée par le .env.local du poste — pas celle qu'on vient de
      // migrer — et afficherait un lien de tablette inutilisable. La commande
      // ne peut pas non plus être jouée dans cette image, qui n'embarque ni
      // vite-node ni scripts/inviter.ts.
      console.log(
        'Base sans foyer. Depuis VOTRE POSTE, dans le dépôt :\n' +
          "  DATABASE_URL='<url de cette base>' PROCHES_URL='<url publique>' \\\n" +
          '    pnpm db:inviter "<nom de la personne accompagnée>" "<prénom aidant>" <email>',
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((erreur) => {
  console.error('Migration échouée :', erreur.message);
  process.exit(1);
});
