import type { NextResponse } from 'next/server';
import { versInterne } from '@/server/redirection';
import { fermerSession } from '@/server/session';

/**
 * Déconnexion en POST, jamais en GET : un préchargeur de lien ou un
 * `<img src>` glissé dans un courriel déconnecterait sinon l'utilisateur à son
 * insu.
 */
export async function POST(): Promise<NextResponse> {
  await fermerSession();
  // 303 : la réponse à un POST doit être suivie en GET.
  return versInterne('/connexion', 303);
}
