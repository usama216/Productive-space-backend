-- Migrate UserPass table to count-based system
-- This script updates the UserPass table to use count-based passes instead of hours

-- Step 1: Add new count-based columns
ALTER TABLE "UserPass" 
ADD COLUMN IF NOT EXISTS "totalCount" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "remainingCount" INTEGER DEFAULT 1;

-- Step 2: Migrate existing data from hours to count-based
-- For existing records, set totalCount and remainingCount based on hours and status
UPDATE "UserPass" 
SET 
  "totalCount" = CASE 
    WHEN "hours" > 0 THEN "hours"
    ELSE 1
  END,
  "remainingCount" = CASE 
    WHEN "status" = 'ACTIVE' AND "hours" > 0 THEN "hours"
    WHEN "status" = 'USED' THEN 0
    WHEN "status" = 'EXPIRED' THEN 0
    ELSE 1
  END
WHERE "totalCount" IS NULL OR "remainingCount" IS NULL;

-- Step 3: Update the expiresAt column if it doesn't exist
ALTER TABLE "UserPass" 
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP WITH TIME ZONE;

-- Step 4: Set expiresAt for existing records (30 days from creation)
UPDATE "UserPass" 
SET "expiresAt" = "createdat" + INTERVAL '30 days'
WHERE "expiresAt" IS NULL;

-- Step 5: Test the migration by checking a few records
SELECT 
  id,
  "packagepurchaseid",
  "passtype",
  "hours",
  "totalCount",
  "remainingCount",
  "status",
  "expiresAt"
FROM "UserPass" 
LIMIT 5;

-- Step 6: Verify the migration worked
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN "totalCount" > 0 THEN 1 END) as records_with_total_count,
  COUNT(CASE WHEN "remainingCount" >= 0 THEN 1 END) as records_with_remaining_count
FROM "UserPass";

SELECT 'UserPass migration to count-based system completed!' as status;
