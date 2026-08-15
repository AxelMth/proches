import { formatDepuis } from '@/server/dates';
import { origine } from '@/server/liens';
import { LONGUEUR_MINIMALE } from '@/server/motdepasse';
import { contexteAidant, sessionCouranteId } from '@/server/session';
import { dateMotDePasse, membres as listerMembres, sessionsDe } from '@/server/store';
import { BoutonRenvoyer } from './BoutonRenvoyer';
import { FormulaireInvitation } from './FormulaireInvitation';
import {
  FormulaireMotDePasse,
  FormulaireSuppressionMotDePasse,
} from './FormulaireMotDePasse';
import { fermerAppareil, regenererLienVue, retirerMembre } from './actions';

export const metadata = { title: 'Famille' };
export const dynamic = 'force-dynamic';

export default async function PageFamille() {
  const { membre, foyer } = await contexteAidant('/famille');
  const [liste, appareils, sessionCourante, motDePasseLe] = await Promise.all([
    listerMembres(foyer.id),
    sessionsDe(membre.id),
    sessionCouranteId(),
    dateMotDePasse(membre.id),
  ]);

  const senior = liste.find((m) => m.role === 'senior');
  const aidants = liste.filter((m) => m.role === 'aidant');
  const base = origine();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Famille</h1>
        <p className="text-doux">Qui a accès à cet espace, et par quel chemin.</p>
      </div>

      {senior ? (
        <section className="carte p-4">
          <h2 className="font-semibold">Le lien de {senior.prenom}</h2>
          <p className="mt-1 text-sm text-doux">
            À ouvrir une fois sur sa tablette, puis à ajouter à l’écran d’accueil. Aucune
            connexion ne lui sera jamais demandée : elle voit ses rendez-vous et ses documents,
            et rien d’autre.
          </p>

          {senior.jetonVue ? (
            <code className="mt-3 block overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 text-sm">
              {base}/a/{senior.jetonVue}
            </code>
          ) : (
            <p className="mt-3 text-sm font-semibold text-alerte">
              Aucun lien actif. Générez-en un ci-dessous.
            </p>
          )}

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-doux hover:text-encre">
              Tablette perdue ou prêtée ?
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-doux">
                Un nouveau lien rend l’ancien inutilisable immédiatement. Il faudra le remettre
                en favori sur son appareil.
              </p>
              <form action={regenererLienVue}>
                <input type="hidden" name="id" value={senior.id} />
                <button type="submit" className="bouton bouton-doux">
                  Générer un nouveau lien
                </button>
              </form>
            </div>
          </details>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-doux">
          Aidants · {aidants.length}
        </h2>
        <ul className="space-y-2">
          {aidants.map((aidant) => (
            <li key={aidant.id} className="carte px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {aidant.prenom}
                    {aidant.id === membre.id ? <span className="text-doux"> — vous</span> : null}
                  </p>
                  <p className="truncate text-sm text-doux">{aidant.email}</p>
                </div>

                {aidant.id === membre.id ? null : (
                  <form action={retirerMembre}>
                    <input type="hidden" name="id" value={aidant.id} />
                    <button type="submit" className="bouton bouton-discret text-alerte">
                      Retirer l’accès
                    </button>
                  </form>
                )}
              </div>

              {/* Un lien magique expire au bout d'une heure. Sans ce bouton, le
                  réflexe est de retirer l'accès pour réinviter — un détour
                  inutile, et une manœuvre qui échouait. */}
              {aidant.id === membre.id ? null : (
                <div className="mt-1">
                  <BoutonRenvoyer id={aidant.id} prenom={aidant.prenom} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="carte p-4">
        <h2 className="font-semibold">Inviter quelqu’un</h2>
        <p className="mb-3 mt-1 text-sm text-doux">
          Un frère, une sœur, une auxiliaire de vie. La personne reçoit un lien de connexion et
          accède aux documents, aux tâches et à l’agenda.
        </p>
        <FormulaireInvitation />
      </section>

      <section className="carte p-4">
        <h2 className="font-semibold">Votre mot de passe</h2>
        <p className="mt-1 text-sm text-doux">
          {motDePasseLe
            ? `Défini ${formatDepuis(motDePasseLe)}. Vous pouvez vous connecter avec, ou continuer ` +
              'à demander un lien par courriel — les deux fonctionnent.'
            : 'Vous n’en avez pas : vous entrez par un lien reçu par courriel. En définir un ' +
              'évite d’aller chercher ce courriel à chaque nouvel appareil. Le lien continuera ' +
              'de fonctionner, et c’est lui qui vous dépannera si vous oubliez ce mot de passe.'}
        </p>

        <FormulaireMotDePasse
          existant={motDePasseLe != null}
          longueurMinimale={LONGUEUR_MINIMALE}
        />

        {motDePasseLe ? <FormulaireSuppressionMotDePasse /> : null}
      </section>

      <section className="carte p-4">
        <h2 className="font-semibold">Vos appareils connectés</h2>
        <p className="mb-3 mt-1 text-sm text-doux">
          Vous restez connecté un an, et chaque visite repousse l’échéance : en principe,
          vous n’aurez plus à redemander de lien. Fermez ici l’appareil que vous avez prêté
          ou perdu.
        </p>

        <ul className="space-y-2">
          {appareils.map((appareil) => (
            <li key={appareil.id} className="flex flex-wrap items-center gap-3 border-t pt-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {appareil.appareil ?? 'Appareil inconnu'}
                  {appareil.id === sessionCourante ? (
                    <span className="text-doux"> — celui-ci</span>
                  ) : null}
                </p>
                <p className="text-sm text-doux">
                  Connecté {formatDepuis(appareil.creeLe)} · vu {formatDepuis(appareil.vuLe)}
                </p>
              </div>

              {appareil.id === sessionCourante ? (
                <form action="/deconnexion" method="post">
                  <button type="submit" className="bouton bouton-discret">
                    Se déconnecter
                  </button>
                </form>
              ) : (
                <form action={fermerAppareil}>
                  <input type="hidden" name="id" value={appareil.id} />
                  <button type="submit" className="bouton bouton-discret text-alerte">
                    Fermer
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="carte p-4">
        <h2 className="font-semibold">Votre agenda personnel</h2>
        <p className="mt-1 text-sm text-doux">
          Adresse à coller dans Google Agenda ou Calendrier Apple pour retrouver les rendez-vous
          au milieu des vôtres. Elle vous est personnelle.
        </p>
        <code className="mt-2 block overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 text-sm">
          {base}/api/agenda/{membre.jetonAgenda}/proches.ics
        </code>
      </section>
    </div>
  );
}
