-- Add disabled field to User table
-- This field will be used to disable users without deleting them
-- Disabled users cannot login or perform any activities

-- Add disabled column if it doesn't exist
ALTER TABLE "public"."User" 
ADD COLUMN IF NOT EXISTS "disabled" BOOLEAN DEFAULT false;

-- Add isDisabled column if it doesn't exist (for backward compatibility)
ALTER TABLE "public"."User" 
ADD COLUMN IF NOT EXISTS "isDisabled" BOOLEAN DEFAULT false;

-- Update existing NULL values to false
UPDATE "public"."User" 
SET "disabled" = false 
WHERE "disabled" IS NULL;

UPDATE "public"."User" 
SET "isDisabled" = false 
WHERE "isDisabled" IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN "public"."User"."disabled" IS 'Whether the user account is disabled. Disabled users cannot login or perform activities.';
COMMENT ON COLUMN "public"."User"."isDisabled" IS 'Alternative field for disabled status (for backward compatibility).';

-- Create index for faster queries on disabled users
CREATE INDEX IF NOT EXISTS "User_disabled_idx" ON "public"."User"("disabled");

-- Reload PostgREST schema cache to recognize new columns immediately
NOTIFY pgrst, 'reload config';

