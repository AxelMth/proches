import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contacts as listerContacts, membreParJetonVue } from '@/server/store';
import { LIBELLES_CATEGORIE_CONTACT, lienTelephone } from '@/server/types';
import { URGENCES_ESSENTIELLES, lienUrgence } from '@/server/urgences';

export const metadata = { title: 'Qui appeler' };
export const dynamic = 'force-dynamic';

/**
 * Les numéros, en lecture, sur la tablette.
 *
 * Contrairement aux tâches — que la personne accompagnée ne voit pas, parce
 * qu'une liste de choses que d'autres doivent faire pour soi n'informe pas,
 * elle inquiète — un répertoire est exactement l'inverse : il rend autonome.
 * C'est le seul écran de cette vue qui serve à *faire* quelque chose.
 *
 * Le numéro est écrit en toutes lettres autant qu'il est cliquable : sur une
 * tablette sans carte SIM, `tel:` n'aboutit nulle part, et il faut alors
 * pouvoir le composer sur le téléphone posé à côté.
 */
export default async function PageContactsSenior({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  const { jeton } = await params;
  const membre = await membreParJetonVue(jeton);
  if (!membre) notFound();

  const liste = await listerContacts(membre.foyerId);

  return (
    <main id="contenu" className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold">Qui appeler</h1>
      </header>

      <section>
        <h2 className="mb-3 text-2xl font-bold">En cas d’urgence</h2>
        <ul className="space-y-3">
          {URGENCES_ESSENTIELLES.map((urgence) => (
            <li key={urgence.numero}>
              <a
                href={lienUrgence(urgence)}
                className="carte flex items-center gap-5 bg-alerte-clair p-5"
              >
                <span className="w-24 shrink-0 text-4xl font-bold text-alerte">
                  {urgence.numero}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{urgence.nom}</span>
                  <span className="block text-xl text-doux">{urgence.quand}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold">Mes contacts</h2>

        {liste.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-5 py-6 text-doux">
            Aucun numéro enregistré pour le moment.
          </p>
        ) : (
          <ul className="space-y-4">
            {liste.map((contact) => (
              <li key={contact.id} className="carte p-5">
                <p className="font-semibold">{contact.nom}</p>
                <p className="mt-1 text-xl text-doux">
                  {LIBELLES_CATEGORIE_CONTACT[contact.categorie]}
                </p>

                <a
                  href={lienTelephone(contact.telephone)}
                  className="bouton bouton-doux mt-3 w-full justify-center font-bold text-terre"
                >
                  {contact.telephone}
                </a>

                {contact.adresse ? (
                  <p className="mt-3 text-xl text-doux">{contact.adresse}</p>
                ) : null}
                {contact.notes ? (
                  <p className="mt-1 whitespace-pre-line text-xl text-doux">{contact.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href={`/a/${jeton}`} className="bouton bouton-doux w-full justify-center py-5">
        Revenir à aujourd’hui
      </Link>
    </main>
  );
}
