'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { SessionRow } from '@/lib/types';

export default function Sidebar({ sessions, email }: { sessions: Pick<SessionRow, 'id' | 'title' | 'updated_at'>[]; email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">Your sessions</span>
        <Link href="/" className="sidebar-new">+ New</Link>
      </div>
      <div className="sidebar-list">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/session/${s.id}`}
            className={`sidebar-item${pathname === `/session/${s.id}` ? ' active' : ''}`}
            title={s.title}
          >
            {s.title || 'Untitled idea'}
          </Link>
        ))}
        {sessions.length === 0 && <div className="sidebar-item" style={{ color: 'var(--ink-faint)', cursor: 'default' }}>No sessions yet</div>}
      </div>
      <div className="sidebar-foot">
        <div style={{ marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
        <button onClick={signOut}>Sign out</button>
      </div>
    </nav>
  );
}
