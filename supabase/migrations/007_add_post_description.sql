-- Add description field to posts table
-- This migration adds a description field to allow users to add text descriptions to their posts (max 500 characters)

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add check constraint to limit description length to 500 characters
ALTER TABLE posts
ADD CONSTRAINT check_description_length CHECK (description IS NULL OR LENGTH(description) <= 500);

-- Add index for full-text search (optional, for future search functionality)
CREATE INDEX IF NOT EXISTS idx_posts_description_gin ON posts USING GIN(to_tsvector('english', COALESCE(description, '')));
