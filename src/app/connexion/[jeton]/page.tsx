import Link from 'next/link';
import { Marque } from '@/components/Marque';
import { etatLien } from '@/server/liens';
import { membreParId } from '@/server/store';
import { BoutonRenvoi } from './BoutonRenvoi';
import { confirmerConnexion } from './actions';

export const metadata = { title: 'Connexion' };
export const dynamic = 'force-dynamic';

/**
 * Page de confirmation d'un lien de connexion.
 *
 * **Ouvrir cette page ne consomme rien.** C'est tout l'objet du découpage : les
 * messageries d'entreprise — Outlook et son Defender « Safe Links » en premier
 * lieu — ouvrent chaque URL reçue pour l'analyser. Avec un jeton consommé au
 * `GET`, l'analyseur le brûlait en une trentaine de secondes et le destinataire
 * trouvait un lien « déjà utilisé ». Ici, seul le bouton ci-dessous ouvre la
 * session, et un bouton, ça ne s'analyse pas.
 */
export default async function PageLienConnexion({
  params,
  searchParams,
}: {
  params: Promise<{ jeton: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { jeton } = await params;
  const sp = await searchParams;
  const suite = typeof sp.suite === 'string' && sp.suite.startsWith('/') ? sp.suite : '';

  const etat = await etatLien(jeton);
  const membre = etat.statut === 'inconnu' ? null : await membreParId(etat.membreId);
  const utilisable = etat.statut === 'valide' && membre?.role === 'aidant';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <Marque taille={44} />
        <h1 className="mt-3 text-2xl font-bold">Proches</h1>
      </div>

      <div className="carte space-y-4 p-6">
        {utilisable && membre ? (
          <>
            <div>
              <h2 className="text-xl font-bold">Bonjour {membre.prenom}</h2>
              <p className="mt-1 text-doux">
                Cliquez pour ouvrir votre espace. Vous resterez connecté sur cet appareil —
                pas besoin de redemander un lien à chaque fois.
              </p>
            </div>

            <form action={confirmerConnexion}>
              <input type="hidden" name="jeton" value={jeton} />
              {suite ? <input type="hidden" name="suite" value={suite} /> : null}
              <button type="submit" className="bouton w-full">
                Ouvrir mon espace
              </button>
            </form>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold">
                {etat.statut === 'utilise' ? 'Ce lien a déjà servi' : 'Ce lien n’est plus valable'}
              </h2>
              <p className="mt-1 text-doux">
                {etat.statut === 'utilise'
                  ? 'Il ne fonctionne qu’une fois. Si vous ne l’avez pas utilisé vous-même, ' +
                    'c’est probablement l’antivirus de votre messagerie qui l’a ouvert avant vous.'
                  : etat.statut === 'expire'
                    ? 'Les liens de connexion expirent au bout d’une heure.'
                    : 'Ce lien est inconnu — il a peut-être été tronqué en chemin.'}
              </p>
            </div>

            {membre ? (
              <BoutonRenvoi jeton={jeton} />
            ) : (
              <Link href="/connexion" className="bouton w-full">
                Demander un lien
              </Link>
            )}
          </>
        )}
      </div>

      <p className="text-center text-sm text-doux">
        <Link href="/connexion" className="lien">
          Utiliser une autre adresse
        </Link>
      </p>
    </main>
  );
}
