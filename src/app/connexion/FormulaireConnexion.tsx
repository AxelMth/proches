'use client';

import { useActionState, useState } from 'react';
import { BoutonSoumettre } from '@/components/BoutonSoumettre';
import { connecterAvecMotDePasse, demanderLien, type EtatConnexion } from './actions';

const INITIAL: EtatConnexion = { statut: 'inactif' };

/**
 * Deux chemins pour la même porte.
 *
 * Le mot de passe est proposé en premier parce que c'est le geste le moins
 * coûteux quand on en a un. Le lien par courriel reste juste en dessous, et il
 * assure trois rôles à lui seul : la toute première connexion (personne n'a de
 * mot de passe le jour de son invitation), le mot de passe oublié, et le
 * dépannage quand les essais ont été freinés.
 *
 * Un seul champ « adresse » pour les deux formulaires aurait été plus élégant,
 * mais deux `<form>` distincts sont nécessaires : chacun appelle son action.
 * L'adresse déjà saisie est donc recopiée d'un formulaire à l'autre — sans
 * cela, basculer sur « recevoir un lien » obligeait à la retaper.
 */
export function FormulaireConnexion({ suite }: { suite?: string }) {
  const [chemin, setChemin] = useState<'motDePasse' | 'lien'>('motDePasse');
  const [email, setEmail] = useState('');

  if (chemin === 'lien') {
    return <ParLien suite={suite} email={email} onRetour={() => setChemin('motDePasse')} />;
  }
  return (
    <ParMotDePasse
      suite={suite}
      email={email}
      onEmail={setEmail}
      onLien={() => setChemin('lien')}
    />
  );
}

function ParMotDePasse({
  suite,
  email,
  onEmail,
  onLien,
}: {
  suite?: string;
  email: string;
  onEmail: (valeur: string) => void;
  onLien: () => void;
}) {
  const [etat, action] = useActionState(connecterAvecMotDePasse, INITIAL);

  return (
    <form action={action} className="space-y-4">
      {suite ? <input type="hidden" name="suite" value={suite} /> : null}

      <div>
        <label htmlFor="email" className="libelle">
          Votre adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(evenement) => onEmail(evenement.target.value)}
          placeholder="prenom@exemple.fr"
          className="champ"
        />
      </div>

      <div>
        <label htmlFor="motDePasse" className="libelle">
          Votre mot de passe
        </label>
        <input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
          className="champ"
        />
      </div>

      {etat.statut === 'erreur' ? (
        <p
          role="alert"
          className="rounded-xl bg-alerte-clair px-3 py-2 text-sm font-semibold text-alerte"
        >
          {etat.message}
        </p>
      ) : null}

      <BoutonSoumettre className="bouton w-full" enCours="Connexion…">
        Se connecter
      </BoutonSoumettre>

      <div className="border-t pt-4">
        <button type="button" onClick={onLien} className="bouton bouton-doux w-full">
          Recevoir un lien de connexion
        </button>
        <p className="mt-2 text-sm text-doux">
          Mot de passe oublié, ou pas encore de mot de passe ? Passez par le lien : il vous
          connecte sans rien retenir, et vous pourrez en définir un depuis la page Famille.
        </p>
      </div>
    </form>
  );
}

function ParLien({
  suite,
  email,
  onRetour,
}: {
  suite?: string;
  email: string;
  onRetour: () => void;
}) {
  const [etat, action] = useActionState(demanderLien, INITIAL);

  if (etat.statut === 'envoye') {
    return (
      <div role="status" className="rounded-xl bg-sauge-clair p-4 text-sauge">
        <p className="font-semibold">Regardez votre boîte mail.</p>
        <p className="mt-1 text-sm">
          Si cette adresse fait partie du foyer, un lien de connexion vient d’y être envoyé. Il est
          valable une heure.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {suite ? <input type="hidden" name="suite" value={suite} /> : null}

      <div>
        <label htmlFor="email-lien" className="libelle">
          Votre adresse e-mail
        </label>
        <input
          id="email-lien"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          defaultValue={email}
          placeholder="prenom@exemple.fr"
          className="champ"
        />
      </div>

      {etat.statut === 'erreur' ? (
        <p
          role="alert"
          className="rounded-xl bg-alerte-clair px-3 py-2 text-sm font-semibold text-alerte"
        >
          {etat.message}
        </p>
      ) : null}

      <BoutonSoumettre className="bouton w-full" enCours="Envoi du lien…">
        Recevoir mon lien de connexion
      </BoutonSoumettre>

      <p className="text-sm text-doux">
        Pas de mot de passe à retenir : vous recevez un lien, vous cliquez, vous êtes connecté.
      </p>

      <div className="border-t pt-4">
        <button type="button" onClick={onRetour} className="bouton bouton-discret w-full">
          Revenir au mot de passe
        </button>
      </div>
    </form>
  );
}
