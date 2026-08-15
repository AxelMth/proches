import Link from 'next/link';
import { Vide } from '@/components/Puces';
import { tailleMaxOctets } from '@/server/formats';
import { contexteAidant } from '@/server/session';
import { documents as listerDocuments } from '@/server/store';
import {
  CATEGORIES_DOCUMENT,
  LIBELLES_CATEGORIE_DOCUMENT,
  type CategorieDocument,
} from '@/server/types';
import { FicheDocument, type Vue } from './FicheDocument';
import { FormulaireDocument } from './FormulaireDocument';

export const metadata = { title: 'Documents' };
export const dynamic = 'force-dynamic';

const VUES: { valeur: Vue; libelle: string }[] = [
  { valeur: 'liste', libelle: 'Liste' },
  { valeur: 'cartes', libelle: 'Cartes' },
  { valeur: 'apercu', libelle: 'Aperçu' },
];

function estCategorie(valeur: unknown): valeur is CategorieDocument {
  return typeof valeur === 'string' && (CATEGORIES_DOCUMENT as readonly string[]).includes(valeur);
}

function estVue(valeur: unknown): valeur is Vue {
  return valeur === 'liste' || valeur === 'cartes' || valeur === 'apercu';
}

export default async function PageDocuments({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { foyer } = await contexteAidant('/documents');
  const params = await searchParams;

  const categorie = estCategorie(params.categorie) ? params.categorie : undefined;
  const recherche = typeof params.q === 'string' && params.q.trim() ? params.q : undefined;
  const vue: Vue = estVue(params.vue) ? params.vue : 'cartes';

  const liste = await listerDocuments(foyer.id, { categorie, recherche });

  /** L'état de la page tient entièrement dans l'URL : elle reste partageable. */
  const lien = (
    changements: { categorie?: CategorieDocument | null; q?: string | null; vue?: Vue } = {},
  ): string => {
    const query = new URLSearchParams();
    const cat = changements.categorie === undefined ? categorie : changements.categorie;
    const q = changements.q === undefined ? recherche : changements.q;
    const v = changements.vue ?? vue;

    if (cat) query.set('categorie', cat);
    if (q) query.set('q', q);
    if (v !== 'cartes') query.set('vue', v);

    const suffixe = query.toString();
    return suffixe ? `/documents?${suffixe}` : '/documents';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-doux">
          Ordonnances, mutuelle, impôts — tout ce qu’on cherche toujours au mauvais moment.
        </p>
      </div>

      <div className="space-y-3">
        <form action="/documents" className="flex flex-wrap gap-2">
          {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
          {vue !== 'cartes' ? <input type="hidden" name="vue" value={vue} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={recherche ?? ''}
            placeholder="Rechercher un document"
            aria-label="Rechercher un document"
            className="champ min-w-48 flex-1"
          />
          <button type="submit" className="bouton bouton-doux">
            Chercher
          </button>
          {/* Un lien, pas un bouton : le « × » natif de `type=search` n'existe
              pas dans tous les navigateurs et ne relance pas la recherche. */}
          {recherche ? (
            <Link href={lien({ q: null })} className="bouton bouton-discret">
              Effacer
            </Link>
          ) : null}
        </form>

        {recherche ? (
          <p className="text-sm text-doux">
            {liste.length} résultat{liste.length > 1 ? 's' : ''} pour « {recherche} ».
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filtrer par catégorie" className="flex flex-wrap gap-2">
            <Link
              href={lien({ categorie: null })}
              aria-current={!categorie ? 'true' : undefined}
              className={`puce ${!categorie ? 'bg-encre text-white' : 'bg-surface-2 text-doux'}`}
            >
              Tous
            </Link>
            {CATEGORIES_DOCUMENT.map((valeur) => (
              <Link
                key={valeur}
                href={lien({ categorie: valeur })}
                aria-current={categorie === valeur ? 'true' : undefined}
                className={`puce ${
                  categorie === valeur ? 'bg-encre text-white' : 'bg-surface-2 text-doux'
                }`}
              >
                {LIBELLES_CATEGORIE_DOCUMENT[valeur]}
              </Link>
            ))}
          </nav>

          <nav aria-label="Affichage" className="flex gap-1 rounded-full bg-surface-2 p-1">
            {VUES.map(({ valeur, libelle }) => (
              <Link
                key={valeur}
                href={lien({ vue: valeur })}
                aria-current={vue === valeur ? 'true' : undefined}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  vue === valeur ? 'bg-surface text-encre shadow-sm' : 'text-doux'
                }`}
              >
                {libelle}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {liste.length === 0 ? (
        <Vide>
          {recherche || categorie
            ? 'Aucun document ne correspond. Essayez sans filtre.'
            : 'Aucun document pour l’instant. Commencez par la carte Vitale et l’attestation de mutuelle.'}
        </Vide>
      ) : (
        <ul
          className={
            vue === 'liste'
              ? 'space-y-2'
              : vue === 'apercu'
                ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid gap-3 sm:grid-cols-2'
          }
        >
          {liste.map((document) => (
            <FicheDocument
              key={document.id}
              document={document}
              vue={vue}
              tailleMax={tailleMaxOctets()}
            />
          ))}
        </ul>
      )}

      <details className="carte p-4">
        <summary className="cursor-pointer font-semibold">Déposer un document</summary>
        <div className="mt-4">
          <FormulaireDocument tailleMax={tailleMaxOctets()} />
        </div>
      </details>
    </div>
  );
}
