-- Share pages: what the share page service (share/) needs to show a short
-- link with a preview card. The studio still makes and opens shares as
-- before; this adds the piece's length, a public bucket for the card, and
-- a small read of what the page shows.

-- Seconds, as the studio measured it. Null for shares made before this.
-- No upper bound: a clip may start late and run long.
alter table public.shares
  add column duration real check (duration is null or duration > 0);

-- What a share page shows, without sending the whole document: the name,
-- the sentence about it, the frame size, the layer count and the length.
-- Shapes are passed through as stored; the page checks them.
create function public.get_share_meta(share_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', doc -> 'name',
    'description', coalesce(doc -> 'description', '""'::jsonb),
    'width', doc -> 'stage' -> 'width',
    'height', doc -> 'stage' -> 'height',
    'layers', jsonb_array_length(doc -> 'clips'),
    'duration', duration,
    'createdAt', created_at
  )
  from public.shares
  where id = share_id;
$$;

revoke all on function public.get_share_meta(text) from public;
grant execute on function public.get_share_meta(text) to anon, authenticated;

-- Preview cards: one PNG per share, named <share id>.png. The bucket is
-- public (a card is as public as its link). Only the share's owner can add
-- its card, once: there is no update policy, so a card never changes after
-- the link is made. The owner can delete it, as they can the share.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('share-cards', 'share-cards', true, 1500000, array['image/png'])
on conflict (id) do nothing;

create policy "Share owners add the share's card"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'share-cards'
    and exists (
      select 1 from public.shares s
      where s.owner = (select auth.uid()) and name = s.id || '.png'
    )
  );

-- Deleting a file needs it visible to its owner too (the card is public
-- through the bucket's URL either way).
create policy "Share owners see the share's card"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'share-cards' and owner_id = (select auth.uid())::text);

create policy "Share owners delete the share's card"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'share-cards' and owner_id = (select auth.uid())::text);
