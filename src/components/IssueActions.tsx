'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThumbsUp, Loader2, LogIn } from 'lucide-react';
import { toast } from '@/lib/toast';

export default function IssueActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  async function verify() {
    setBusy(true);
    const r = await fetch(`/api/issues/${id}/verify`, { method: 'POST' });
    setBusy(false);
    if (r.status === 401) {
      setNeedLogin(true);
      toast('Sign in to verify issues', 'info');
      return;
    }
    setDone(true);
    toast('Verified — thanks for confirming! +5 points', 'success');
    router.refresh();
  }

  if (needLogin) {
    return (
      <Link href="/login" className="btn btn-primary">
        <LogIn size={16} /> Sign in to verify
      </Link>
    );
  }

  return (
    <button className="btn btn-primary" onClick={verify} disabled={busy || done}>
      {busy ? <Loader2 size={16} className="spin" /> : <ThumbsUp size={16} />}
      {done ? 'Verified ✓' : 'Verify this issue'}
    </button>
  );
}
