-- Feedback and self-healing loop
CREATE TABLE IF NOT EXISTS finding_feedback (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK(feedback_type IN ('helpful', 'false_positive', 'not_useful')),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(finding_id, run_id)
);

CREATE TABLE IF NOT EXISTS rule_health (
  rule_id TEXT PRIMARY KEY,
  total_findings INTEGER NOT NULL DEFAULT 0,
  false_positive_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  false_positive_rate REAL NOT NULL DEFAULT 0.0,
  current_severity TEXT NOT NULL DEFAULT 'medium',
  auto_suppressed INTEGER NOT NULL DEFAULT 0,
  last_evaluated TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add feedback count to findings table
ALTER TABLE findings ADD COLUMN feedback_type TEXT;

-- Add suppressed flag to rules tracking
ALTER TABLE installations ADD COLUMN auto_feedback_enabled INTEGER NOT NULL DEFAULT 1;
