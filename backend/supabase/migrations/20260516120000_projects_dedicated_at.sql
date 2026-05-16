-- Dedicated computer: project-level flag; sandbox excluded from Daytona LRU eviction.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS dedicated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projects_account_dedicated_at
  ON projects (account_id, dedicated_at)
  WHERE dedicated_at IS NOT NULL;

COMMENT ON COLUMN projects.dedicated_at IS
  'When set, this project''s sandbox is kept across LRU eviction (Pro/Ultra, one per account).';
