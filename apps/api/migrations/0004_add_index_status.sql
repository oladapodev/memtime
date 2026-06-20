-- Add missing columns to repos table
ALTER TABLE repos ADD COLUMN index_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE repos ADD COLUMN trigger_mode TEXT NOT NULL DEFAULT 'auto';
