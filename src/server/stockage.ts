import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { nouvelId } from './db';
import { nomSur, refusLot, tailleMaxOctets } from './formats';
import {
  insererDocument,
  insererFichier,
  lireCleFichier,
  prochainOrdre,
  supprimerDocument,
} from './store';
import type { CategorieDocument } from './types';

/**
 * Seul module qui touche aux octets d'un document.
 *
 * La base ne conserve que les métadonnées et une **clé** : le contenu vit dans
 * un stockage objet (Tigris, région européenne, S3-compatible). Trois raisons
 * de ne plus le ranger en `bytea` : le palier gratuit de Neon plafonne à 0,5 Go,
 * une table alourdie de mégaoctets ralentit les sauvegardes de *toute* la base,
 * et le gigaoctet coûte deux ordres de grandeur moins cher côté objet.
 *
 * En contrepartie — et c'est le point à ne pas oublier — les documents ne sont
 * plus couverts par les sauvegardes de Neon. Activer le versionnage sur le
 * bucket est ce qui remplace cette filet (voir le README).
 *
 * **Sans bucket configuré, on écrit sous `.data/documents/`.** Cloner le dépôt
 * et déposer un document doit rester possible sans compte chez un tiers. Ce
 * repli est refusé en production : `scripts/migrate.mjs` interrompt le
 * déploiement si le bucket manque, car le disque d'une machine Fly est
 * éphémère — les documents disparaîtraient au premier redémarrage.
 */

/* ── Choix du magasin ───────────────────────────────────────────────────── */

export function bucket(): string | null {
  return process.env.BUCKET_NAME?.trim() || null;
}

export function stockageObjetConfigure(): boolean {
  return bucket() !== null;
}

const globalForS3 = globalThis as unknown as { __prochesS3?: S3Client };

function client(): S3Client {
  if (globalForS3.__prochesS3) return globalForS3.__prochesS3;

  // `fly storage create` pose lui-même AWS_* et BUCKET_NAME dans les secrets.
  // Tigris n'a pas de notion de région : « auto » est la valeur attendue.
  const instance = new S3Client({
    region: process.env.AWS_REGION?.trim() || 'auto',
    endpoint: process.env.AWS_ENDPOINT_URL_S3?.trim() || 'https://fly.storage.tigris.dev',
    // Tigris et S3 adressent le bucket par sous-domaine ; MinIO, Ceph et la
    // plupart des S3 auto-hébergés l'attendent dans le chemin. Un simple
    // drapeau, et le module marche contre les deux familles.
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
  });

  globalForS3.__prochesS3 = instance;
  return instance;
}

/** Racine du repli local. Jamais utilisée en production. */
function racineLocale(): string {
  return path.join(process.cwd(), '.data', 'documents');
}

async function ecrire(cle: string, contenu: Buffer, typeMime: string): Promise<void> {
  if (!bucket()) {
    const cible = path.join(racineLocale(), cle);
    await fs.mkdir(path.dirname(cible), { recursive: true });
    await fs.writeFile(cible, contenu);
    return;
  }

  await client().send(
    new PutObjectCommand({
      Bucket: bucket()!,
      Key: cle,
      Body: contenu,
      ContentType: typeMime,
      // Le bucket n'est jamais public : tout passe par nos routes, qui
      // vérifient la session ou le jeton de la personne accompagnée.
      ACL: 'private',
    }),
  );
}

async function relire(cle: string): Promise<Buffer | null> {
  if (!bucket()) {
    try {
      return await fs.readFile(path.join(racineLocale(), cle));
    } catch {
      return null;
    }
  }

  try {
    const reponse = await client().send(
      new GetObjectCommand({ Bucket: bucket()!, Key: cle }),
    );
    if (!reponse.Body) return null;
    return Buffer.from(await reponse.Body.transformToByteArray());
  } catch (erreur) {
    console.error(`[proches] lecture impossible de « ${cle} » :`, (erreur as Error).message);
    return null;
  }
}

/**
 * Efface l'objet. N'échoue jamais : la ligne en base est déjà supprimée quand
 * on arrive ici, et refaire échouer l'action laisserait l'utilisateur devant
 * une erreur pour un document qui, de son point de vue, a bien disparu. Un
 * objet orphelin ne coûte que quelques centimes.
 */
export async function effacer(cle: string): Promise<void> {
  try {
    if (!bucket()) {
      await fs.rm(path.join(racineLocale(), cle), { force: true });
      return;
    }
    await client().send(new DeleteObjectCommand({ Bucket: bucket()!, Key: cle }));
  } catch (erreur) {
    console.error(`[proches] objet « ${cle} » non effacé :`, (erreur as Error).message);
  }
}

/* ── API du module ──────────────────────────────────────────────────────── */

export type ResultatDepot = { ok: true; id: string } | { ok: false; message: string };

/**
 * Écrit les pièces et les rattache au dossier.
 *
 * Les octets d'abord, la ligne ensuite : une ligne pointant vers un objet
 * absent serait une pièce fantôme, listée et illisible. Dans l'autre ordre,
 * l'échec ne laisse qu'un objet orphelin, invisible et à quelques centimes.
 */
async function poser(
  fichiers: readonly File[],
  cible: { foyerId: string; documentId: string; ordreDepart: number },
): Promise<string | null> {
  const ecrites: string[] = [];

  try {
    for (const [index, fichier] of fichiers.entries()) {
      const contenu = Buffer.from(await fichier.arrayBuffer());
      // La clé porte le foyer : lisible dans la console du bucket, et les
      // foyers restent séparés si l'instance venait à en accueillir plusieurs.
      const cle = `documents/${cible.foyerId}/${nouvelId()}`;

      await ecrire(cle, contenu, fichier.type);
      ecrites.push(cle);

      await insererFichier({
        documentId: cible.documentId,
        nomFichier: nomSur(fichier.name),
        typeMime: fichier.type,
        taille: contenu.byteLength,
        cle,
        ordre: cible.ordreDepart + index,
      });
    }
    return null;
  } catch (erreur) {
    // Rien ne doit rester à moitié posé : on retire ce qu'on vient d'écrire.
    await Promise.all(ecrites.map(effacer));
    console.error('[proches] dépôt impossible :', (erreur as Error).message);
    return "Le document n'a pas pu être enregistré. Réessayez dans un instant.";
  }
}

/** Crée un dossier et y range ses premières pièces. */
export async function creerDocument(
  fichiers: readonly File[],
  meta: {
    foyerId: string;
    titre: string;
    categorie: CategorieDocument;
    notes: string | null;
    ajoutePar: string;
  },
): Promise<ResultatDepot> {
  if (fichiers.length === 0) return { ok: false, message: 'Choisissez au moins un fichier.' };

  const motif = refusLot(fichiers, tailleMaxOctets());
  if (motif) return { ok: false, message: motif };

  const documentId = await insererDocument({
    foyerId: meta.foyerId,
    titre: meta.titre,
    categorie: meta.categorie,
    notes: meta.notes,
    ajoutePar: meta.ajoutePar,
  });

  const echec = await poser(fichiers, { foyerId: meta.foyerId, documentId, ordreDepart: 0 });
  if (echec) {
    // Le dossier vient d'être créé et n'a rien reçu : il ne doit pas rester.
    await supprimerDocument(documentId, meta.foyerId);
    return { ok: false, message: echec };
  }

  return { ok: true, id: documentId };
}

/** Ajoute des pièces à un dossier existant. */
export async function ajouterFichiers(
  fichiers: readonly File[],
  cible: { foyerId: string; documentId: string },
): Promise<ResultatDepot> {
  if (fichiers.length === 0) return { ok: false, message: 'Choisissez au moins un fichier.' };

  const motif = refusLot(fichiers, tailleMaxOctets());
  if (motif) return { ok: false, message: motif };

  const ordreDepart = await prochainOrdre(cible.documentId);
  const echec = await poser(fichiers, { ...cible, ordreDepart });
  return echec ? { ok: false, message: echec } : { ok: true, id: cible.documentId };
}

export async function lireFichier(
  fichierId: string,
  foyerId: string,
): Promise<{ contenu: Buffer; nomFichier: string; typeMime: string } | null> {
  const fichier = await lireCleFichier(fichierId, foyerId);
  if (!fichier) return null;

  const contenu = await relire(fichier.cle);
  if (!contenu) return null;

  return { contenu, nomFichier: fichier.nomFichier, typeMime: fichier.typeMime };
}

export {
  affichableEnLigne,
  formatTaille,
  FORMATS_ACCEPTES,
  libellesFormats,
  nomSur,
  refusLot,
  refusPiece,
  tailleMaxOctets,
  TOTAL_MAX_OCTETS,
  typeAccepte,
  TYPES_ACCEPTES,
} from './formats';
