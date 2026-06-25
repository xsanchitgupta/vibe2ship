'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// Calls `onChange` whenever issues or verifications change in Supabase, so any
// page can stay live across all users. No-op when Supabase isn't configured.
export function useRealtime(onChange: () => void) {
  useEffect(() => {
    const sb = createClient();
    if (!sb) return;
    const channelName = `community-hero-live-${Math.random()}`;
    const channel = sb
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verifications' }, onChange)
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [onChange]);
}
