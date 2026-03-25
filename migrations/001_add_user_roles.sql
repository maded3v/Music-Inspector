-- Migration 001: Add role and is_mi_reviewer columns to users table
-- Date: 2025-12-18

-- Create role enum type
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column with default 'user'
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user' NOT NULL;

-- Add is_mi_reviewer flag
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_mi_reviewer BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index on role for admin queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update existing users to have 'user' role explicitly (if any exist)
UPDATE users SET role = 'user' WHERE role IS NULL;











