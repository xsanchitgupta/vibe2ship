'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ClientProfile {
  id: string;
  name: string;
  avatar: string;
  role: 'citizen' | 'authority';
}

// Client-side current profile, kept in sync with Supabase auth state.
// Works across tabs: listens for visibilitychange + storage events so that
// when the user logs in on one tab, all other tabs pick it up.
export function useSession() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const sb = createClient();
    if (!sb) return;

    // Use getSession() first — it reads directly from cookies (shared across
    // tabs) instead of the in-memory token cache that getUser() relies on.
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const user = session.user;
    const { data } = await sb
      .from('profiles')
      .select('name, avatar, role')
      .eq('id', user.id)
      .maybeSingle();

    setProfile({
      id: user.id,
      name: data?.name ?? user.email?.split('@')[0] ?? 'You',
      avatar: data?.avatar ?? '🧑',
      role: (data?.role as 'citizen' | 'authority') ?? 'citizen',
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    const sb = createClient();
    if (!sb) {
      setLoading(false);
      return;
    }

    // Initial load
    load();

    // Listen for auth state changes (works within the same tab)
    const { data: sub } = sb.auth.onAuthStateChange(() => load());

    // When the user switches to this tab, re-check the session from cookies.
    // This catches the case where login happened in another tab.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);

    // Listen for localStorage changes — Supabase stores tokens in localStorage,
    // and the 'storage' event fires in OTHER tabs when one tab writes to it.
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('sb-')) load();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [load]);

  return { profile, loading };
}
