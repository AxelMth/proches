import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatJourCourt, jourDe } from '@/server/dates';
import { documents as listerDocuments, membreParJetonVue } from '@/server/store';
import { LIBELLES_CATEGORIE_DOCUMENT } from '@/server/types';

export const metadata = { title: 'Mes documents' };
export const dynamic = 'force-dynamic';

/**
 * Les documents, en lecture. Une seule colonne, aucun filtre ni recherche :
 * chercher suppose de savoir ce qu'on cherche, et la liste est courte.
 *
 * Un document à plusieurs pièces les montre toutes, l'une sous l'autre : « page
 * 1 », « page 2 » se comprend sans explication, un document replié non.
 */
export default async function PageDocumentsSenior({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  const { jeton } = await params;
  const membre = await membreParJetonVue(jeton);
  if (!membre) notFound();

  const liste = await listerDocuments(membre.foyerId);

  return (
    <main id="contenu" className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Mes documents</h1>
      </header>

      {liste.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-5 py-6 text-doux">
          Aucun document pour le moment.
        </p>
      ) : (
        <ul className="space-y-4">
          {liste.map((document) => (
            <li key={document.id} className="carte p-5">
              <p className="font-semibold">{document.titre}</p>
              <p className="mt-1 text-doux">
                {LIBELLES_CATEGORIE_DOCUMENT[document.categorie]} ·{' '}
                {formatJourCourt(jourDe(document.creeLe))}
              </p>

              <ul className="mt-3 space-y-2">
                {document.fichiers.map((fichier, index) => (
                  <li key={fichier.id}>
                    <a
                      href={`/a/${jeton}/fichiers/${fichier.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bouton bouton-doux w-full justify-center"
                    >
                      {document.fichiers.length === 1
                        ? 'Ouvrir'
                        : `Ouvrir la page ${index + 1}`}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <Link href={`/a/${jeton}`} className="bouton bouton-doux w-full justify-center py-5">
        Revenir à aujourd’hui
      </Link>
    </main>
  );
}
