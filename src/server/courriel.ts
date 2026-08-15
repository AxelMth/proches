/**
 * Envoi de courriels via l'API HTTP de Resend.
 *
 * Un `fetch` suffit, le SDK n'apporterait rien ici.
 */

const API = 'https://api.resend.com/emails';

function expediteur(): string {
  return process.env.COURRIEL_EXPEDITEUR?.trim() || 'Proches <onboarding@resend.dev>';
}

export function envoiConfigure(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export interface Courriel {
  destinataire: string;
  sujet: string;
  texte: string;
}

/**
 * Issue d'un envoi.
 *
 *  - `configuration` : Resend a refusé (4xx). Domaine expéditeur non vérifié,
 *    clé révoquée… La panne est permanente, réessayer ne sert à rien, et le
 *    message affiché à l'utilisateur doit le dire.
 *  - `panne` : 5xx, réseau coupé, délai dépassé. Là, réessayer a un sens.
 */
export type ResultatEnvoi = { ok: true } | { ok: false; cause: 'configuration' | 'panne' };

/**
 * Écrit le message dans les logs du serveur.
 *
 * Appelé quand — et seulement quand — le message n'est pas parti : sans clé
 * configurée, ou après un échec d'envoi. C'est un compromis assumé : un lien de
 * connexion dans `fly logs` n'est pas idéal, mais l'alternative l'est beaucoup
 * moins. Lors du premier déploiement, Resend a refusé l'expéditeur et le lien a
 * purement disparu — plus personne ne pouvait entrer, et l'exploitant lui-même
 * n'avait aucun moyen de récupérer le lien sans ouvrir la base.
 *
 * Les liens écrits ici restent à usage unique et valables une heure.
 */
function journaliser(courriel: Courriel, motif: string): void {
  console.info(
    `\n[proches] courriel NON envoyé — ${motif}\n` +
      `  à     : ${courriel.destinataire}\n` +
      `  objet : ${courriel.sujet}\n` +
      `${courriel.texte
        .split('\n')
        .map((ligne) => `  | ${ligne}`)
        .join('\n')}\n`,
  );
}

/**
 * Envoie un message. Ne lève jamais : une panne de Resend ne doit pas
 * transformer une page en erreur 500.
 */
export async function envoyer(courriel: Courriel): Promise<ResultatEnvoi> {
  const cle = process.env.RESEND_API_KEY?.trim();

  if (!cle) {
    // Absence de clé assumée : « cloner et lancer » doit fonctionner sans
    // compte chez un tiers. On considère l'envoi réussi.
    journaliser(courriel, 'RESEND_API_KEY absente');
    return { ok: true };
  }

  let reponse: Response;
  try {
    reponse = await fetch(API, {
      method: 'POST',
      headers: { authorization: `Bearer ${cle}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: expediteur(),
        to: [courriel.destinataire],
        subject: courriel.sujet,
        text: courriel.texte,
      }),
    });
  } catch (erreur) {
    console.error('[proches] envoi de courriel impossible :', (erreur as Error).message);
    journaliser(courriel, 'réseau injoignable');
    return { ok: false, cause: 'panne' };
  }

  if (reponse.ok) return { ok: true };

  const detail = await reponse.text().catch(() => '');
  console.error(`[proches] Resend a refusé l'envoi (${reponse.status}) :`, detail);
  journaliser(courriel, `Resend ${reponse.status}`);

  // 4xx = notre configuration est fautive ; 5xx = c'est chez eux.
  return { ok: false, cause: reponse.status < 500 ? 'configuration' : 'panne' };
}

export async function envoyerLienConnexion(
  destinataire: string,
  prenom: string,
  url: string,
): Promise<ResultatEnvoi> {
  return envoyer({
    destinataire,
    sujet: 'Votre lien de connexion à Proches',
    texte:
      `Bonjour ${prenom},\n\n` +
      `Voici votre lien de connexion :\n${url}\n\n` +
      `Il est valable une heure et ne fonctionne qu'une fois.\n` +
      `Une page vous demandera de confirmer : c'est normal, cliquez sur le bouton.\n` +
      `Si vous n'avez rien demandé, ignorez ce message.\n`,
  });
}

export async function envoyerInvitation(
  destinataire: string,
  prenom: string,
  invitePar: string,
  nomFoyer: string,
  url: string,
): Promise<ResultatEnvoi> {
  return envoyer({
    destinataire,
    sujet: `${invitePar} vous invite à rejoindre Proches`,
    texte:
      `Bonjour ${prenom},\n\n` +
      `${invitePar} vous invite à rejoindre l'espace partagé pour accompagner ${nomFoyer} : ` +
      `documents, liste de choses à faire et agenda, au même endroit.\n\n` +
      `Connectez-vous ici :\n${url}\n\n` +
      `Ce lien est valable une heure. Passé ce délai, demandez-en un nouveau ` +
      `depuis la page de connexion avec cette adresse.\n`,
  });
}
