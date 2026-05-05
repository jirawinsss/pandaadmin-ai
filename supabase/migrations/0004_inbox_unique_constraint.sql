-- Fix: replace the partial unique index from 0002 with a full unique
-- constraint so that supabase-js .upsert(onConflict: ...) can match it.
--
-- The partial index `where external_message_id is not null` was rejected
-- by PostgreSQL ON CONFLICT inference because the client doesn't pass the
-- WHERE clause:
--   "there is no unique or exclusion constraint matching the
--    ON CONFLICT specification"
--
-- Postgres treats NULLs as distinct in unique constraints by default, so
-- multiple rows with external_message_id IS NULL still coexist — same
-- effective behavior as the partial index, but ON CONFLICT works.
--
-- Run this in Supabase Dashboard → SQL Editor → New query → paste → Run

drop index if exists public.inbox_messages_external_dedup;

alter table public.inbox_messages
  add constraint inbox_messages_external_dedup
  unique (store_id, platform, external_message_id);
