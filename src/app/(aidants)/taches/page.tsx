import { Vide } from '@/components/Puces';
import { aujourdhui, ecartJours } from '@/server/dates';
import { contexteAidant } from '@/server/session';
import { membres as listerMembres, taches as listerTaches } from '@/server/store';
import type { Tache } from '@/server/types';
import { FormulaireAjout } from './FormulaireTache';
import { LigneTache } from './LigneTache';

export const metadata = { title: 'À faire' };
export const dynamic = 'force-dynamic';

export default async function PageTaches() {
  const { foyer } = await contexteAidant('/taches');
  const [toutes, tous] = await Promise.all([listerTaches(foyer.id), listerMembres(foyer.id)]);

  // Seuls les aidants peuvent se voir confier une tâche : la personne
  // accompagnée ne voit pas cette page, lui assigner quelque chose n'aurait
  // aucun destinataire.
  const membres = tous.filter((personne) => personne.role === 'aidant');

  const jour = aujourdhui();
  const enCours = toutes.filter((t) => t.faiteLe == null);
  const faites = toutes.filter((t) => t.faiteLe != null).slice(0, 30);

  const echeanceDans = (tache: Tache): number | null =>
    tache.echeance ? ecartJours(jour, tache.echeance) : null;

  const sections: { titre: string; taches: Tache[]; ton?: string }[] = [
    {
      titre: 'En retard',
      ton: 'text-alerte',
      taches: enCours.filter((t) => (echeanceDans(t) ?? 1) < 0),
    },
    { titre: "Aujourd'hui", taches: enCours.filter((t) => echeanceDans(t) === 0) },
    { titre: 'À venir', taches: enCours.filter((t) => (echeanceDans(t) ?? -1) > 0) },
    { titre: 'Sans date', taches: enCours.filter((t) => t.echeance == null) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">À faire</h1>
        <p className="text-doux">
          {enCours.length === 0
            ? 'Rien en attente.'
            : `${enCours.length} chose${enCours.length > 1 ? 's' : ''} en attente.`}
        </p>
      </div>

      <FormulaireAjout membres={membres} />

      {enCours.length === 0 ? (
        <Vide>Tout est fait. Ajoutez ce qui vient d’être décidé pour ne pas l’oublier.</Vide>
      ) : null}

      {sections
        .filter((section) => section.taches.length > 0)
        .map((section) => (
          <section key={section.titre} className="space-y-2">
            <h2 className={`text-sm font-bold uppercase tracking-wide ${section.ton ?? 'text-doux'}`}>
              {section.titre} · {section.taches.length}
            </h2>
            <ul className="space-y-2">
              {section.taches.map((tache) => (
                <LigneTache key={tache.id} tache={tache} membres={membres} />
              ))}
            </ul>
          </section>
        ))}

      {faites.length > 0 ? (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-doux">
            Déjà fait · {faites.length}
          </summary>
          <ul className="mt-2 space-y-2">
            {faites.map((tache) => (
              <LigneTache key={tache.id} tache={tache} membres={membres} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
