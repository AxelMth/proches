import { PuceContact } from '@/components/Puces';
import { lienTelephone, type Contact } from '@/server/types';
import { FormulaireEdition } from './FormulaireContact';
import { retirerContact } from './actions';

/**
 * Une fiche du répertoire.
 *
 * Le numéro est le seul élément mis en couleur et en gros : c'est ce qu'on
 * vient chercher. Il est cliquable partout — sur un téléphone, un `tel:` lance
 * l'appel, et c'est un chiffre de moins à recopier sous la panique.
 */
export function CarteContact({ contact }: { contact: Contact }) {
  return (
    <li className="carte px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold">{contact.nom}</p>
        <PuceContact categorie={contact.categorie} />
      </div>

      <a
        href={lienTelephone(contact.telephone)}
        className="mt-1 inline-block text-lg font-bold text-terre hover:underline"
      >
        {contact.telephone}
      </a>

      {contact.adresse ? <p className="mt-0.5 text-sm text-doux">{contact.adresse}</p> : null}

      {contact.email ? (
        <p className="mt-0.5 text-sm">
          <a href={`mailto:${contact.email}`} className="lien">
            {contact.email}
          </a>
        </p>
      ) : null}

      {contact.notes ? (
        <p className="mt-1.5 whitespace-pre-line text-sm text-doux">{contact.notes}</p>
      ) : null}

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-doux hover:text-encre">Modifier</summary>
        <div className="mt-3 space-y-3 border-t pt-3">
          <FormulaireEdition contact={contact} />
          <form action={retirerContact}>
            <input type="hidden" name="id" value={contact.id} />
            <button type="submit" className="bouton bouton-discret text-alerte">
              Retirer du répertoire
            </button>
          </form>
        </div>
      </details>
    </li>
  );
}
