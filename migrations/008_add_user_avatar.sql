-- Migration 008: Add user avatar support
-- Date: 2025-12-18

-- Add avatar column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar VARCHAR(500);

-- Create index for faster lookups (optional)
CREATE INDEX IF NOT EXISTS idx_users_avatar ON users(avatar) WHERE avatar IS NOT NULL;









