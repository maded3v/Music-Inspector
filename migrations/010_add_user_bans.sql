-- Migration 010: Add user ban fields
-- Date: 2026-03-29

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS banned_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);
