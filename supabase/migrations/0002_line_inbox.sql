-- LINE OA integration + unified inbox for AI-drafted replies
-- Run this in Supabase Dashboard → SQL Editor → New query → paste → Run

-- =======================================================================
-- Tables
-- =======================================================================

create table public.line_integrations (
  id                    uuid primary key default gen_random_uuid(),
  store_id              uuid not null references public.stores on delete cascade,
  channel_access_token  text not null,
  channel_secret        text not null,
  is_enabled            boolean not null default false,
  -- 'draft' | 'auto_safe' (coming soon, not used yet) | 'off'
  auto_reply_mode       text not null default 'draft',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- One LINE integration per store for now
  unique(store_id)
);

-- Partial index: webhook handler only ever scans enabled rows
create index line_integrations_enabled_idx
  on public.line_integrations(id)
  where is_enabled = true;

create table public.inbox_messages (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null references public.stores on delete cascade,
  -- 'line' for now; 'facebook'/'shopee'/'tiktok' later
  platform             text not null default 'line',
  external_user_id     text,
  external_message_id  text,
  customer_name        text,
  message_text         text not null,
  ai_draft             text,
  intent               text,
  -- 'low' | 'medium' | 'high'
  risk_level           text not null default 'low',
  -- 'draft' | 'needs_human' | 'copied' | 'sent' | 'ignored'
  status               text not null default 'draft',
  raw_event            jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index inbox_messages_store_status_idx
  on public.inbox_messages(store_id, status);

create index inbox_messages_store_created_idx
  on public.inbox_messages(store_id, created_at desc);

-- Idempotency for webhook retries — same external_message_id from same
-- platform on same store should be a no-op insert.
create unique index inbox_messages_external_dedup
  on public.inbox_messages(store_id, platform, external_message_id)
  where external_message_id is not null;

-- =======================================================================
-- Row Level Security
-- =======================================================================

alter table public.line_integrations enable row level security;
alter table public.inbox_messages   enable row level security;

create policy "line_integrations: own store all"
  on public.line_integrations for all
  using (store_id in (select id from public.stores where owner_id = (select auth.uid())))
  with check (store_id in (select id from public.stores where owner_id = (select auth.uid())));

create policy "inbox_messages: own store all"
  on public.inbox_messages for all
  using (store_id in (select id from public.stores where owner_id = (select auth.uid())))
  with check (store_id in (select id from public.stores where owner_id = (select auth.uid())));
