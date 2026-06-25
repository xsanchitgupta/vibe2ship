'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trophy, Medal, ThumbsUp, Camera, CheckCircle2, Zap } from 'lucide-react';
import { useRealtime } from '@/lib/useRealtime';
import type { Citizen } from '@/lib/types';

function level(points: number): { name: string; emoji: string; next: number } {
  if (points >= 500) return { name: 'Community Hero', emoji: '🦸', next: points };
  if (points >= 300) return { name: 'Champion', emoji: '🏅', next: 500 };
  if (points >= 150) return { name: 'Guardian', emoji: '🛡️', next: 300 };
  if (points >= 50) return { name: 'Helper', emoji: '🤝', next: 150 };
  return { name: 'Newcomer', emoji: '🌱', next: 50 };
}

const MEDAL = ['#fbbf24', '#3f3f46', '#d97706'];

export default function LeaderboardPage() {
  const [citizens, setCitizens] = useState<Citizen[]>([]);

  const load = useCallback(() => {
    return fetch('/api/leaderboard', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setCitizens(d.citizens));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useRealtime(load);

  const podium = citizens.slice(0, 3);
  const rest = citizens.slice(3);

  return (
    <div className="container narrow animate-fade-in">
      <div className="center-text" style={{ marginBottom: '2rem' }}>
        <span className="eyebrow"><Trophy size={14} /> Civic Champions</span>
        <h1 style={{ marginTop: '1rem' }}>Leaderboard</h1>
        <p className="muted" style={{ maxWidth: 520, margin: '0.5rem auto 0' }}>
          Every report and verification earns points. The more you help, the
          higher you climb — and the safer your community gets.
        </p>
      </div>

      {/* Podium */}
      <div className="flex justify-center items-end gap-4 flex-wrap" style={{ marginBottom: '2.5rem' }}>
        {podium.map((c, i) => {
          const lv = level(c.points);
          const order = [1, 0, 2][i]; // visually center #1
          return (
            <div
              key={c.id}
              className="glass-card center-text animate-rise"
              style={{
                order,
                width: 170,
                paddingTop: i === 0 ? '1.5rem' : '2.25rem',
                borderColor: i === 0 ? 'rgba(251,191,36,0.4)' : 'var(--surface-border)',
                boxShadow: i === 0 ? '0 0 40px rgba(251,191,36,0.18)' : undefined,
              }}
            >
              <div style={{ fontSize: i === 0 ? '3rem' : '2.4rem' }}>{c.avatar}</div>
              <Medal size={22} color={MEDAL[i]} style={{ margin: '0.25rem 0' }} />
              <div style={{ fontWeight: 700, color: 'var(--foreground)' }}>{c.name}</div>
              <div className="tiny muted">{lv.emoji} {lv.name}</div>
              <div className="text-gradient" style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.5rem' }}>
                {c.points}
              </div>
              <div className="tiny muted">points</div>
            </div>
          );
        })}
      </div>

      {/* Rest */}
      <div className="glass-card" style={{ padding: '0.5rem', marginBottom: '2rem' }}>
        {rest.map((c, i) => {
          const lv = level(c.points);
          const isYou = c.name === 'You';
          return (
            <div
              key={c.id}
              className="flex items-center gap-3"
              style={{
                padding: '0.8rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: isYou ? 'rgba(99,102,241,0.12)' : undefined,
                border: isYou ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
              }}
            >
              <span className="muted" style={{ width: 28, fontWeight: 700 }}>{i + 4}</span>
              <span style={{ fontSize: '1.5rem' }}>{c.avatar}</span>
              <div className="flex-1">
                <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                  {c.name} {isYou && <span className="pill pill-primary" style={{ marginLeft: 6 }}>You</span>}
                </div>
                <div className="tiny muted">{lv.emoji} {lv.name}</div>
              </div>
              <div className="flex items-center gap-4 hide-sm tiny muted">
                <span className="flex items-center gap-1"><Camera size={12} /> {c.reports}</span>
                <span className="flex items-center gap-1"><ThumbsUp size={12} /> {c.verifications}</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {c.resolvedImpact}</span>
              </div>
              <strong style={{ width: 60, textAlign: 'right', color: '#2563eb' }}>{c.points}</strong>
            </div>
          );
        })}
      </div>

      {/* How to earn */}
      <div className="glass-card">
        <div className="section-title">
          <Zap size={18} color="#7c3aed" />
          <h2 style={{ fontSize: '1.1rem' }}>How to earn points</h2>
        </div>
        <div className="cards-grid">
          {[
            { icon: <Camera size={18} />, t: 'Report an issue', d: '10–50 pts by severity' },
            { icon: <ThumbsUp size={18} />, t: 'Verify a report', d: '5 pts each' },
            { icon: <CheckCircle2 size={18} />, t: 'See it resolved', d: '15 bonus pts' },
          ].map((x) => (
            <div key={x.t} className="panel" style={{ padding: '1rem' }}>
              <div className="kpi-icon" style={{ width: 40, height: 40, background: 'rgba(45,212,191,0.12)', color: '#7c3aed', marginBottom: '0.6rem' }}>
                {x.icon}
              </div>
              <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{x.t}</div>
              <div className="tiny muted">{x.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
