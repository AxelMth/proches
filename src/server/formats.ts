/**
 * Formats et règles de validation des pièces — fonctions pures, sans aucune
 * dépendance serveur.
 *
 * Séparées de `stockage.ts` exprès : les composants client ont besoin
 * d'afficher une taille et la liste des formats acceptés, et importer
 * `stockage.ts` depuis le navigateur entraînerait le SDK S3 et la couche base
 * dans le bundle.
 */

const TYPE_CSV = 'text/csv';
const TYPE_XLS = 'application/vnd.ms-excel';
const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const TYPES_ACCEPTES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'photo JPEG',
  'image/png': 'image PNG',
  'image/webp': 'image WebP',
  'image/heic': 'photo HEIC',
  'image/heif': 'photo HEIF',
  [TYPE_CSV]: 'tableau CSV',
  [TYPE_XLS]: 'classeur Excel',
  [TYPE_XLSX]: 'classeur Excel',
};

// Browsers take a file's type from the OS registry: Windows with Excel reports a
// CSV as `application/vnd.ms-excel`, a machine without Office reports a
// spreadsheet as `application/octet-stream` or nothing at all. The extension
// decides, but only among the types a browser plausibly declares for it.
const TYPES_PAR_EXTENSION: readonly { extension: string; type: string; declares: Set<string> }[] =
  [
    {
      extension: '.csv',
      type: TYPE_CSV,
      declares: new Set([
        '',
        TYPE_CSV,
        'text/plain',
        'text/x-csv',
        'text/comma-separated-values',
        'application/csv',
        'application/x-csv',
        TYPE_XLS,
      ]),
    },
    {
      extension: '.xls',
      type: TYPE_XLS,
      declares: new Set(['', TYPE_XLS, 'application/octet-stream']),
    },
    {
      extension: '.xlsx',
      type: TYPE_XLSX,
      declares: new Set(['', TYPE_XLSX, 'application/octet-stream']),
    },
  ];

export function typeMimeDe(piece: Pick<PieceCandidate, 'name' | 'type'>): string {
  const nom = piece.name.toLowerCase();
  const reconnu = TYPES_PAR_EXTENSION.find(
    ({ extension, declares }) => nom.endsWith(extension) && declares.has(piece.type),
  );
  return reconnu?.type ?? piece.type;
}

/**
 * SVG et HTML sont volontairement exclus : ce sont des documents actifs, servis
 * depuis notre propre origine ils permettraient d'exécuter du script dans la
 * session d'un autre aidant.
 */
export function typeAccepte(typeMime: string): boolean {
  return typeMime in TYPES_ACCEPTES;
}

/** Valeur de l'attribut `accept` d'un `<input type="file">`. */
export const FORMATS_ACCEPTES = [
  ...Object.keys(TYPES_ACCEPTES),
  ...TYPES_PAR_EXTENSION.map(({ extension }) => extension),
].join(',');

/** « PDF, photo JPEG, image PNG… » */
export function libellesFormats(): string {
  return [...new Set(Object.values(TYPES_ACCEPTES))].join(', ');
}

/**
 * Plafond par pièce. Lu côté serveur uniquement ; l'interface le reçoit en
 * propriété.
 *
 * 25 Mo par défaut : un compte rendu d'hospitalisation scanné dépasse
 * couramment les 5 Mo d'origine, et refuser le document le plus utile du
 * dossier était absurde. Réglable par `PROCHES_TAILLE_MAX_MO` — sans
 * déploiement, c'est un secret Fly.
 */
export function tailleMaxOctets(): number {
  const megas = Number(process.env.PROCHES_TAILLE_MAX_MO ?? '25');
  return (Number.isFinite(megas) && megas > 0 ? megas : 25) * 1024 * 1024;
}

/**
 * Plafond du dépôt entier, toutes pièces confondues.
 *
 * Il existe parce que les octets transitent par une Server Action, dont le
 * corps est intégralement mis en mémoire avant que le moindre code applicatif
 * ne s'exécute. Dépasser `serverActions.bodySizeLimit` (voir next.config.ts) ne
 * produit pas un refus poli mais une erreur opaque : mieux vaut l'annoncer
 * avant l'envoi. Gardé sous la valeur de Next, qui est la vraie barrière.
 */
export const TOTAL_MAX_OCTETS = 50 * 1024 * 1024;

export function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

/**
 * Comme `formatTaille`, mais arrondi **au supérieur**, pour le message de refus.
 * Un fichier d'un octet de trop s'affichait sinon « 5,0 Mo » face à une limite
 * de « 5,0 Mo » : deux nombres identiques pour justifier un rejet, ce qui n'est
 * pas une explication.
 */
export function formatTailleSup(octets: number): string {
  if (octets < 1024 * 1024) return formatTaille(octets);
  const megas = Math.ceil((octets / (1024 * 1024)) * 10) / 10;
  return `${megas.toFixed(1).replace('.', ',')} Mo`;
}

/**
 * Nettoie un nom de fichier avant de le renvoyer dans un en-tête HTTP.
 * Un nom contenant un retour à la ligne ou un guillemet permettrait d'injecter
 * un en-tête arbitraire dans la réponse.
 */
export function nomSur(nom: string): string {
  const propre = nom
    .replace(/[\r\n"\\]/g, '')
    .replace(/[/\\]/g, '-')
    .trim()
    .slice(0, 120);
  return propre || 'document';
}

/** Les seuls types qu'on accepte d'afficher dans l'onglet plutôt que de télécharger. */
export function affichableEnLigne(typeMime: string): boolean {
  return typeMime === 'application/pdf' || typeMime.startsWith('image/');
}

/* ── Validation, partagée entre le serveur et le navigateur ─────────────── */

/** Ce qu'il faut connaître d'une pièce pour la juger. Un `File` en fournit autant. */
export interface PieceCandidate {
  name: string;
  size: number;
  type: string;
}

/**
 * Motif de refus d'une pièce, ou `null` si elle passe.
 *
 * Le conseil donné dépend du format, et ce n'est pas un détail : l'ancien
 * message suggérait « enregistrez en PDF » à quelqu'un qui venait précisément
 * de déposer un PDF. Un conseil inapplicable équivaut à pas de conseil.
 */
export function refusPiece(piece: PieceCandidate, max: number): string | null {
  if (piece.size === 0) return `« ${piece.name} » est vide.`;

  if (piece.size > max) {
    const entete = `« ${piece.name} » fait ${formatTailleSup(piece.size)}, la limite est ${formatTaille(max)} par pièce.`;
    if (piece.type === 'application/pdf') {
      return (
        `${entete} Réimprimez-le en qualité réduite, ou coupez-le en plusieurs morceaux : ` +
        `un même document peut porter plusieurs pièces.`
      );
    }
    if (piece.type.startsWith('image/')) {
      return `${entete} Réduisez la résolution de la photo, ou enregistrez-la en PDF.`;
    }
    return entete;
  }

  if (!typeAccepte(typeMimeDe(piece))) {
    return (
      `« ${piece.name} » est dans un format non accepté${piece.type ? ` (${piece.type})` : ''}. ` +
      `Formats possibles : ${libellesFormats()}.`
    );
  }
  return null;
}

/** Motif de refus d'un dépôt entier — pièce fautive, ou total trop lourd. */
export function refusLot(
  pieces: readonly PieceCandidate[],
  max: number,
  totalMax: number = TOTAL_MAX_OCTETS,
): string | null {
  for (const piece of pieces) {
    const motif = refusPiece(piece, max);
    if (motif) return motif;
  }

  const total = pieces.reduce((somme, piece) => somme + piece.size, 0);
  if (total > totalMax) {
    return (
      `L’ensemble fait ${formatTailleSup(total)}, or un dépôt ne peut pas dépasser ` +
      `${formatTaille(totalMax)}. Déposez les pièces en plusieurs fois : vous pourrez ` +
      `ajouter les suivantes au même document.`
    );
  }
  return null;
}
