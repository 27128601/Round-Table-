-- The Round Table v2 — initial schema
-- Run this in the Supabase SQL editor for your project (or via `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- sessions: one row per debate session. message_count is the §10.1 rate-limit
-- counter (user-initiated actions, not model calls).
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled idea',
  idea_text text not null default '',
  attachments jsonb not null default '[]'::jsonb, -- [{name, markdown, extractedOk}]
  lang text not null default 'en',
  message_count int not null default 0,
  status text not null default 'active', -- active | wrapped_up
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_user_id_updated_at_idx
  on sessions (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- rounds: one row per full §4.2 8-call debate round. Every step of the round
-- carries its own status (per §8.2 / §10.3) so a partially-failed round is
-- storable and re-openable, not "corrupt".
-- ---------------------------------------------------------------------------
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  round_index int not null,
  kind text not null default 'initial', -- initial | reaction | standalone
  grounding_status text not null default 'not_attempted', -- not_attempted | complete | failed
  grounding_result jsonb, -- {text, sources:[{title,url}]}
  initial_takes jsonb not null default '[]'::jsonb, -- [{agentId, status, text, sources}]
  alignment_status text not null default 'not_attempted',
  alignment_result text,
  tactics jsonb not null default '[]'::jsonb, -- [{agentId, status, text, sources}]
  billed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists rounds_session_id_idx on rounds (session_id, round_index);

-- ---------------------------------------------------------------------------
-- human_turns: the mandatory human-turn step (carried over unchanged, §12),
-- adapted to reference whichever 3 agents asked the questions.
-- ---------------------------------------------------------------------------
create table if not exists human_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  round_id uuid references rounds(id) on delete set null,
  questions jsonb not null default '[]'::jsonb, -- [{agentId, question}]
  answers jsonb not null default '[]'::jsonb, -- [{agentId, answer}]
  general_note text,
  created_at timestamptz not null default now()
);

create index if not exists human_turns_session_id_idx on human_turns (session_id);

-- ---------------------------------------------------------------------------
-- agent_threads: direct-to-agent replies (carried over unchanged, §12).
-- ---------------------------------------------------------------------------
create table if not exists agent_threads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  agent_id text not null,
  founder_message text not null,
  agent_reply text,
  created_at timestamptz not null default now()
);

create index if not exists agent_threads_session_id_idx on agent_threads (session_id);

-- ---------------------------------------------------------------------------
-- plans: wrap-up execution plan (carried over unchanged, §12). Uncounted
-- against the rate limit per §10.1/§11.
-- ---------------------------------------------------------------------------
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  title text,
  steps jsonb not null default '[]'::jsonb,
  risk text,
  validate text,
  created_at timestamptz not null default now()
);

create index if not exists plans_session_id_idx on plans (session_id);

-- ---------------------------------------------------------------------------
-- RLS: every table is owner-scoped through sessions.user_id = auth.uid().
-- All application access goes through the user's own Supabase session (never
-- the service-role key), so RLS is the real enforcement boundary.
-- ---------------------------------------------------------------------------
alter table sessions enable row level security;
alter table rounds enable row level security;
alter table human_turns enable row level security;
alter table agent_threads enable row level security;
alter table plans enable row level security;

create policy "sessions_owner_all" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "rounds_owner_all" on rounds
  for all using (
    exists (select 1 from sessions s where s.id = rounds.session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from sessions s where s.id = rounds.session_id and s.user_id = auth.uid())
  );

create policy "human_turns_owner_all" on human_turns
  for all using (
    exists (select 1 from sessions s where s.id = human_turns.session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from sessions s where s.id = human_turns.session_id and s.user_id = auth.uid())
  );

create policy "agent_threads_owner_all" on agent_threads
  for all using (
    exists (select 1 from sessions s where s.id = agent_threads.session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from sessions s where s.id = agent_threads.session_id and s.user_id = auth.uid())
  );

create policy "plans_owner_all" on plans
  for all using (
    exists (select 1 from sessions s where s.id = plans.session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from sessions s where s.id = plans.session_id and s.user_id = auth.uid())
  );

-- Atomic, race-safe rate-limit increment used by the 4 non-round charged
-- actions (§10.1): returns the new count, or no row if already at the cap.
create or replace function increment_message_count(p_session_id uuid, p_max int)
returns table (new_count int) as $$
  update sessions
    set message_count = message_count + 1, updated_at = now()
    where id = p_session_id and message_count < p_max
    returning message_count;
$$ language sql volatile;
