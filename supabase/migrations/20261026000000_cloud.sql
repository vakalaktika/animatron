-- Animatron cloud: short share links and per-account composition sync.
-- The studio is a static site; it talks to this database with the public
-- anon key, so every rule lives here as row-level security.

-- Short share links. Anyone holding a link can open it, but the table
-- itself can't be listed: reads go through get_share(id) only. Making one
-- needs a session (an anonymous one counts); each session can make a
-- limited number a day, and only a composition-shaped document is stored.
create table public.shares (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{10}$'),
  doc jsonb not null check (
    pg_column_size(doc) <= 2000000
    and jsonb_typeof(doc) = 'object'
    and jsonb_typeof(doc -> 'clips') = 'array'
    and jsonb_typeof(doc -> 'stage') = 'object'
  ),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index shares_owner_created on public.shares (owner, created_at);

alter table public.shares enable row level security;

create policy "Owners see their shares"
  on public.shares for select
  to authenticated
  using (owner = (select auth.uid()));

create policy "Signed-in users make their own shares"
  on public.shares for insert
  to authenticated
  with check (owner = (select auth.uid()));

create policy "Owners delete their shares"
  on public.shares for delete
  to authenticated
  using (owner = (select auth.uid()));

-- At most 50 new shares per session per day. A trigger, not a policy: a
-- policy that counts its own table recurses.
create function public.shares_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.shares s where s.owner = new.owner and s.created_at > now() - interval '1 day') >= 50 then
    raise exception 'Share limit reached: 50 links a day.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger shares_quota
  before insert on public.shares
  for each row execute function public.shares_quota();

-- The one way to read a share: by its exact id.
create function public.get_share(share_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select doc from public.shares where id = share_id;
$$;

revoke all on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;

-- Compositions kept in an account (never an anonymous session's). The id
-- is the browser's project id, so the same composition syncs to the same
-- row from every device. A deleted composition stays as a tombstone (no
-- document) so other devices learn of the deletion instead of re-uploading.
create table public.projects (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) <= 200),
  doc jsonb check (
    doc is null
    or (
      pg_column_size(doc) <= 5000000
      and jsonb_typeof(doc) = 'object'
      and jsonb_typeof(doc -> 'clips') = 'array'
      and jsonb_typeof(doc -> 'stage') = 'object'
    )
  ),
  deleted boolean not null default false,
  updated_at timestamptz not null,
  primary key (owner, id),
  check (deleted or doc is not null)
);

alter table public.projects enable row level security;

-- The account's own rows only, and only for a real (non-anonymous) account.
create policy "Accounts read their projects"
  on public.projects for select
  to authenticated
  using (owner = (select auth.uid()) and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

create policy "Accounts add projects"
  on public.projects for insert
  to authenticated
  with check (owner = (select auth.uid()) and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

create policy "Accounts change their projects"
  on public.projects for update
  to authenticated
  using (owner = (select auth.uid()) and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))
  with check (owner = (select auth.uid()));

create policy "Accounts delete their projects"
  on public.projects for delete
  to authenticated
  using (owner = (select auth.uid()) and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

-- The server decides which copy is newer. A write never stamps a time ahead
-- of the server's clock (a device with a fast clock can't win forever), and
-- an update older than the stored row is ignored (a stale device can't
-- overwrite newer work; its next sync brings the newer copy down).
create function public.projects_newer_wins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := least(new.updated_at, now());
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    return old;
  end if;
  return new;
end;
$$;

create trigger projects_newer_wins
  before insert or update on public.projects
  for each row execute function public.projects_newer_wins();

-- At most 1000 compositions (tombstones included) per account.
create function public.projects_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.projects p where p.owner = new.owner) >= 1000 then
    raise exception 'Account limit reached: 1000 compositions.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger projects_quota
  before insert on public.projects
  for each row execute function public.projects_quota();
