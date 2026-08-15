import { defineConfig } from 'vitest/config';

/**
 * Seules les fonctions pures sont testées ici : dates, iCalendar, signature de
 * session. Elles n'ont besoin ni de base ni de serveur, la suite tourne en
 * quelques centaines de millisecondes et peut donc être lancée à chaque
 * sauvegarde.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
