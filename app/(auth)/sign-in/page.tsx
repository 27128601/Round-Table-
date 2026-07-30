'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.push('/');
    router.refresh();
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
        <div className="auth-title">Sign in</div>
        <div className="auth-sub">The Round Table — five agents, one shared recommendation.</div>
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
            {busy ? '…' : 'Sign in'}
          </button>
        </form>
        <div className="auth-switch">Don&apos;t have an account? <Link href="/sign-up">Create one</Link></div>
      </div>
    </div>
  );
}
