-- ===========================================
-- Run these SQL commands in Supabase Dashboard
-- SQL Editor → New Query → Paste & Run
-- ===========================================

-- Phase 2: Document Tags table
CREATE TABLE IF NOT EXISTS document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, tag)
);

ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tags" ON document_tags FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Phase 3: Document Shares table
CREATE TABLE IF NOT EXISTS document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shares_token ON document_shares(share_token);

ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages shares" ON document_shares FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Update documents RLS for shared access
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Users can read own documents" ON documents;
DROP POLICY IF EXISTS "Owner or shared can view" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Owner or edit-shared can update" ON documents;

-- SELECT: owner OR has valid share token
CREATE POLICY "Owner or shared can view" ON documents FOR SELECT
  USING (
    auth.uid() = user_id
    OR id IN (
      SELECT document_id FROM document_shares
      WHERE (expires_at IS NULL OR expires_at > now())
    )
  );

-- UPDATE: owner OR has valid edit share
CREATE POLICY "Owner or edit-shared can update" ON documents FOR UPDATE
  USING (
    auth.uid() = user_id
    OR id IN (
      SELECT document_id FROM document_shares
      WHERE permission = 'edit'
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

-- INSERT and DELETE remain owner-only (existing policies should cover this)
