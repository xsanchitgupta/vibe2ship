'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mail, ShieldCheck, KeyRound, ArrowLeft, Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const redirectingRef = useRef(false);

  const sb = createClient();

  // Redirect helper — avoids double-redirects
  function doRedirect(path?: string) {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    const next = path || new URLSearchParams(window.location.search).get('next') || '/dashboard';
    window.location.replace(next);
  }

  // If already signed in, bounce immediately
  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) doRedirect();
    });

    // Listen for auth state changes — this fires reliably after verifyOtp
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // Wait briefly for @supabase/ssr's internal listener to write the cookies
        // before we navigate away, otherwise the session is lost.
        setTimeout(() => doRedirect(), 150);
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    if (!sb) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      setNotice(`We emailed a 6-digit code to ${email}.`);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await sb.auth.verifyOtp({ email, token: otp.trim(), type: 'email' });
      if (error) throw error;
      // The onAuthStateChange listener will handle the redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code');
      setBusy(false);
    }
  }

  async function demoLogin() {
    if (!sb) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/demo-login', { method: 'POST' }).then((x) => x.json());
      if (!r.otp) throw new Error(r.error || 'Demo unavailable');
      const { error } = await sb.auth.verifyOtp({ email: r.email, token: r.otp, type: 'email' });
      if (error) throw error;
      // The onAuthStateChange listener will handle the redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed');
      setBusy(false);
    }
  }

  if (!sb) {
    return (
      <div className="container narrow center-text" style={{ paddingTop: '3rem' }}>
        <h1>Sign in unavailable</h1>
        <p className="muted">Supabase isn&apos;t configured in this environment.</p>
      </div>
    );
  }

  return (
    <div className="container narrow animate-fade-in" style={{ maxWidth: 440, paddingTop: '4vh' }}>
      <div className="center-text" style={{ marginBottom: '1.75rem' }}>
        <motion.span
          className="logo-badge"
          style={{ width: 52, height: 52, margin: '0 auto 1rem', borderRadius: 14 }}
          initial={{ scale: 0.8, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        >
          <ShieldCheck size={26} />
        </motion.span>
        <h1 style={{ fontSize: '1.9rem' }}>Welcome to Community Hero</h1>
        <p className="muted small">Passwordless sign-in — we&apos;ll email you a one-time code.</p>
      </div>

      <div className="glass-card" style={{ padding: '2rem' }}>
        <AnimatePresence mode="wait">
          {step === 'email' ? (
            <motion.form key="email" onSubmit={sendOtp} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
              <div className="input-group">
                <label className="input-label"><Mail size={14} /> Email address</label>
                <input className="input-field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
              </div>
              {error && <p className="tiny" style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>{error}</p>}
              <button type="submit" className="btn btn-primary full" disabled={busy || !email}>
                {busy ? <Loader2 size={16} className="spin" /> : <Mail size={16} />} Send code
              </button>
            </motion.form>
          ) : (
            <motion.form key="otp" onSubmit={verifyOtp} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              {notice && (
                <p className="tiny center-text" style={{ color: 'var(--success)', marginBottom: '1.25rem', background: 'rgba(22,163,74,0.08)', padding: '0.65rem', borderRadius: 'var(--radius-md)' }}>{notice}</p>
              )}
              <div className="input-group">
                <label className="input-label"><KeyRound size={14} /> 6-digit code</label>
                <input
                  className="input-field"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  style={{ fontSize: '1.4rem', letterSpacing: '0.5rem', textAlign: 'center' }}
                  autoFocus
                />
              </div>
              {error && <p className="tiny center-text" style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>{error}</p>}
              <button type="submit" className="btn btn-primary full" disabled={busy || otp.length < 6}>
                {busy ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />} Verify & continue
              </button>
              <div className="flex items-center justify-between" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep('email'); setOtp(''); setError(null); }}>
                  <ArrowLeft size={14} /> Change email
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => sendOtp()} disabled={busy}>
                  Resend code
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <div className="center-text" style={{ marginTop: '1.25rem' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
          <div className="divider" style={{ flex: 1, margin: 0 }} />
          <span className="tiny muted">just exploring / judging?</span>
          <div className="divider" style={{ flex: 1, margin: 0 }} />
        </div>
        <button type="button" className="btn btn-secondary full" onClick={demoLogin} disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Building2 size={16} />} Enter as demo authority
        </button>
        <p className="tiny muted" style={{ marginTop: '0.6rem' }}>One-click access to the Authority Console — no email needed.</p>
      </div>

      <p className="tiny muted center-text" style={{ marginTop: '1rem' }}>
        By continuing you agree to help make your city better. 🦸
      </p>
    </div>
  );
}
