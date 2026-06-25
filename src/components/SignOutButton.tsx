'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const sb = createClient();
    if (sb) await sb.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button className="btn btn-secondary btn-sm" onClick={signOut} disabled={busy}>
      {busy ? <Loader2 size={14} className="spin" /> : <LogOut size={14} />} Sign out
    </button>
  );
}
