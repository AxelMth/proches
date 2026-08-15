import { Pool, type QueryResultRow } from 'pg';

/**
 * Accès Postgres (Neon).
 *
 * Le serveur tourne en continu sur Fly : un pool TCP classique est le bon
 * outil, pas le driver HTTP « serverless ». Le pool est rangé sur `globalThis`
 * parce que le rechargement à chaud de Next réévalue les modules — sans cela,
 * chaque sauvegarde de fichier ouvrirait un pool de plus jusqu'à saturer les
 * connexions autorisées par Neon.
 *
 * Neon met la compute en veille après quelques minutes d'inactivité et la
 * réveille à la connexion suivante : la première requête après une pause peut
 * prendre une demi-seconde. C'est attendu, pas un incident.
 */

const globalForPool = globalThis as unknown as { __prochesPool?: Pool };

export function pool(): Pool {
  if (globalForPool.__prochesPool) return globalForPool.__prochesPool;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL absente. Renseignez-la dans .env.local (voir .env.example), ' +
        'puis relancez `pnpm dev`.',
    );
  }

  const instance = new Pool({
    connectionString,
    // TLS par défaut, avec vérification stricte du certificat — jamais de
    // `rejectUnauthorized: false`. `?sslmode=disable` dans l'URL reste possible
    // pour un Postgres local en conteneur, qui n'a pas de certificat.
    //
    // Attention : quand la chaîne de connexion porte un `sslmode`, c'est lui
    // qui tranche, pas cette option. D'où le `sslmode=verify-full` recommandé
    // dans .env.example — `require` fonctionne mais fait imprimer à `pg` un
    // avertissement sur un futur changement de sémantique.
    ssl: /[?&]sslmode=disable\b/.test(connectionString) ? false : { rejectUnauthorized: true },
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // Une erreur sur un client au repos (Neon qui referme une connexion pendant
  // la veille) ne doit pas faire tomber le processus Node.
  instance.on('error', (error) => {
    console.error('[proches] connexion Postgres au repos perdue :', error.message);
  });

  globalForPool.__prochesPool = instance;
  return instance;
}

/** Requête renvoyant plusieurs lignes. */
export async function q<T extends QueryResultRow>(
  texte: string,
  valeurs: unknown[] = [],
): Promise<T[]> {
  const { rows } = await pool().query<T>(texte, valeurs);
  return rows;
}

/** Requête renvoyant au plus une ligne — `null` si aucune. */
export async function q1<T extends QueryResultRow>(
  texte: string,
  valeurs: unknown[] = [],
): Promise<T | null> {
  const rows = await q<T>(texte, valeurs);
  return rows[0] ?? null;
}

/** Requête sans résultat attendu (insert / update / delete). */
export async function exec(texte: string, valeurs: unknown[] = []): Promise<number> {
  const { rowCount } = await pool().query(texte, valeurs);
  return rowCount ?? 0;
}

/**
 * Identifiant court, lisible dans une URL et impossible à deviner en série.
 * 15 octets d'aléa en base64url — assez pour ne jamais collisionner ici, et
 * plus discret qu'un UUID dans une barre d'adresse.
 */
export function nouvelId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 20);
}
