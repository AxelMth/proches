'use client';

import { useActionState, useState } from 'react';
import { BoutonSoumettre } from '@/components/BoutonSoumettre';
import { Alerte } from '@/components/Puces';
import { LIBELLES_CATEGORIE_EVENEMENT, type CategorieEvenement } from '@/server/types';
import { ajouterEvenement, enregistrerEvenement, type EtatFormulaire } from './actions';

const INITIAL: EtatFormulaire = {};
const CATEGORIES = Object.entries(LIBELLES_CATEGORIE_EVENEMENT) as [CategorieEvenement, string][];

export interface ValeursEvenement {
  id?: string;
  titre: string;
  categorie: CategorieEvenement;
  lieu: string;
  notes: string;
  journeeEntiere: boolean;
  /** `AAAA-MM-JJTHH:MM`, déjà converti à l'heure de Paris par le serveur. */
  debut: string;
  fin: string;
}

/**
 * Un seul formulaire pour l'ajout et l'édition : les deux ont exactement les
 * mêmes champs, et les faire diverger garantirait qu'un jour on ajoute une
 * option d'un côté seulement.
 */
export function FormulaireEvenement({
  valeurs,
  edition = false,
  onFini,
}: {
  valeurs: ValeursEvenement;
  edition?: boolean;
  onFini?: () => void;
}) {
  const [etat, action] = useActionState(
    edition ? enregistrerEvenement : ajouterEvenement,
    INITIAL,
  );
  const [journeeEntiere, setJourneeEntiere] = useState(valeurs.journeeEntiere);
  const cle = valeurs.id ?? 'nouveau';

  return (
    <form
      action={async (donnees) => {
        await action(donnees);
        onFini?.();
      }}
      className="space-y-3"
    >
      {valeurs.id ? <input type="hidden" name="id" value={valeurs.id} /> : null}

      <div>
        <label htmlFor={`titre-${cle}`} className="libelle">
          De quoi s’agit-il
        </label>
        <input
          id={`titre-${cle}`}
          name="titre"
          required
          maxLength={200}
          defaultValue={valeurs.titre}
          placeholder="Cardiologue, Dr Bernard"
          className="champ"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`categorie-${cle}`} className="libelle">
            Type
          </label>
          <select
            id={`categorie-${cle}`}
            name="categorie"
            defaultValue={valeurs.categorie}
            className="champ"
          >
            {CATEGORIES.map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`lieu-${cle}`} className="libelle">
            Où
          </label>
          <input
            id={`lieu-${cle}`}
            name="lieu"
            maxLength={200}
            defaultValue={valeurs.lieu}
            placeholder="12 rue des Lilas"
            className="champ"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`journee-${cle}`}
          type="checkbox"
          name="journeeEntiere"
          checked={journeeEntiere}
          onChange={(evenement) => setJourneeEntiere(evenement.target.checked)}
          className="size-5"
        />
        {/* `id`/`htmlFor` explicites plutôt qu'un `<label>` englobant : ce
            dernier laissait certains outils calculer le nom accessible depuis
            l'attribut `value` de la case, soit « on ». */}
        <label htmlFor={`journee-${cle}`} className="font-medium">
          Toute la journée
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`debut-${cle}`} className="libelle">
            {journeeEntiere ? 'Le' : 'Début'}
          </label>
          <input
            id={`debut-${cle}`}
            name="debut"
            type={journeeEntiere ? 'date' : 'datetime-local'}
            required
            defaultValue={journeeEntiere ? valeurs.debut.slice(0, 10) : valeurs.debut}
            className="champ"
          />
        </div>

        <div>
          <label htmlFor={`fin-${cle}`} className="libelle">
            {journeeEntiere ? 'Jusqu’au (facultatif)' : 'Fin (facultatif)'}
          </label>
          <input
            id={`fin-${cle}`}
            name="fin"
            type={journeeEntiere ? 'date' : 'datetime-local'}
            defaultValue={journeeEntiere ? valeurs.fin.slice(0, 10) : valeurs.fin}
            className="champ"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`notes-${cle}`} className="libelle">
          À ne pas oublier
        </label>
        <textarea
          id={`notes-${cle}`}
          name="notes"
          rows={2}
          defaultValue={valeurs.notes}
          placeholder="Apporter la carte Vitale et les dernières analyses"
          className="champ"
        />
      </div>

      <Alerte>{etat.message}</Alerte>

      <BoutonSoumettre
        className={edition ? 'bouton bouton-doux' : 'bouton'}
        enCours="Enregistrement…"
      >
        {edition ? 'Enregistrer' : 'Ajouter au calendrier'}
      </BoutonSoumettre>
    </form>
  );
}
