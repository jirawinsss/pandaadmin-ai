-- PandaAdmin AI — initial schema
-- Run this in Supabase Dashboard → SQL Editor → New query → paste → Run

-- =======================================================================
-- Tables
-- =======================================================================

create table public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  email           text,
  plan            text not null default 'free',
  usage_reply     int  not null default 0,
  usage_post      int  not null default 0,
  usage_reset_at  timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create table public.stores (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references public.profiles on delete cascade,
  name                text not null default '',
  description         text,
  brand_voice         text,
  voice_examples      text,
  shipping_policy     text,
  return_policy       text,
  payment_methods     text,
  current_promotions  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index stores_owner_id_idx on public.stores(owner_id);

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores on delete cascade,
  name              text not null default '',
  price             text,
  description       text,
  key_features      text,
  target_customer   text,
  common_questions  jsonb,
  created_at        timestamptz not null default now()
);
create index products_store_id_idx on public.products(store_id);

create table public.faqs (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores on delete cascade,
  question    text not null default '',
  answer      text not null default '',
  created_at  timestamptz not null default now()
);
create index faqs_store_id_idx on public.faqs(store_id);

create table public.reply_history (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores on delete cascade,
  customer_msg  text,
  ai_reply      text,
  created_at    timestamptz not null default now()
);
create index reply_history_store_id_idx on public.reply_history(store_id);

create table public.post_history (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores on delete cascade,
  product_id  uuid references public.products on delete set null,
  post_type   text,
  content     text,
  created_at  timestamptz not null default now()
);
create index post_history_store_id_idx on public.post_history(store_id);

-- =======================================================================
-- Trigger: when a new auth.users row is created, auto-create a profile
-- and an empty store so the user can land on /dashboard immediately.
-- SECURITY DEFINER lets it bypass RLS (the user has no session yet).
-- =======================================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  insert into public.stores (owner_id, name)
  values (new.id, '');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =======================================================================
-- Row Level Security
-- =======================================================================

alter table public.profiles      enable row level security;
alter table public.stores        enable row level security;
alter table public.products      enable row level security;
alter table public.faqs          enable row level security;
alter table public.reply_history enable row level security;
alter table public.post_history  enable row level security;

-- profiles: user can read + update their own row only
create policy "profiles: own row read"
  on public.profiles for select
  using (id = (select auth.uid()));

create policy "profiles: own row update"
  on public.profiles for update
  using (id = (select auth.uid()));

-- stores: user owns the row via owner_id
create policy "stores: own rows all"
  on public.stores for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- helper: scope child tables to stores the user owns
-- (one combined policy covers select/insert/update/delete)
create policy "products: own store all"
  on public.products for all
  using (store_id in (select id from public.stores where owner_id = (select auth.uid())))
  with check (store_id in (select id from public.stores where owner_id = (select auth.uid())));

create policy "faqs: own store all"
  on public.faqs for all
  using (store_id in (select id from public.stores where owner_id = (select auth.uid())))
  with check (store_id in (select id from public.stores where owner_id = (select auth.uid())));

create policy "reply_history: own store all"
  on public.reply_history for all
  using (store_id in (select id from public.stores where owner_id = (select auth.uid())))
  with check (store_id in (select id from public.stores where owner_id = (select auth.uid())));

create policy "post_history: own store all"
  on public.post_history for all
  using (store_id in (select id from public.stores where owner_id = (select auth.uid())))
  with check (store_id in (select id from public.stores where owner_id = (select auth.uid())));
