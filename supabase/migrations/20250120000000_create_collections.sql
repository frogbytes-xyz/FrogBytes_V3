-- Create collections (folders) and collection_items for grouping summaries
-- RLS-enabled, with public sharing via is_public + share_slug similar to summaries

-- Required extension for gen_random_uuid() and gen_random_bytes()
create extension if not exists pgcrypto;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default false,
  share_slug text unique,
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  summary_id uuid not null references public.summaries(id) on delete cascade,
  position int,
  created_at timestamptz not null default now(),
  primary key (collection_id, summary_id)
);

-- Trigger to update updated_at
create or replace function public.handle_collections_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger handle_collections_updated_at
before update on public.collections
for each row execute procedure public.handle_collections_updated_at();

-- Slug generator similar to summaries
create or replace function public.generate_collection_share_slug()
returns text as $$
declare
  slug text;
  exists boolean;
begin
  loop
    slug := lower(encode(gen_random_bytes(6), 'hex')); -- 12 hex chars
    select exists(select 1 from public.collections where share_slug = slug) into exists;
    exit when not exists;
  end loop;
  return slug;
end;
$$ language plpgsql;

-- Trigger to maintain share_slug/shared_at
create or replace function public.collections_share_trigger()
returns trigger as $$
begin
  if new.is_public = true and (new.share_slug is null or new.share_slug = '') then
    new.share_slug := public.generate_collection_share_slug();
    new.shared_at := now();
  end if;
  if new.is_public = false and old.is_public = true then
    new.shared_at := null;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger handle_collections_share
before update on public.collections
for each row execute procedure public.collections_share_trigger();

-- Indexes
create index if not exists collections_is_public_idx on public.collections(is_public) where is_public = true;
create index if not exists collections_share_slug_idx on public.collections(share_slug) where share_slug is not null;

-- RLS
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

-- Owner policies (DROP IF EXISTS for idempotency, then CREATE)
drop policy if exists "Users can manage their collections" on public.collections;
create policy "Users can manage their collections"
  on public.collections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage their collection items" on public.collection_items;
create policy "Users can manage their collection items"
  on public.collection_items
  for all
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_items.collection_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_items.collection_id and c.user_id = auth.uid()
    )
  );

-- Public read for shared collections
drop policy if exists "Anyone can view public collections" on public.collections;
create policy "Anyone can view public collections"
  on public.collections
  for select
  using (is_public = true);

drop policy if exists "Anyone can view items of public collections" on public.collection_items;
create policy "Anyone can view items of public collections"
  on public.collection_items
  for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_items.collection_id and c.is_public = true
    )
  );

comment on table public.collections is 'User-created folders containing multiple summaries, can be shared publicly';
comment on table public.collection_items is 'Join table mapping summaries into collections';
