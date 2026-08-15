'use client';

import { useActionState, useRef } from 'react';
import { BoutonSoumettre } from '@/components/BoutonSoumettre';
import { Alerte } from '@/components/Puces';
import type { Membre, Tache } from '@/server/types';
import { ajouterTache, enregistrerTache, type EtatFormulaire } from './actions';

const INITIAL: EtatFormulaire = {};

/**
 * Ajout d'une tâche. Le champ « intitulé » est seul en haut : dans 80 % des
 * cas on tape trois mots et on valide. Le reste (date, personne, priorité,
 * précisions) reste à portée, sans occuper l'écran.
 */
export function FormulaireAjout({ membres }: { membres: readonly Membre[] }) {
  const [etat, action] = useActionState(ajouterTache, INITIAL);
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
      <div>
        <label htmlFor="titre" className="libelle">
          Quelque chose à faire
        </label>
        <input
          id="titre"
          name="titre"
          required
          maxLength={200}
          placeholder="Prendre rendez-vous chez le dentiste"
          className="champ"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ChampsCommuns membres={membres} />
      </div>

      <Alerte>{etat.message}</Alerte>

      <BoutonSoumettre enCours="Ajout…">Ajouter</BoutonSoumettre>
    </form>
  );
}

/** Édition d'une tâche existante, repliée sous la ligne. */
export function FormulaireEdition({
  tache,
  membres,
}: {
  tache: Tache;
  membres: readonly Membre[];
}) {
  const [etat, action] = useActionState(enregistrerTache, INITIAL);

  return (
    <form action={action} className="space-y-3 border-t pt-3">
      <input type="hidden" name="id" value={tache.id} />

      <div>
        <label htmlFor={`titre-${tache.id}`} className="libelle">
          Intitulé
        </label>
        <input
          id={`titre-${tache.id}`}
          name="titre"
          required
          maxLength={200}
          defaultValue={tache.titre}
          className="champ"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ChampsCommuns membres={membres} tache={tache} />
      </div>

      <div>
        <label htmlFor={`details-${tache.id}`} className="libelle">
          Précisions
        </label>
        <textarea
          id={`details-${tache.id}`}
          name="details"
          rows={2}
          defaultValue={tache.details ?? ''}
          className="champ"
        />
      </div>

      <Alerte>{etat.message}</Alerte>

      <BoutonSoumettre className="bouton bouton-doux" enCours="Enregistrement…">
        Enregistrer
      </BoutonSoumettre>
    </form>
  );
}

function ChampsCommuns({ membres, tache }: { membres: readonly Membre[]; tache?: Tache }) {
  const suffixe = tache ? `-${tache.id}` : '';

  return (
    <>
      <div>
        <label htmlFor={`echeance${suffixe}`} className="libelle">
          Pour quand
        </label>
        <input
          id={`echeance${suffixe}`}
          name="echeance"
          type="date"
          defaultValue={tache?.echeance ?? ''}
          className="champ"
        />
      </div>

      <div>
        <label htmlFor={`assigneeId${suffixe}`} className="libelle">
          Qui s’en occupe
        </label>
        <select
          id={`assigneeId${suffixe}`}
          name="assigneeId"
          defaultValue={tache?.assigneeId ?? ''}
          className="champ"
        >
          <option value="">Peu importe</option>
          {membres.map((membre) => (
            <option key={membre.id} value={membre.id}>
              {membre.prenom}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`priorite${suffixe}`} className="libelle">
          Priorité
        </label>
        <select
          id={`priorite${suffixe}`}
          name="priorite"
          defaultValue={tache?.priorite ?? 'normale'}
          className="champ"
        >
          <option value="normale">Normale</option>
          <option value="haute">Important</option>
        </select>
      </div>
    </>
  );
}
