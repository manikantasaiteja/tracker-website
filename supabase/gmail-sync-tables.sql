-- ============================================================
-- Gmail Sync Tables Migration
-- Run this in your Supabase SQL Editor:
-- https://app.supabase.com/project/_/sql
-- ============================================================

-- ── 1. gmail_tokens ──────────────────────────────────────────
-- Stores one OAuth token row per user (upserted on each connect)

CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_email      TEXT        NOT NULL,
  access_token     TEXT        NOT NULL,
  refresh_token    TEXT,
  token_expiry     TIMESTAMPTZ,
  scope            TEXT,
  last_sync_at     TIMESTAMPTZ,
  emails_imported  INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS gmail_tokens_user_id_idx ON public.gmail_tokens(user_id);

-- ── 2. gmail_sync_log ────────────────────────────────────────
-- Records every Gmail message ID we have processed.
-- Prevents duplicate imports across syncs.

CREATE TABLE IF NOT EXISTS public.gmail_sync_log (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_message_id   TEXT        NOT NULL,
  subject            TEXT,
  sender             TEXT,
  company            TEXT,
  role               TEXT,
  status_detected    TEXT,
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure we never log the same message twice for the same user
  CONSTRAINT gmail_sync_log_unique_msg UNIQUE (user_id, gmail_message_id)
);

-- Indexes for fast deduplication queries
CREATE INDEX IF NOT EXISTS gmail_sync_log_user_id_idx        ON public.gmail_sync_log(user_id);
CREATE INDEX IF NOT EXISTS gmail_sync_log_message_id_idx     ON public.gmail_sync_log(gmail_message_id);
CREATE INDEX IF NOT EXISTS gmail_sync_log_user_message_idx   ON public.gmail_sync_log(user_id, gmail_message_id);

-- ── 3. Row Level Security ────────────────────────────────────
-- Enable RLS so users can only see their own rows.
-- The service role key (used in API routes) bypasses RLS.

ALTER TABLE public.gmail_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_sync_log ENABLE ROW LEVEL SECURITY;

-- gmail_tokens policies
CREATE POLICY "Users can view their own Gmail tokens"
  ON public.gmail_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own Gmail tokens"
  ON public.gmail_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Gmail tokens"
  ON public.gmail_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- gmail_sync_log policies
CREATE POLICY "Users can view their own sync logs"
  ON public.gmail_sync_log FOR SELECT
  USING (auth.uid() = user_id);

-- ── 4. Updated_at trigger ────────────────────────────────────
-- Auto-update the updated_at column on gmail_tokens

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gmail_tokens_set_updated_at ON public.gmail_tokens;
CREATE TRIGGER gmail_tokens_set_updated_at
  BEFORE UPDATE ON public.gmail_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
