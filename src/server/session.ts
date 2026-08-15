import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { jetonAleatoire } from './liens';
import {
  creerSession,
  foyer,
  prolongerSession,
  purgerSessions,
  sessionActive,
  supprimerSessionParJeton,
} from './store';
import type { Foyer, Membre } from './types';

/**
 * Sessions des aidants.
 *
 * Le cookie ne porte qu'un jeton aléatoire ; tout l'état est en base, une ligne
 * par appareil. Ce choix remplace un cookie signé auto-porteur, et il n'est pas
 * qu'une affaire de goût : la date d'émission y était figée, si bien que la
 * session mourait au bout de 90 jours **même pour quelqu'un qui venait tous les
 * jours**. Or se reconnecter passe ici par un courriel — le geste le plus
 * coûteux de l'application.
 *
 * Désormais l'échéance **glisse** : chaque visite la repousse d'un an. Un
 * utilisateur régulier n'a plus jamais à se reconnecter, et celui qui disparaît
 * un an voit sa session s'éteindre toute seule.
 *
 * ## Et le « refresh token » ?
 *
 * Le couple jeton d'accès court / jeton de rafraîchissement long existe pour
 * les jetons **sans état** — un JWT signé qu'on ne peut pas révoquer, d'où un
 * jeton court pour limiter les dégâts et un jeton long pour ne pas harceler
 * l'utilisateur. Ici la session est en base : elle est révocable à tout instant
 * et se prolonge d'elle-même. Il n'y a donc rien à rafraîchir, et le second
 * jeton n'apporterait qu'un aller-retour de plus à maintenir.
 *
 * La personne accompagnée, elle, n'a jamais de session : son accès est son lien
 * permanent, résolu à chaque requête.
 */

const COOKIE = 'proches_session';

/** Un an d'inactivité tolérée côté base. Repoussé à chaque visite. */
const DUREE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Durée du cookie, posée une fois pour toutes à la connexion.
 *
 * 400 jours, parce que c'est le plafond des navigateurs : depuis 2022, Chrome
 * et ses dérivés ramènent silencieusement tout `Max-Age` supérieur à cette
 * valeur. Demander davantage ne servirait à rien.
 *
 * Le cookie n'est **jamais réécrit ensuite**, et c'est une contrainte de Next,
 * pas un choix : écrire un cookie pendant le rendu d'une page lève. La date
 * d'échéance qui fait foi est donc celle de la base, qui glisse librement ;
 * le cookie n'est qu'un porteur de jeton avec une durée de vie généreuse.
 */
const DUREE_COOKIE_S = 400 * 24 * 60 * 60;

/**
 * On ne réécrit pas la ligne à chaque affichage de page : au-delà de ce délai
 * seulement. Sans ce seuil, chaque navigation coûterait une écriture en base
 * pour repousser une échéance d'un an de quelques secondes.
 */
const PROLONGER_APRES_MS = 12 * 60 * 60 * 1000;

function empreinte(jeton: string): string {
  return crypto.createHash('sha256').update(jeton).digest('hex');
}

function optionsCookie(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

/**
 * Description lisible de l'appareil, pour la page « Appareils connectés ».
 * Volontairement grossière : il s'agit de reconnaître son propre téléphone
 * dans une liste de trois, pas de faire de l'analyse d'audience.
 */
function decrireAppareil(agent: string | null): string | null {
  if (!agent) return null;

  const navigateur = /Edg\//.test(agent)
    ? 'Edge'
    : /OPR\//.test(agent)
      ? 'Opera'
      : /Firefox\//.test(agent)
        ? 'Firefox'
        : /Chrome\//.test(agent)
          ? 'Chrome'
          : /Safari\//.test(agent)
            ? 'Safari'
            : 'Navigateur';

  const systeme = /iPhone/.test(agent)
    ? 'iPhone'
    : /iPad/.test(agent)
      ? 'iPad'
      : /Android/.test(agent)
        ? 'Android'
        : /Mac OS X/.test(agent)
          ? 'Mac'
          : /Windows/.test(agent)
            ? 'Windows'
            : /Linux/.test(agent)
              ? 'Linux'
              : null;

  return systeme ? `${navigateur} sur ${systeme}` : navigateur;
}

export async function ouvrirSession(membreId: string): Promise<void> {
  const jeton = jetonAleatoire();
  const expire = new Date(Date.now() + DUREE_MS);

  const entetes = await headers();
  await creerSession({
    jetonHash: empreinte(jeton),
    membreId,
    appareil: decrireAppareil(entetes.get('user-agent')),
    expireLe: expire,
  });

  const jar = await cookies();
  jar.set(COOKIE, jeton, optionsCookie(DUREE_COOKIE_S));

  // Ménage opportuniste, au moment le moins fréquent du cycle de vie.
  await purgerSessions();
}

export async function fermerSession(): Promise<void> {
  const jar = await cookies();
  const jeton = jar.get(COOKIE)?.value;
  if (jeton) await supprimerSessionParJeton(empreinte(jeton));
  jar.delete(COOKIE);
}

export async function membreConnecte(): Promise<Membre | null> {
  const jar = await cookies();
  const jeton = jar.get(COOKIE)?.value;
  if (!jeton) return null;

  const session = await sessionActive(empreinte(jeton));
  if (!session) return null;

  // Un senior ne se connecte pas par cookie : son accès est son lien permanent.
  if (session.membre.role !== 'aidant') return null;

  // Glissement de l'échéance, en base uniquement : `cookies().set()` lève
  // pendant le rendu d'une page. C'est la base qui fait foi, le cookie n'a
  // qu'une durée de vie longue et fixe.
  if (Date.now() - session.vuLe.getTime() > PROLONGER_APRES_MS) {
    await prolongerSession(session.sessionId, new Date(Date.now() + DUREE_MS));
  }

  return session.membre;
}

/**
 * Identifiant de la session en cours, pour que la page Appareils puisse dire
 * « cet appareil-ci » plutôt que de proposer de se révoquer soi-même.
 */
export async function sessionCouranteId(): Promise<string | null> {
  const jar = await cookies();
  const jeton = jar.get(COOKIE)?.value;
  if (!jeton) return null;
  return (await sessionActive(empreinte(jeton)))?.sessionId ?? null;
}

/**
 * Contexte de toutes les pages aidants : le membre et son foyer.
 * Sans session → page de connexion, avec retour à la page demandée.
 */
export async function contexteAidant(retour?: string): Promise<{ membre: Membre; foyer: Foyer }> {
  const membre = await membreConnecte();
  if (!membre) {
    redirect(retour ? `/connexion?suite=${encodeURIComponent(retour)}` : '/connexion');
  }
  return { membre, foyer: await foyer() };
}
