'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { envoyerInvitation, envoyerLienConnexion } from '@/server/courriel';
import { creerLienConnexion, jetonAleatoire, origine } from '@/server/liens';
import { hacher, refus, verifier } from '@/server/motdepasse';
import { contexteAidant } from '@/server/session';
import {
  creerMembre,
  definirMotDePasse,
  desactiverMembre,
  empreinteMotDePasse,
  membreParEmailMemeInactif,
  membreParId,
  noter,
  oublierEchecs,
  reactiverMembre,
  remplacerJetonVue,
  retirerMotDePasse,
  supprimerSession,
} from '@/server/store';

export interface EtatInvitation {
  statut: 'inactif' | 'ok' | 'erreur';
  message?: string;
}

const schema = z.object({
  prenom: z.string().trim().min(1, 'Indiquez un prénom.').max(80),
  email: z.string().trim().email('Cette adresse ne semble pas valide.'),
});

/**
 * Invitation d'un aidant.
 *
 * C'est le seul moyen d'entrer dans le foyer : la page de connexion ne crée
 * jamais de compte. Un espace où l'on trouve des ordonnances et une adresse ne
 * doit pas s'ouvrir sur simple saisie d'une adresse e-mail.
 */
export async function inviterAidant(
  _precedent: EtatInvitation,
  donnees: FormData,
): Promise<EtatInvitation> {
  const { membre, foyer } = await contexteAidant();

  const analyse = schema.safeParse({
    prenom: donnees.get('prenom') ?? '',
    email: donnees.get('email') ?? '',
  });
  if (!analyse.success) {
    return { statut: 'erreur', message: analyse.error.issues[0]?.message };
  }

  const { prenom, email } = analyse.data;

  // On regarde même les comptes retirés : la ligne survit à un retrait d'accès,
  // et l'index unique sur l'e-mail avec elle.
  const existant = await membreParEmailMemeInactif(email);

  if (existant?.role === 'senior') {
    return {
      statut: 'erreur',
      message:
        'Cette adresse est celle de la personne accompagnée. Elle accède à son espace par ' +
        'son lien permanent, pas par une invitation.',
    };
  }
  if (existant?.actif) {
    return {
      statut: 'erreur',
      message:
        `${existant.prenom} fait déjà partie du foyer. Utilisez « Renvoyer un lien » sur sa ` +
        'ligne si le précédent a expiré.',
    };
  }

  let invite = existant;
  if (invite) await reactiverMembre(invite.id, prenom);
  else {
    invite = await creerMembre({
      foyerId: foyer.id,
      prenom,
      email,
      role: 'aidant',
      jetonVue: null,
      jetonAgenda: jetonAleatoire(24),
    });
  }
  const reactive = existant != null;

  const jeton = await creerLienConnexion(invite.id);
  const envoi = await envoyerInvitation(
    email,
    prenom,
    membre.prenom,
    foyer.nom,
    `${origine()}/connexion/${jeton}`,
  );

  await noter(foyer.id, membre.id, reactive ? 'a rendu l’accès à' : 'a invité', prenom);
  revalidatePath('/famille');

  if (envoi.ok) {
    return {
      statut: 'ok',
      message: reactive
        ? `${prenom} avait déjà été retiré du foyer : son accès est rétabli et un lien de ` +
          'connexion vient de lui être envoyé.'
        : `Invitation envoyée à ${prenom}.`,
    };
  }

  // Le compte existe désormais : c'est l'acquis à annoncer en premier, avant
  // d'expliquer par où passer en attendant que l'envoi soit réparé.
  return {
    statut: 'erreur',
    message:
      envoi.cause === 'configuration'
        ? `${prenom} a bien été ajouté, mais l'envoi de courriels est mal configuré sur ce ` +
          `serveur : l'invitation n'est pas partie et ne partira pas tant que ce n'est pas réglé.`
        : `${prenom} a bien été ajouté, mais l'e-mail n'est pas parti. ` +
          `Demandez-lui de faire « Recevoir mon lien de connexion » depuis la page d'accueil.`,
  };
}

/**
 * Renvoie un lien de connexion à un aidant déjà membre.
 *
 * Un lien magique ne vit qu'une heure : passé ce délai, l'invitation est
 * inutilisable. Sans ce bouton, le réflexe est de retirer l'accès pour
 * réinviter — ce qui n'était pas seulement contre-intuitif, mais levait une
 * erreur de contrainte tant que `inviterAidant` ignorait les comptes retirés.
 */
export async function renvoyerLien(
  _precedent: EtatInvitation,
  donnees: FormData,
): Promise<EtatInvitation> {
  const { foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');

  const cible = id ? await membreParId(id) : null;
  if (!cible || cible.foyerId !== foyer.id || cible.role !== 'aidant') {
    return { statut: 'erreur', message: 'Membre introuvable.' };
  }

  const jeton = await creerLienConnexion(cible.id);
  const envoi = await envoyerLienConnexion(
    cible.email,
    cible.prenom,
    `${origine()}/connexion/${jeton}`,
  );

  if (envoi.ok) {
    return { statut: 'ok', message: `Nouveau lien envoyé à ${cible.prenom}.` };
  }
  return {
    statut: 'erreur',
    message:
      envoi.cause === 'configuration'
        ? "L'envoi de courriels est mal configuré sur ce serveur : le lien n'est pas parti."
        : "L'envoi a échoué. Réessayez dans un instant.",
  };
}

/**
 * Ferme un appareil resté connecté.
 *
 * La contrepartie des sessions d'un an : il faut pouvoir couper celle du
 * téléphone perdu ou de l'ordinateur prêté, sans avoir à se déconnecter
 * partout. Un membre ne peut fermer que ses propres appareils.
 */
export async function fermerAppareil(donnees: FormData): Promise<void> {
  const { membre } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');
  if (!id) return;

  await supprimerSession(id, membre.id);
  revalidatePath('/famille');
}

export async function retirerMembre(donnees: FormData): Promise<void> {
  const { membre, foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');

  // Se retirer soi-même fermerait la porte de l'intérieur sans prévenir.
  if (!id || id === membre.id) return;

  const cible = await membreParId(id);
  if (!cible || cible.foyerId !== foyer.id) return;

  await desactiverMembre(id);
  await noter(foyer.id, membre.id, 'a retiré du foyer', cible.prenom);
  revalidatePath('/famille');
}

/**
 * Nouveau lien permanent pour la personne accompagnée.
 *
 * À faire le jour où la tablette est perdue ou prêtée : l'ancienne adresse
 * cesse immédiatement de fonctionner. Il faudra remettre le nouveau lien en
 * favori sur son appareil — c'est le prix d'un accès sans mot de passe.
 */
export interface EtatMotDePasse {
  statut: 'inactif' | 'ok' | 'erreur';
  message?: string;
}

/**
 * Définit ou change le mot de passe du membre connecté.
 *
 * L'ancien est exigé dès qu'il en existe un : une session ouverte n'est pas une
 * preuve d'identité suffisante pour changer ce qui ouvre toutes les autres.
 * À la première définition, en revanche, il n'y a rien à demander — la session
 * vient d'un lien reçu sur la boîte mail du membre.
 *
 * Les autres appareils ne sont **pas** déconnectés : ils ont été ouverts par
 * cette même personne et se ferment un par un depuis la liste juste au-dessus.
 * Couper le téléphone de quelqu'un parce qu'il change son mot de passe sur son
 * ordinateur n'aide personne ici.
 */
export async function enregistrerMotDePasse(
  _precedent: EtatMotDePasse,
  donnees: FormData,
): Promise<EtatMotDePasse> {
  const { membre, foyer } = await contexteAidant();

  const ancien = String(donnees.get('ancien') ?? '');
  const nouveau = String(donnees.get('nouveau') ?? '');
  const confirmation = String(donnees.get('confirmation') ?? '');

  const existant = await empreinteMotDePasse(membre.email);

  if (existant && !(await verifier(ancien, existant.empreinte))) {
    return { statut: 'erreur', message: 'Le mot de passe actuel ne correspond pas.' };
  }
  if (nouveau !== confirmation) {
    return { statut: 'erreur', message: 'Les deux saisies ne sont pas identiques.' };
  }

  const probleme = refus(nouveau);
  if (probleme) return { statut: 'erreur', message: probleme };

  await definirMotDePasse(membre.id, await hacher(nouveau));
  // Un changement réussi remet le compteur d'essais à zéro : sinon, quelqu'un
  // qui vient de se tromper cinq fois puis de réinitialiser resterait freiné.
  await oublierEchecs(membre.email);
  await noter(foyer.id, membre.id, existant ? 'a changé son mot de passe' : 'a défini un mot de passe', null);

  revalidatePath('/famille');
  return {
    statut: 'ok',
    message: existant
      ? 'Mot de passe changé.'
      : 'Mot de passe défini. Vous pouvez désormais vous connecter sans passer par un courriel.',
  };
}

/** Revient au lien par courriel comme seul moyen d'entrer. */
export async function supprimerMotDePasse(): Promise<void> {
  const { membre, foyer } = await contexteAidant();
  await retirerMotDePasse(membre.id);
  await noter(foyer.id, membre.id, 'a supprimé son mot de passe', null);
  revalidatePath('/famille');
}

export async function regenererLienVue(donnees: FormData): Promise<void> {
  const { membre, foyer } = await contexteAidant();
  const id = String(donnees.get('id') ?? '');
  if (!id) return;

  const cible = await membreParId(id);
  if (!cible || cible.foyerId !== foyer.id || cible.role !== 'senior') return;

  await remplacerJetonVue(id, jetonAleatoire(24));
  await noter(foyer.id, membre.id, 'a renouvelé le lien de', cible.prenom);
  revalidatePath('/famille');
}
