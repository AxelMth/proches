import { redirect } from 'next/navigation';
import { Marque } from '@/components/Marque';
import { membreConnecte } from '@/server/session';
import { FormulaireConnexion } from './FormulaireConnexion';

export const metadata = { title: 'Connexion' };
export const dynamic = 'force-dynamic';

const ERREURS: Record<string, string> = {
  jeton: 'Ce lien n’est plus valable — il a expiré ou a déjà été utilisé. Demandez-en un nouveau.',
};

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const suite = typeof params.suite === 'string' && params.suite.startsWith('/')
    ? params.suite
    : undefined;

  if (await membreConnecte()) redirect(suite ?? '/');

  const erreur = typeof params.erreur === 'string' ? ERREURS[params.erreur] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <Marque taille={44} />
        <h1 className="mt-3 text-2xl font-bold">Proches</h1>
        <p className="mt-1 text-doux">
          Les documents, les choses à faire et l’agenda, au même endroit.
        </p>
      </div>

      <div className="carte p-6">
        {erreur ? (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-alerte-clair px-3 py-2 text-sm font-semibold text-alerte"
          >
            {erreur}
          </p>
        ) : null}

        <FormulaireConnexion suite={suite} />
      </div>

      <p className="text-center text-sm text-doux">
        Cet espace est réservé aux personnes invitées par un membre du foyer.
      </p>
    </main>
  );
}
