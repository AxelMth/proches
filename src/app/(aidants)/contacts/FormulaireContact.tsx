'use client';

import { useActionState, useRef } from 'react';
import { BoutonSoumettre } from '@/components/BoutonSoumettre';
import { Alerte } from '@/components/Puces';
import { CATEGORIES_CONTACT, LIBELLES_CATEGORIE_CONTACT, type Contact } from '@/server/types';
import { ajouterContact, enregistrerContact, type EtatFormulaire } from './actions';

const INITIAL: EtatFormulaire = {};

/**
 * Ajout d'un contact.
 *
 * Un nom et un numéro suffisent, et c'est tout ce qu'on demande d'emblée : la
 * fiche complète — courriel, adresse, précisions — se déplie pour qui a le
 * temps. Le geste courant est de recopier un numéro trouvé sur une ordonnance,
 * debout, avant de l'oublier.
 */
export function FormulaireAjout() {
  const [etat, action] = useActionState(ajouterContact, INITIAL);
  const formulaire = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formulaire}
      action={async (donnees) => {
        await action(donnees);
        formulaire.current?.reset();
      }}
      className="carte space-y-3 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ChampNom />
        <ChampTelephone />
      </div>

      <ChampCategorie />

      <details className="text-sm">
        <summary className="cursor-pointer text-doux hover:text-encre">
          Adresse, courriel, précisions
        </summary>
        <div className="mt-3 space-y-3">
          <ChampsSecondaires />
        </div>
      </details>

      <Alerte>{etat.message}</Alerte>

      <BoutonSoumettre enCours="Ajout…">Ajouter au répertoire</BoutonSoumettre>
    </form>
  );
}

/** Édition d'un contact existant, repliée sous sa fiche. */
export function FormulaireEdition({ contact }: { contact: Contact }) {
  const [etat, action] = useActionState(enregistrerContact, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={contact.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <ChampNom contact={contact} />
        <ChampTelephone contact={contact} />
      </div>

      <ChampCategorie contact={contact} />
      <ChampsSecondaires contact={contact} />

      <Alerte>{etat.message}</Alerte>

      <BoutonSoumettre className="bouton bouton-doux" enCours="Enregistrement…">
        Enregistrer
      </BoutonSoumettre>
    </form>
  );
}

/**
 * Les identifiants des champs doivent rester uniques : la page affiche autant
 * de formulaires d'édition que de contacts, tous montés en même temps.
 */
function suffixeDe(contact?: Contact): string {
  return contact ? `-${contact.id}` : '';
}

function ChampNom({ contact }: { contact?: Contact }) {
  const id = `nom${suffixeDe(contact)}`;
  return (
    <div>
      <label htmlFor={id} className="libelle">
        Qui
      </label>
      <input
        id={id}
        name="nom"
        required
        maxLength={120}
        defaultValue={contact?.nom ?? ''}
        placeholder="Docteur Lemoine"
        className="champ"
      />
    </div>
  );
}

function ChampTelephone({ contact }: { contact?: Contact }) {
  const id = `telephone${suffixeDe(contact)}`;
  return (
    <div>
      <label htmlFor={id} className="libelle">
        Numéro
      </label>
      {/* `type="tel"` fait apparaître le pavé numérique sur mobile — et n'impose
          aucun format, contrairement à `type="number"` qui refuserait les
          espaces, le `+` de l'indicatif et le 0 initial. */}
      <input
        id={id}
        name="telephone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        maxLength={40}
        defaultValue={contact?.telephone ?? ''}
        placeholder="01 42 86 12 34"
        className="champ"
      />
    </div>
  );
}

function ChampCategorie({ contact }: { contact?: Contact }) {
  const id = `categorie${suffixeDe(contact)}`;
  return (
    <div>
      <label htmlFor={id} className="libelle">
        Pour quoi on l’appelle
      </label>
      <select
        id={id}
        name="categorie"
        defaultValue={contact?.categorie ?? 'autre'}
        className="champ"
      >
        {CATEGORIES_CONTACT.map((categorie) => (
          <option key={categorie} value={categorie}>
            {LIBELLES_CATEGORIE_CONTACT[categorie]}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChampsSecondaires({ contact }: { contact?: Contact }) {
  const suffixe = suffixeDe(contact);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`email${suffixe}`} className="libelle">
            Courriel
          </label>
          {/* `inputMode` et non `type="email"` : ces champs vivent dans un volet
              repliable, et le navigateur refuse d'envoyer un formulaire dont un
              champ invalide n'est pas visible — sans rien afficher, puisqu'il ne
              peut pas y poser son infobulle. Une adresse mal saisie puis le
              volet refermé, et le bouton « Ajouter » ne faisait plus rien. Le
              contrôle est donc côté serveur, où le message est rendu par
              `Alerte` ; le clavier du mobile reste celui d'une adresse. */}
          <input
            id={`email${suffixe}`}
            name="email"
            inputMode="email"
            autoComplete="email"
            maxLength={200}
            defaultValue={contact?.email ?? ''}
            className="champ"
          />
        </div>

        <div>
          <label htmlFor={`adresse${suffixe}`} className="libelle">
            Adresse
          </label>
          <input
            id={`adresse${suffixe}`}
            name="adresse"
            maxLength={300}
            defaultValue={contact?.adresse ?? ''}
            placeholder="12 rue des Lilas, Vincennes"
            className="champ"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`notes${suffixe}`} className="libelle">
          Précisions
        </label>
        <textarea
          id={`notes${suffixe}`}
          name="notes"
          rows={2}
          defaultValue={contact?.notes ?? ''}
          placeholder="Cabinet fermé le mercredi. Demander le docteur, pas le secrétariat."
          className="champ"
        />
      </div>
    </>
  );
}
