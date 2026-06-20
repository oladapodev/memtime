CREATE TABLE IF NOT EXISTS installations (
  id TEXT PRIMARY KEY,
  account_login TEXT NOT NULL,
  github_installation_id INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  full_name TEXT NOT NULL UNIQUE,
  default_branch TEXT NOT NULL DEFAULT 'main',
  memfork_main_branch TEXT NOT NULL DEFAULT 'main',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  head_sha TEXT,
  base_sha TEXT,
  title TEXT,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(repo_id, number)
);

CREATE TABLE IF NOT EXISTS review_runs (
  id TEXT PRIMARY KEY,
  pr_id TEXT NOT NULL,
  status TEXT NOT NULL,
  pr_branch TEXT NOT NULL,
  summary TEXT,
  markdown TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line INTEGER,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  memory_fact TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  branch TEXT NOT NULL,
  detail TEXT NOT NULL,
  ok INTEGER NOT NULL,
  tx_id TEXT,
  blob_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  fact TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  promoted_at TEXT
);
