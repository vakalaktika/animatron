-- Animatron cloud: short share links and per-account composition sync.
-- The studio is a static site; it talks to this database with the public
-- anon key, so every rule lives here as row-level security.

-- Short share links. Anyone can open one; only a signed-in user (an
-- anonymous session counts) can make one, and it is theirs to delete.
create table public.shares (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{10}$'),
  doc jsonb not null check (pg_column_size(doc) <= 2000000),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.shares enable row level security;

create policy "Anyone can open a share"
  on public.shares for select
  to anon, authenticated
  using (true);

create policy "Signed-in users make their own shares"
  on public.shares for insert
  to authenticated
  with check (owner = (select auth.uid()));

create policy "Owners delete their shares"
  on public.shares for delete
  to authenticated
  using (owner = (select auth.uid()));

-- Compositions kept in an account. The id is the browser's project id, so
-- the same composition syncs to the same row from every device.
create table public.projects (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) <= 200),
  doc jsonb not null check (pg_column_size(doc) <= 5000000),
  updated_at timestamptz not null,
  primary key (owner, id)
);

alter table public.projects enable row level security;

create policy "Owners read their projects"
  on public.projects for select
  to authenticated
  using (owner = (select auth.uid()));

create policy "Owners add projects"
  on public.projects for insert
  to authenticated
  with check (owner = (select auth.uid()));

create policy "Owners change their projects"
  on public.projects for update
  to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

create policy "Owners delete their projects"
  on public.projects for delete
  to authenticated
  using (owner = (select auth.uid()));
