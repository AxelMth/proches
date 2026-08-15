# Image de production pour Fly.io.
#
# Trois étages : dépendances, build, exécution. Seul le dernier est expédié —
# `output: 'standalone'` (voir next.config.ts) fait recopier par Next le serveur
# et les seules dépendances réellement importées, ce qui ramène l'image de
# ~1 Go à ~180 Mo et supprime le besoin d'un `node_modules` complet en prod.

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH" NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

# Ne jamais servir en root : une faille dans le rendu ne doit pas donner le
# conteneur entier.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -G nodejs -S proches

COPY --from=build --chown=proches:nodejs /app/.next/standalone ./
COPY --from=build --chown=proches:nodejs /app/.next/static ./.next/static

# `output: 'standalone'` ne recopie PAS `public/` : c'est à faire à la main,
# sans quoi les polices et les décodeurs de pdf.js répondent 404 en production
# et les vignettes de PDF retombent sur leur tuile typée. Le dossier est
# fabriqué au build par `scripts/pdfjs-assets.mjs` (voir `prebuild`).
COPY --from=build --chown=proches:nodejs /app/public ./public

# La migration voyage avec l'image : Fly la joue en `release_command` avant de
# basculer le trafic (voir fly.toml). Les deux fichiers suffisent — le script
# n'utilise que `pg`, que `output: 'standalone'` a déjà tracé.
COPY --from=build --chown=proches:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build --chown=proches:nodejs /app/src/server/schema.sql ./src/server/schema.sql

USER proches
EXPOSE 3000
CMD ["node", "server.js"]
