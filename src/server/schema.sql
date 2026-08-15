-- Schéma Proches pour Postgres (Neon).
-- Appliqué par `pnpm db:migrate`, et par Fly en `release_command` avant chaque
-- bascule de trafic. Idempotent, rejouable sans risque.
--
-- ⚠ COMMENT FAIRE ÉVOLUER CE FICHIER
--
-- Tout ici est en `create ... if not exists` : sur une base déjà installée, un
-- bloc `create table` est intégralement ignoré. Modifier une table EN PLACE n'a
-- donc aucun effet, et la migration sort quand même en succès — Fly bascule le
-- trafic sur du code qui attend une colonne absente. Toute évolution s'écrit
-- **en fin de fichier**, jamais dans un bloc `create table` existant :
--
--     alter table membre add column if not exists telephone text;
--
-- Attention, le piège ne se limite pas aux colonnes : les contraintes
-- `check (... in (...))` ci-dessous sont figées à la création. Y ajouter une
-- valeur impose de reconstruire la contrainte, sinon les `insert` échouent en
-- 23514 sans que la migration ne signale quoi que ce soit :
--
--     alter table document drop constraint if exists document_categorie_check;
--     alter table document add constraint document_categorie_check check (...);
--
-- Le jour où ces ajouts deviennent nombreux, passer à des fichiers numérotés
-- et une table `schema_migrations`.
--
-- Choix de modélisation :
--
--  * Tout est rattaché à un `foyer`, alors qu'une instance n'en héberge qu'un.
--    La clé étrangère coûte trois caractères aujourd'hui et une migration de
--    toutes les tables le jour où l'on accompagne un second parent.
--
--  * La base ne garde des documents que leurs métadonnées et une clé : les
--    octets vivent dans un stockage objet (Tigris, région européenne).
--    `src/server/stockage.ts` est le seul module à les manipuler.
--
--  * Distinction jour / instant, systématique : `tache.echeance` est un `date`
--    (« pour mardi », sans heure, insensible au fuseau), `evenement.debut` un
--    `timestamptz` (un rendez-vous a lieu à 14 h 30, heure de Paris).
--
--  * Les jetons (lien permanent du senior, flux ICS) sont stockés en clair car
--    ils *sont* l'URL. Les jetons de connexion, eux, sont hachés : ils ouvrent
--    une session, une fuite de la base ne doit pas suffire à se connecter.

create table if not exists foyer (
  id      text primary key,
  nom     text not null,
  fuseau  text not null default 'Europe/Paris',
  cree_le timestamptz not null default now()
);

create table if not exists membre (
  id           text primary key,
  foyer_id     text not null references foyer(id) on delete cascade,
  prenom       text not null,
  email        text not null,
  -- 'aidant' : accès complet en écriture. 'senior' : la personne accompagnée,
  -- lecture seule via son lien permanent, jamais de session cookie.
  role         text not null check (role in ('aidant', 'senior')),
  -- Jeton de l'URL permanente (senior uniquement). Régénérable depuis /famille.
  jeton_vue    text unique,
  -- Jeton du flux ICS personnel, pour s'abonner depuis Google/Apple Calendar.
  jeton_agenda text not null unique,
  actif        boolean not null default true,
  cree_le      timestamptz not null default now()
);

-- Un e-mail identifie une personne : c'est la clé du lien magique.
create unique index if not exists membre_email_unique on membre (lower(email));
create index if not exists membre_foyer_idx on membre (foyer_id);

create table if not exists lien_connexion (
  jeton_hash text primary key,
  membre_id  text not null references membre(id) on delete cascade,
  expire_le  timestamptz not null,
  utilise_le timestamptz,
  cree_le    timestamptz not null default now()
);

create index if not exists lien_connexion_membre_idx on lien_connexion (membre_id);

create table if not exists document (
  id          text primary key,
  foyer_id    text not null references foyer(id) on delete cascade,
  titre       text not null,
  categorie   text not null default 'autre'
              check (categorie in ('sante', 'administratif', 'finances',
                                   'logement', 'assurance', 'autre')),
  nom_fichier text not null,
  type_mime   text not null,
  taille      bigint not null,
  -- Clé de l'objet dans le stockage (Tigris). Les octets ne sont plus en base.
  cle         text,
  -- Vestige du stockage en `bytea`, conservé nullable le temps de s'assurer
  -- qu'aucune installation n'a encore de document rangé là. Voir le bloc
  -- d'évolutions en fin de fichier.
  contenu     bytea,
  notes       text,
  ajoute_par  text references membre(id) on delete set null,
  cree_le     timestamptz not null default now()
);

create index if not exists document_foyer_idx on document (foyer_id, cree_le desc);

create table if not exists tache (
  id          text primary key,
  foyer_id    text not null references foyer(id) on delete cascade,
  titre       text not null,
  details     text,
  echeance    date,
  priorite    text not null default 'normale' check (priorite in ('normale', 'haute')),
  assignee_id text references membre(id) on delete set null,
  faite_le    timestamptz,
  faite_par   text references membre(id) on delete set null,
  cree_par    text references membre(id) on delete set null,
  cree_le     timestamptz not null default now()
);

create index if not exists tache_foyer_idx on tache (foyer_id, faite_le, echeance);

create table if not exists evenement (
  id              text primary key,
  foyer_id        text not null references foyer(id) on delete cascade,
  titre           text not null,
  categorie       text not null default 'autre'
                  check (categorie in ('medical', 'visite', 'aide',
                                       'administratif', 'autre')),
  lieu            text,
  notes           text,
  debut           timestamptz not null,
  fin             timestamptz not null,
  journee_entiere boolean not null default false,
  cree_par        text references membre(id) on delete set null,
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now()
);

create index if not exists evenement_foyer_idx on evenement (foyer_id, debut);

-- Journal d'activité : entre aidants, c'est ce qui évite les doublons et les
-- « je croyais que tu l'avais fait ». Volontairement en append-only.
create table if not exists journal (
  id        bigserial primary key,
  foyer_id  text not null references foyer(id) on delete cascade,
  membre_id text references membre(id) on delete set null,
  action    text not null,
  cible     text,
  le        timestamptz not null default now()
);

create index if not exists journal_foyer_idx on journal (foyer_id, le desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉVOLUTIONS
--
-- Ce qui suit s'applique aux bases DÉJÀ créées, pour lesquelles les blocs
-- `create table` ci-dessus sont ignorés. À écrire ici, jamais plus haut.
-- Chaque instruction doit être rejouable sans erreur.
-- ═══════════════════════════════════════════════════════════════════════════

-- 2026-08 — Les documents passent en stockage objet (Tigris, région EU).
-- `contenu` cesse d'être écrit ; il devient nullable pour que les nouvelles
-- lignes, qui ne portent qu'une clé, soient acceptées.
alter table document add column if not exists cle text;
alter table document alter column contenu drop not null;

-- La colonne `contenu` n'est PAS supprimée ici : sur une installation qui aurait
-- déjà des documents rangés en base, ce serait une perte de données silencieuse
-- jouée automatiquement au déploiement. Une fois vérifié qu'elle est vide —
--     select count(*) from document where contenu is not null;
-- elle se retire à la main :
--     alter table document drop column contenu;

-- 2026-08 — Un document peut porter PLUSIEURS fichiers (recto/verso d'une carte,
-- ordonnance en trois pages photographiées, avis d'imposition et son annexe).
-- Le document devient le dossier — titre, catégorie, notes — et `fichier` porte
-- les pièces.
create table if not exists fichier (
  id          text primary key,
  document_id text not null references document(id) on delete cascade,
  nom_fichier text not null,
  type_mime   text not null,
  taille      bigint not null,
  cle         text not null,
  -- Rang d'affichage : le recto avant le verso.
  ordre       integer not null default 0,
  cree_le     timestamptz not null default now()
);

create index if not exists fichier_document_idx on fichier (document_id, ordre, cree_le);

-- Reprise des documents existants, qui portaient leur unique fichier en propre.
-- Le `not exists` rend l'opération rejouable : au deuxième passage, il n'y a
-- plus rien à reprendre.
insert into fichier (id, document_id, nom_fichier, type_mime, taille, cle, ordre)
select replace(gen_random_uuid()::text, '-', ''),
       d.id, d.nom_fichier, d.type_mime, d.taille, d.cle, 0
  from document d
 where d.cle is not null
   and not exists (select 1 from fichier f where f.document_id = d.id);

-- Les colonnes de fichier sur `document` ne sont plus écrites. Elles doivent
-- cesser d'être obligatoires, sinon toute nouvelle ligne serait refusée.
alter table document alter column nom_fichier drop not null;
alter table document alter column type_mime  drop not null;
alter table document alter column taille     drop not null;

-- Comme pour `contenu` : on ne supprime pas de colonne automatiquement. Une
-- fois la reprise constatée —
--     select count(*) from document where cle is not null;
--     select count(*) from fichier;
-- ces vestiges se retirent à la main :
--     alter table document drop column cle, drop column nom_fichier,
--                          drop column type_mime, drop column taille;

-- 2026-08 — Sessions en base, plutôt qu'un cookie signé auto-porteur.
--
-- Le cookie signé fonctionnait, mais il portait sa date d'émission figée : la
-- session mourait 90 jours après la connexion, même pour quelqu'un qui venait
-- tous les jours. Et se reconnecter passe par un courriel — le geste le plus
-- coûteux de l'application.
--
-- Une ligne par appareil permet trois choses que le cookie signé interdisait :
-- faire GLISSER l'échéance à chaque visite (donc ne jamais déconnecter un
-- utilisateur actif), RÉVOQUER un appareil précis, et simplement MONTRER à
-- quelqu'un où il est connecté.
create table if not exists session (
  id         text primary key,
  -- Le jeton du cookie n'est jamais stocké en clair : seule son empreinte est
  -- ici. Une fuite de la base ne permet pas de fabriquer un cookie valide.
  jeton_hash text not null unique,
  membre_id  text not null references membre(id) on delete cascade,
  -- « Safari sur iPhone » — pour que la page Appareils soit lisible.
  appareil   text,
  cree_le    timestamptz not null default now(),
  vu_le      timestamptz not null default now(),
  expire_le  timestamptz not null
);

create index if not exists session_membre_idx on session (membre_id, vu_le desc);

-- 2026-08 — Le répertoire : médecin traitant, cardiologue, pharmacie,
-- infirmière, aide à domicile, la voisine qui a un double des clés.
--
-- Ces numéros existaient déjà — sur un post-it près du téléphone, dans le
-- répertoire d'un seul des aidants, sur une ordonnance qu'il faut retrouver.
-- Le jour où quelque chose arrive, ce n'est jamais forcément celui qui les a
-- qui est là.
--
-- `telephone` est obligatoire, contrairement à l'adresse et au courriel : un
-- contact sans numéro ne répond pas au besoin, qui est d'appeler.
--
-- Les numéros nationaux (15, 18, 112, 114) ne sont PAS ici : ils sont les
-- mêmes pour tout le monde et ne changent pas. Ils vivent dans
-- `src/server/urgences.ts`, affichés d'office — un répertoire d'urgence qu'il
-- faut d'abord penser à remplir est un répertoire vide le jour où il sert.
create table if not exists contact (
  id        text primary key,
  foyer_id  text not null references foyer(id) on delete cascade,
  nom       text not null,
  -- Ce que la personne est *pour le foyer*, pas sa spécialité médicale : on
  -- cherche « le médecin », rarement « le gériatre ».
  categorie text not null default 'autre'
            check (categorie in ('urgence', 'medecin', 'specialiste', 'pharmacie',
                                 'soins', 'aide', 'famille', 'autre')),
  -- Stocké tel qu'il a été saisi, espaces compris : c'est ainsi qu'un numéro
  -- se relit à voix haute. La normalisation n'a lieu que pour fabriquer le
  -- lien `tel:`, à l'affichage.
  telephone text not null,
  email     text,
  adresse   text,
  -- « Sonner deux fois », « ne pas appeler avant 10 h », « parking à l'arrière ».
  notes     text,
  cree_par  text references membre(id) on delete set null,
  cree_le   timestamptz not null default now(),
  maj_le    timestamptz not null default now()
);

create index if not exists contact_foyer_idx on contact (foyer_id, categorie, nom);

-- 2026-08 — Mot de passe, en plus du lien magique.
--
-- Le lien par courriel reste la porte d'entrée : c'est lui qui fait l'invitation
-- et c'est lui qui rattrape un mot de passe oublié. Mais pour qui se connecte
-- depuis un appareil neuf, aller chercher un courriel est le geste le plus
-- coûteux de l'application. Un mot de passe est donc **facultatif** et
-- s'ajoute : `mot_de_passe` reste `null` tant que personne ne l'a défini, et un
-- compte sans mot de passe se connecte exactement comme avant.
--
-- L'empreinte est un scrypt complet, paramètres compris — voir
-- `src/server/motdepasse.ts`. Le format porte son coût, ce qui permettra de le
-- relever un jour sans invalider les mots de passe existants.
alter table membre add column if not exists mot_de_passe text;
alter table membre add column if not exists mot_de_passe_le timestamptz;

-- Freinage des essais de mot de passe.
--
-- La clé est l'adresse en minuscules, **pas** l'identifiant du membre : une
-- adresse inconnue doit être freinée comme une adresse connue, sinon la
-- différence de comportement dit à un curieux qui fait partie du foyer.
--
-- Le blocage ne ferme jamais complètement la porte : le lien par courriel
-- continue de fonctionner. C'est ce qui permet de freiner franchement sans
-- offrir à un tiers le moyen d'enfermer dehors un aidant en pilonnant son
-- adresse.
create table if not exists essai_connexion (
  cle          text primary key,
  echecs       integer not null default 0,
  bloque_jusqu timestamptz,
  maj_le       timestamptz not null default now()
);
