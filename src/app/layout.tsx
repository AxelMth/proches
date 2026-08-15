import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Proches',
    template: '%s · Proches',
  },
  description:
    'Documents, choses à faire et agenda partagés entre les proches qui accompagnent un parent âgé.',
  applicationName: 'Proches',
  // Un espace familial n'a rien à faire dans un moteur de recherche, y compris
  // sa page de connexion — qui révélerait à elle seule le nom du foyer.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#FAF7F2',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function LayoutRacine({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
