'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    if (data.session) {
      router.push('/');
      router.refresh();
    } else {
      setConfirmSent(true);
    }
  }

  if (confirmSent) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-title">Check your email</div>
          <div className="auth-sub">We sent a confirmation link to {email}. Confirm to sign in.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-logo-auth-tile">
          <img src="/logo-e5876259.png" alt="The Round Table" className="brand-logo-auth" />
          <div className="brand-logo-auth-text">
            <span className="brand-logo-auth-name">The Round Table</span>
            <span className="brand-logo-auth-slogan">Founding your founder dream</span>
          </div>
        </div>
        <div className="auth-title">Create account</div>
        <div className="auth-sub">The Round Table — five agents, one shared recommendation.</div>
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
            {busy ? '…' : 'Create account'}
          </button>
        </form>
        <div className="auth-switch">Already have an account? <Link href="/sign-in">Sign in</Link></div>
      </div>
    </div>
  );
}
