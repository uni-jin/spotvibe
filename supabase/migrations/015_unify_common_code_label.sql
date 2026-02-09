-- Unify code_label_ko and code_label_en into a single code_label field
-- This migration consolidates the label fields for simplicity

-- Add new code_label column
ALTER TABLE common_codes 
ADD COLUMN IF NOT EXISTS code_label TEXT;

-- Migrate existing data: prefer code_label_en if exists, otherwise use code_label_ko
UPDATE common_codes
SET code_label = COALESCE(code_label_en, code_label_ko)
WHERE code_label IS NULL;

-- Make code_label NOT NULL after migration
ALTER TABLE common_codes
ALTER COLUMN code_label SET NOT NULL;

-- Drop old columns
ALTER TABLE common_codes
DROP COLUMN IF EXISTS code_label_ko,
DROP COLUMN IF EXISTS code_label_en;

-- Update index if needed (code_label is now the main display field)
-- The existing indexes on code_type, is_active, and display_order are still valid

-- Add comment for documentation
COMMENT ON COLUMN common_codes.code_label IS 'Display label for the code (unified, no longer separate Korean/English)';
