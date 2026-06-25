'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ClientProfile {
  id: string;
  name: string;
  avatar: string;
  role: 'citizen' | 'authority';
}

// Client-side current profile, kept in sync with Supabase auth state.
export function useSession() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createClient();
    if (!sb) {
      setLoading(false);
      return;
    }
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await sb!.auth.getUser();
      if (!user) {
        if (active) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await sb!
        .from('profiles')
        .select('name, avatar, role')
        .eq('id', user.id)
        .maybeSingle();
      if (active) {
        setProfile({
          id: user.id,
          name: data?.name ?? user.email?.split('@')[0] ?? 'You',
          avatar: data?.avatar ?? '🧑',
          role: (data?.role as 'citizen' | 'authority') ?? 'citizen',
        });
        setLoading(false);
      }
    }

    load();
    const { data: sub } = sb.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { profile, loading };
}
