-- Extend offer storage to act as an "Offer Library" per user (safe for demo + future webapp).
-- This augments the existing `offer` table created in 0002_core_entities.sql.

ALTER TABLE offer
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS format TEXT,
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_tone TEXT,
  ADD COLUMN IF NOT EXISTS user_mode TEXT;


