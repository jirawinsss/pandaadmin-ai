-- Auto-reply mode: gate auto-sending on per-store intent whitelist
-- + audit fields on inbox_messages so we know which replies came from AI
-- Run this in Supabase Dashboard → SQL Editor → New query → paste → Run

-- =======================================================================
-- line_integrations: add intent whitelist for auto_safe mode
-- =======================================================================

-- Empty array = no auto-replies even if mode = 'auto_safe' (safe default)
alter table public.line_integrations
  add column auto_reply_intents text[] not null default array[]::text[];

-- =======================================================================
-- inbox_messages: audit fields for auto-sent replies
-- =======================================================================

alter table public.inbox_messages
  add column auto_sent  boolean     not null default false,
  add column sent_at    timestamptz,
  add column send_error text;
