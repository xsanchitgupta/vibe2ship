import { createClient } from './supabase/server';

export interface SessionProfile {
  id: string;
  name: string;
  avatar: string;
  role: 'citizen' | 'authority';
  email?: string;
  points: number;
}

// Current signed-in profile (server-side). Null when logged out / no Supabase.
export async function getProfile(): Promise<SessionProfile | null> {
  const sb = await createClient();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!data) {
    return {
      id: user.id,
      name: user.email?.split('@')[0] ?? 'You',
      avatar: '🧑',
      role: 'citizen',
      email: user.email,
      points: 0,
    };
  }
  return {
    id: data.id,
    name: data.name,
    avatar: data.avatar,
    role: data.role,
    email: user.email,
    points: data.points,
  };
}

export async function getUserId(): Promise<string | null> {
  const sb = await createClient();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.id ?? null;
}

export async function isAuthority(): Promise<boolean> {
  return (await getProfile())?.role === 'authority';
}
