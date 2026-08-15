'use server';

import { redirect } from 'next/navigation';
import { envoyerLienConnexion } from '@/server/courriel';
import { consommerLien, creerLienConnexion, etatLien, origine } from '@/server/liens';
import { ouvrirSession } from '@/server/session';
import { membreParId } from '@/server/store';

/**
 * Ouvre la session — **c'est ici, et nulle part ailleurs, que le jeton est
 * consommé.**
 *
 * Déclenchée par la soumission du formulaire de la page de confirmation, donc
 * par un `POST`. Les analyseurs d'URL des messageries suivent les liens mais ne
 * soumettent pas les formulaires : le jeton survit à leur passage.
 */
export async function confirmerConnexion(donnees: FormData): Promise<void> {
  const jeton = String(donnees.get('jeton') ?? '');
  const suite = String(donnees.get('suite') ?? '');

  const membreId = jeton ? await consommerLien(jeton) : null;
  const membre = membreId ? await membreParId(membreId) : null;

  // Un senior n'ouvre jamais de session : son accès est son lien permanent.
  if (!membre || membre.role !== 'aidant') redirect('/connexion?erreur=jeton');

  await ouvrirSession(membre.id);

  // Seul un chemin interne est accepté : sans ce filtre, un lien envoyé par
  // courriel deviendrait une redirection ouverte.
  redirect(suite.startsWith('/') && !suite.startsWith('//') ? suite : '/');
}

export interface EtatRenvoi {
  statut: 'inactif' | 'ok' | 'erreur';
  message?: string;
}

/**
 * Renvoie un lien neuf depuis un lien périmé.
 *
 * Sans cela, la personne devait retourner à la page de connexion et retaper
 * son adresse — alors qu'on sait déjà de qui il s'agit. Le jeton périmé suffit
 * à l'identifier, et le nouveau lien part à la même adresse que le premier :
 * quelqu'un qui détiendrait le jeton n'obtient donc rien de plus.
 */
export async function renvoyerDepuisLien(
  _precedent: EtatRenvoi,
  donnees: FormData,
): Promise<EtatRenvoi> {
  const jeton = String(donnees.get('jeton') ?? '');
  const etat = jeton ? await etatLien(jeton) : { statut: 'inconnu' as const };

  if (etat.statut === 'inconnu') {
    return { statut: 'erreur', message: 'Ce lien est introuvable. Demandez-en un depuis l’accueil.' };
  }

  const membre = await membreParId(etat.membreId);
  if (!membre || membre.role !== 'aidant') {
    return { statut: 'erreur', message: 'Ce compte n’est plus actif.' };
  }

  const neuf = await creerLienConnexion(membre.id);
  const envoi = await envoyerLienConnexion(
    membre.email,
    membre.prenom,
    `${origine()}/connexion/${neuf}`,
  );

  if (envoi.ok) {
    return {
      statut: 'ok',
      message: `Un nouveau lien vient de partir vers ${membre.email}. Il est valable une heure.`,
    };
  }
  return {
    statut: 'erreur',
    message:
      envoi.cause === 'configuration'
        ? "L'envoi de courriels est mal configuré sur ce serveur : prévenez la personne qui administre cet espace."
        : "L'envoi a échoué. Réessayez dans un instant.",
  };
}
