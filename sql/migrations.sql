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

-- INSERT: only owner
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Insert own documents" ON documents;
CREATE POLICY "Insert own documents" ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE: only owner
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
DROP POLICY IF EXISTS "Delete own documents" ON documents;
CREATE POLICY "Delete own documents" ON documents FOR DELETE
  USING (auth.uid() = user_id);

-- Phase 4: Chat Messages table (AI chat persistence)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  function_call JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_doc_created
  ON chat_messages(document_id, created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat messages" ON chat_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Phase 5: Document Versions table (version history)
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_doc_created
  ON document_versions(document_id, created_at DESC);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own versions" ON document_versions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Phase 6: Realtime Collaboration (Broadcast & Presence authorization)
CREATE POLICY "Authenticated users can use Realtime"
ON realtime.messages
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Phase 7: Version History enhancements (Assignment #4)
-- Add version_number, label, created_by columns
ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS version_number INTEGER,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Backfill existing rows with sequential version_number
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY created_at ASC) AS rn
  FROM document_versions
  WHERE version_number IS NULL
)
UPDATE document_versions
SET version_number = numbered.rn
FROM numbered
WHERE document_versions.id = numbered.id;

-- Backfill created_by from user_id for existing rows
UPDATE document_versions
SET created_by = user_id
WHERE created_by IS NULL;

-- Replace old RLS policies with granular ones
DROP POLICY IF EXISTS "Users manage own versions" ON document_versions;

-- SELECT: owner OR shared-edit collaborators
CREATE POLICY "Version select: owner or shared-edit" ON document_versions FOR SELECT
  USING (
    auth.uid() = user_id
    OR document_id IN (
      SELECT document_id FROM document_shares
      WHERE permission = 'edit'
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

-- INSERT: owner OR shared-edit collaborators
CREATE POLICY "Version insert: owner or shared-edit" ON document_versions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR document_id IN (
      SELECT document_id FROM document_shares
      WHERE permission = 'edit'
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

-- DELETE: only document owner
CREATE POLICY "Version delete: owner only" ON document_versions FOR DELETE
  USING (auth.uid() = user_id);

-- Set version_number NOT NULL and add unique constraint
ALTER TABLE document_versions ALTER COLUMN version_number SET NOT NULL;
ALTER TABLE document_versions ADD CONSTRAINT document_versions_doc_version_unique UNIQUE(document_id, version_number);
