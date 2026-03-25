-- Migration 004: Update image storage fields
-- Date: 2025-12-18

-- Add cover_original_path to tracks table
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS cover_original_path VARCHAR(500);

-- Note: cover column already exists and stores relative path
-- This migration adds support for storing original upload path separately











