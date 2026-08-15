import type { NextConfig } from 'next';

const config: NextConfig = {
  // Fly déploie un conteneur : `standalone` embarque le serveur et les seules
  // dépendances utilisées, l'image passe de ~1 Go à ~150 Mo.
  output: 'standalone',
  experimental: {
    serverActions: {
      // Les documents transitent par une Server Action. Cette limite porte sur
      // le corps ENTIER de la requête, donc sur la somme des pièces d'un dépôt
      // — pas sur chacune. Elle doit rester au-dessus de `TOTAL_MAX_OCTETS`
      // (src/server/formats.ts), qui est la limite annoncée à l'utilisateur.
      //
      // Le corps est mis en mémoire avant tout code applicatif : monter cette
      // valeur consomme la RAM de la machine Fly (512 Mo). 64 Mo laisse une
      // marge confortable au-dessus des 50 Mo annoncés sans mettre la machine
      // en danger. Au-delà, il faudrait téléverser directement vers le bucket
      // avec une URL présignée, et ne plus faire transiter les octets ici.
      bodySizeLimit: '64mb',
    },
  },
};

export default config;
