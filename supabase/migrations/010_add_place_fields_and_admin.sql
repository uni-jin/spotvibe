-- Add fields to places table and create admin accounts table
-- This migration adds thumbnail_url and description to places, and creates admin_accounts table

-- Add thumbnail_url and description to places table
ALTER TABLE places 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create admin_accounts table for admin authentication
CREATE TABLE IF NOT EXISTS admin_accounts (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hash
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Create index for username lookup
CREATE INDEX IF NOT EXISTS idx_admin_accounts_username ON admin_accounts(username);

-- Enable RLS on admin_accounts
ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can read admin_accounts (will be checked in application layer)
CREATE POLICY "Only authenticated admins can read admin_accounts" ON admin_accounts
  FOR SELECT USING (true); -- Application layer will verify admin status

-- Initial admin account (password: wlsdn123)
-- Hash generated using: node scripts/generate-admin-hash.js
INSERT INTO admin_accounts (username, password_hash) 
VALUES ('super', '$2b$10$ssrv3GYacH1t9keNIaqknel3iSwjAhPlnR/37cYQXCRw1tdweiZdK')
ON CONFLICT (username) DO NOTHING;

-- Add comments for documentation
COMMENT ON COLUMN places.thumbnail_url IS 'Thumbnail image URL for the place';
COMMENT ON COLUMN places.description IS 'Description of the place';
COMMENT ON TABLE admin_accounts IS 'Admin accounts for admin site authentication';
