# Proches

Un espace partagé pour accompagner un parent âgé : **les documents**, **les
choses à faire** et **l'agenda**, au même endroit, pour tous ceux qui s'en
occupent.

Deux interfaces sur le même socle, et c'est le cœur du projet :

- **Les aidants** (enfants, conjoint, auxiliaire de vie) se connectent, déposent
  des documents, cochent des tâches, ajoutent des rendez-vous.
- **La personne accompagnée** ouvre un favori sur sa tablette et voit ce qui se
  passe aujourd'hui. En gros caractères, sans menu, sans connexion, jamais.

## Ce qu'il y a dedans

| | |
|---|---|
| Documents | Un document = un dossier à plusieurs pièces (recto/verso, pages d'une ordonnance). Trois affichages — liste, cartes, aperçu avec vignettes. Recherche sur le titre, les notes et le nom des pièces. Titre, catégorie et notes modifiables sans redéposer |
| À faire | Échéance, personne assignée, priorité, sections « en retard / aujourd'hui / à venir » |
| Agenda | Grille mensuelle, rendez-vous horodatés ou journée entière, flux iCalendar personnel |
| Vue senior | `/a/<jeton>` — aujourd'hui, demain, cette semaine, plus ses documents |
| Famille | Invitation par courriel, révocation d'accès, renouvellement du lien de la tablette |
| Rappels | Récapitulatif quotidien par courriel : rendez-vous du lendemain, tâches en retard |

## Stack

Next 15 (App Router, Server Components et Server Actions), React 19, Tailwind 4,
Postgres (Neon) via `pg` en SQL brut — pas d'ORM. Déployé en conteneur sur
Fly.io. Connexion par lien magique, sans mot de passe. Le code, les tables et
l'interface sont **en français**.

## Mise en route

```bash
pnpm install
cp .env.example .env.local     # renseignez au minimum DATABASE_URL
pnpm db:migrate
pnpm db:inviter "Jeanne Dupont" "Axel" axel@exemple.fr
pnpm dev
```

`db:inviter` crée le foyer, la personne accompagnée et le premier aidant, puis
affiche **le lien permanent de la tablette** et l'adresse de connexion. C'est la
seule porte d'entrée : la page de connexion ne crée jamais de compte, on entre
sur invitation d'un aidant.

Sans `RESEND_API_KEY`, les liens de connexion sont écrits dans les logs du
serveur au lieu d'être envoyés — de quoi tout essayer sans compte chez un tiers.

### Variables

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Neon, chaîne *pooled*, avec `?sslmode=require`. **Indispensable.** |
| `PROCHES_SECRET` | Signature des cookies. `openssl rand -base64 32`. Obligatoire en production. |
| `PROCHES_URL` | URL publique, sert à fabriquer les liens envoyés par courriel. |
| `RESEND_API_KEY` | Envoi des courriels. Absente → écriture dans les logs. |
| `COURRIEL_EXPEDITEUR` | Ex. `Proches <bonjour@mondomaine.fr>`, doit être un domaine vérifié chez Resend. |
| `PROCHES_TAILLE_MAX_MO` | Plafond par document, 5 par défaut. |
| `PROCHES_CRON_SECRET` | Protège `/api/cron/rappels`. |

## Commandes

```bash
pnpm dev          # serveur de développement
pnpm test         # vitest — dates, iCalendar
pnpm typecheck    # tsc --noEmit
pnpm db:migrate   # applique src/server/schema.sql, idempotent
pnpm db:inviter   # amorce un foyer / ajoute un aidant
```

## Déploiement

```bash
fly secrets set DATABASE_URL=… PROCHES_SECRET=… PROCHES_URL=https://proches.fly.dev
fly deploy
```

**La migration est jouée par Fly, pas par vous.** `fly.toml` déclare
`[deploy] release_command = "node scripts/migrate.mjs"` : Fly lance ce script
dans une machine éphémère, avec les secrets de l'app, **avant** de basculer le
trafic. Si la migration échoue, le déploiement est annulé et l'ancienne version
continue de servir. C'est pour cette raison que `scripts/migrate.mjs` est en
JavaScript simple et n'utilise que `pg` : l'image de production ne contient ni
TypeScript, ni `vite-node`, ni les dépendances de développement.

**L'amorçage, lui, reste manuel** — une seule fois, à la création du foyer, car
personne ne peut deviner le nom de la personne accompagnée. Depuis votre machine,
avec les valeurs de production :

```bash
DATABASE_URL='<url neon de prod>' PROCHES_URL='https://proches.fly.dev' pnpm db:inviter "Jeanne Dupont" "Axel" axel@exemple.fr
```

Sans cette étape, `/connexion` s'affiche mais aucune page d'aidant ne fonctionne :
il n'y a ni foyer, ni compte.

### Le rappel quotidien

Il se déclenche de l'extérieur. Une machine Fly planifiée :

```bash
fly machine run . --schedule daily --restart no sh -c 'wget -qSO- --header="Authorization: Bearer $PROCHES_CRON_SECRET" https://proches.fly.dev/api/cron/rappels'
```

Trois détails qui décident si ça marche ou non :

- **Guillemets simples**, pour que `$PROCHES_CRON_SECRET` soit développé *dans
  la machine*, qui a les secrets — pas par votre shell, qui ne les a pas. Le
  secret ne doit pas non plus passer en paramètre d'URL, où il finirait dans les
  journaux d'accès.
- `-S` sur `wget`, sinon un 401 ou un 500 est avalé en silence et vous croyez
  les rappels partis alors qu'aucun n'est envoyé. La route répond 500 dès qu'un
  destinataire n'a pas été servi.
- `--schedule daily` veut dire « une fois par jour », pas « à 7 h 30 ». Fly ne
  permet pas de choisir l'heure ; pour un horaire précis, il faut un
  déclencheur externe (GitHub Actions, cron-job.org).

Une machine créée ainsi n'est **pas** mise à jour par `fly deploy` : après un
changement de code, supprimez-la et recréez-la.

## Choix de conception

**Les documents vivent dans un bucket, la base n'en garde qu'une clé.** Le
stockage est Tigris (S3-compatible, région européenne), provisionné par
`fly storage create`. `src/server/stockage.ts` est le seul module qui touche
aux octets — changer de fournisseur ne concerne que ce fichier.

Le bucket n'est jamais public : les fichiers sont servis par nos propres routes,
qui vérifient la session de l'aidant ou le jeton de la personne accompagnée, et
posent `nosniff` et une CSP `sandbox`. Sans bucket configuré, les documents sont
écrits sous `.data/documents/` — c'est ce qui permet de cloner et lancer sans
compte chez un tiers, et c'est refusé en production par le `release_command`.

**Une conséquence à ne pas oublier : la sauvegarde.** Tant que les documents
étaient en base, ils étaient couverts par le PITR de Neon. Ce n'est plus le cas.
Activez le versionnage sur le bucket :

```bash
fly storage update <nom-du-bucket> --versioning
```

**Le lien permanent de la tablette n'utilise aucun cookie.** La page se résout
entièrement depuis le jeton de l'URL, donc le favori survit à un effacement des
données de navigation, à un redémarrage, à une mise à jour du navigateur. En
contrepartie, qui détient l'URL a l'accès en lecture — d'où le bouton
« Générer un nouveau lien » sur la page Famille, qui invalide l'ancien
immédiatement.

**Les tâches n'apparaissent pas dans la vue de la personne accompagnée.** Une
liste de choses que d'autres doivent faire pour soi est une source d'inquiétude,
pas d'information.

**Jours et instants ne se mélangent pas.** L'échéance d'une tâche est une chaîne
`AAAA-MM-JJ`, le début d'un rendez-vous un `timestamptz`. Les événements
« journée entière » sont rangés à midi UTC : minuit à Paris tombe la veille en
UTC et décalerait la date d'un jour dans le flux iCalendar. Tout est dans
`src/server/dates.ts`, avec les tests qui vont avec.

**Pas de thème sombre.** La garantie de contraste ne vaut que si elle est tenue
partout, et le seul écran qui compte vraiment ici est une tablette posée sur une
table, en plein jour.

## Données personnelles

Cet outil est prévu pour un usage **familial privé**, ce qui le place hors du
champ du RGPD au titre de l'article 2.2.c. Il stocke néanmoins des documents de
santé : Neon et Fly.io ne sont pas des hébergeurs agréés HDS, et cette
installation n'a pas à devenir l'outil d'un cabinet ou d'un service d'aide à
domicile. Aucune police n'est chargée depuis un CDN, aucun traceur n'est
présent, et les pages sont exclues de l'indexation.
