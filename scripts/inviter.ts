import './load-env';

import { pool } from '../src/server/db';
import { jetonAleatoire, origine } from '../src/server/liens';
import { creerFoyer, creerMembre, foyer, membreParEmail, membres } from '../src/server/store';

/**
 * Amorce d'une installation : crée le foyer, la personne accompagnée et le
 * premier aidant. Sans lui, une base fraîchement migrée n'a aucun compte, donc
 * aucune porte d'entrée — la page de connexion ne crée jamais de membre, c'est
 * ce qui empêche n'importe qui de s'inviter tout seul.
 *
 *   pnpm db:inviter "Jeanne Dupont" "Axel" axel@exemple.fr
 *
 * Rejouable : ajoute simplement un aidant si le foyer existe déjà.
 */

async function main(): Promise<void> {
  const [nomAccompagne, prenomAidant, emailAidant] = process.argv.slice(2);

  if (!nomAccompagne || !prenomAidant || !emailAidant) {
    console.error(
      'Usage : pnpm db:inviter "<nom de la personne accompagnée>" "<prénom aidant>" <email aidant>\n' +
        'Exemple : pnpm db:inviter "Jeanne Dupont" "Axel" axel@exemple.fr',
    );
    process.exit(1);
  }

  const existant = await foyer().catch(() => null);
  const leFoyer = existant ?? (await creerFoyer(nomAccompagne));

  if (!existant) {
    // La personne accompagnée est un membre comme un autre, à ceci près
    // qu'elle a un `jeton_vue` : c'est son lien permanent, et son seul accès.
    await creerMembre({
      foyerId: leFoyer.id,
      prenom: nomAccompagne.split(' ')[0] ?? nomAccompagne,
      // Adresse de convenance : elle ne reçoit jamais de courriel, mais la
      // contrainte d'unicité sur `email` demande une valeur.
      email: `senior+${leFoyer.id}@proches.local`,
      role: 'senior',
      jetonVue: jetonAleatoire(24),
      jetonAgenda: jetonAleatoire(24),
    });
    console.log(`Foyer créé : ${leFoyer.nom}`);
  } else {
    console.log(`Foyer existant : ${leFoyer.nom}`);
  }

  if (await membreParEmail(emailAidant)) {
    console.log(`${emailAidant} est déjà membre — rien à faire.`);
  } else {
    await creerMembre({
      foyerId: leFoyer.id,
      prenom: prenomAidant,
      email: emailAidant,
      role: 'aidant',
      jetonVue: null,
      jetonAgenda: jetonAleatoire(24),
    });
    console.log(`Aidant ajouté : ${prenomAidant} <${emailAidant}>`);
  }

  const senior = (await membres(leFoyer.id)).find((m) => m.role === 'senior');
  if (senior?.jetonVue) {
    console.log(
      `\nLien permanent de ${senior.prenom} — à mettre en favori sur sa tablette :\n` +
        `  ${origine()}/a/${senior.jetonVue}\n`,
    );
  }
  console.log(`Connexion des aidants : ${origine()}/connexion`);

  await pool().end();
}

main().catch((erreur: unknown) => {
  console.error('Échec :', (erreur as Error).message);
  process.exit(1);
});
