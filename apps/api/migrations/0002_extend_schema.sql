-- Add status column to existing installations
ALTER TABLE installations ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- Index tracking
CREATE TABLE IF NOT EXISTS index_jobs (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  step TEXT,
  progress INTEGER DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS codebase_docs (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(repo_id, doc_type)
);

-- Fix pipeline
CREATE TABLE IF NOT EXISTS fix_diffs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  finding_id TEXT NOT NULL,
  patch TEXT NOT NULL,
  explanation TEXT,
  confidence REAL,
  verified INTEGER NOT NULL DEFAULT 0,
  sandbox_log TEXT,
  applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger configs
CREATE TABLE IF NOT EXISTS trigger_configs (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL UNIQUE,
  trigger_mode TEXT NOT NULL DEFAULT 'auto',
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- MCP sessions
CREATE TABLE IF NOT EXISTS mcp_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  scopes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- OAuth sessions
CREATE TABLE IF NOT EXISTS oauth_sessions (
  id TEXT PRIMARY KEY,
  github_user_id INTEGER,
  github_login TEXT,
  access_token TEXT,
  session_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);
