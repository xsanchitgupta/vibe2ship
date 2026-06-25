'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useSession } from '@/lib/useSession';
import { useRealtime } from '@/lib/useRealtime';
import { StatusBadge, timeAgo } from './ui';
import type { IssueStatus } from '@/lib/types';

interface Item {
  issueId: string;
  ref?: string;
  title: string;
  status: string;
  note: string;
  at: string;
}

const SEEN_KEY = 'ch_notif_seen';

export default function NotificationBell() {
  const { profile } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!profile) return;
    fetch('/api/notifications', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => {});
  }, [profile]);

  useEffect(() => {
    setSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useRealtime(load);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!profile) return null;
  const unread = items.filter((i) => new Date(i.at).getTime() > seen).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const now = Date.now();
      localStorage.setItem(SEEN_KEY, String(now));
      setSeen(now);
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="navpill-link" onClick={toggle} aria-label="Notifications" style={{ position: 'relative' }}>
        <Bell size={17} />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 8, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700,
              display: 'grid', placeItems: 'center',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="glass"
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 320, maxHeight: 380,
            overflowY: 'auto', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '0.5rem', zIndex: 80,
          }}
        >
          <div className="tiny muted" style={{ padding: '0.4rem 0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Activity on your reports
          </div>
          {items.length === 0 && <p className="tiny muted" style={{ padding: '1rem', textAlign: 'center' }}>No updates yet.</p>}
          {items.map((it, i) => (
            <Link key={i} href={`/issues/${it.issueId}`} onClick={() => setOpen(false)} className="notif-row" style={{ display: 'block', padding: '0.6rem', borderRadius: 'var(--radius-md)', textDecoration: 'none' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '0.2rem' }}>
                <StatusBadge status={it.status as IssueStatus} />
                <span className="tiny muted" style={{ marginLeft: 'auto' }}>{timeAgo(it.at)}</span>
              </div>
              <div className="tiny" style={{ color: 'var(--foreground)', fontWeight: 600 }}>{it.title}</div>
              <div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.note}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
