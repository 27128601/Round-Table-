import { createClient, getAuthedUser } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await getAuthedUser(supabase);
  if (!user) redirect('/sign-in');

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  return (
    <div className="app-shell">
      <Sidebar sessions={sessions ?? []} email={user.email ?? ''} />
      <div className="main-col">{children}</div>
    </div>
  );
}
