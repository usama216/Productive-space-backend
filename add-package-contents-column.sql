-- Add packageContents column to Package table
ALTER TABLE "Package" ADD COLUMN "packageContents" JSONB;

-- Add default values for existing packages
UPDATE "Package" 
SET "packageContents" = jsonb_build_object(
  'halfDayHours', 4,
  'fullDayHours', 8,
  'complimentaryHours', 0,
  'totalHours', 8
)
WHERE "packageContents" IS NULL;
