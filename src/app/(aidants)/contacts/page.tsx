import { Vide } from '@/components/Puces';
import { contexteAidant } from '@/server/session';
import { contacts as listerContacts } from '@/server/store';
import { LIBELLES_CATEGORIE_CONTACT, type CategorieContact, type Contact } from '@/server/types';
import { NUMEROS_URGENCE, lienUrgence } from '@/server/urgences';
import { CarteContact } from './CarteContact';
import { FormulaireAjout } from './FormulaireContact';

export const metadata = { title: 'Contacts' };
export const dynamic = 'force-dynamic';

/**
 * Le répertoire du foyer.
 *
 * Les fiches sont groupées par catégorie, dans l'ordre d'urgence défini par
 * `CATEGORIES_CONTACT` — pas par ordre alphabétique. Le tri vient du `store`,
 * il n'est pas refait ici : on se contente de couper la liste aux changements
 * de catégorie.
 */
export default async function PageContacts() {
  const { foyer } = await contexteAidant('/contacts');
  const liste = await listerContacts(foyer.id);
  const groupes = grouper(liste);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contacts</h1>
        <p className="text-doux">
          {liste.length === 0
            ? 'Les numéros qu’on cherche toujours au mauvais moment.'
            : `${liste.length} numéro${liste.length > 1 ? 's' : ''} — le médecin, la pharmacie, ` +
              'les personnes à prévenir.'}
        </p>
      </div>

      <FormulaireAjout />

      {liste.length === 0 ? (
        <Vide>
          Rien pour l’instant. Commencez par le médecin traitant et la pharmacie : ce sont les
          deux qu’on cherche en premier. Les numéros d’urgence nationaux sont déjà en bas de
          cette page, inutile de les saisir.
        </Vide>
      ) : null}

      {groupes.map(({ categorie, elements }) => (
        <section key={categorie} className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-doux">
            {LIBELLES_CATEGORIE_CONTACT[categorie]} · {elements.length}
          </h2>
          <ul className="space-y-2">
            {elements.map((contact) => (
              <CarteContact key={contact.id} contact={contact} />
            ))}
          </ul>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-doux">
          Numéros d’urgence nationaux
        </h2>
        <p className="text-sm text-doux">
          Toujours là, rien à saisir. Les quatre premiers sont aussi affichés en grand sur la
          tablette de {foyer.nom}.
        </p>
        <ul className="carte divide-y">
          {NUMEROS_URGENCE.map((urgence) => (
            <li key={urgence.numero} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5">
              <a
                href={lienUrgence(urgence)}
                className="w-14 shrink-0 font-bold text-terre hover:underline"
              >
                {urgence.numero}
              </a>
              <span className="font-semibold">{urgence.nom}</span>
              <span className="w-full text-sm text-doux sm:ml-auto sm:w-auto sm:text-right">
                {urgence.quand}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Découpe la liste déjà triée en paquets consécutifs de même catégorie. */
function grouper(liste: readonly Contact[]): { categorie: CategorieContact; elements: Contact[] }[] {
  const groupes: { categorie: CategorieContact; elements: Contact[] }[] = [];
  for (const contact of liste) {
    const dernier = groupes.at(-1);
    if (dernier?.categorie === contact.categorie) dernier.elements.push(contact);
    else groupes.push({ categorie: contact.categorie, elements: [contact] });
  }
  return groupes;
}
