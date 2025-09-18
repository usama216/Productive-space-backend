-- Add hoursAllowed column to Package table
ALTER TABLE "Package" ADD COLUMN "hoursAllowed" INTEGER DEFAULT 4;

-- Update existing packages with default hours based on package type
UPDATE "Package" 
SET "hoursAllowed" = CASE 
  WHEN "packageType" = 'HALF_DAY' THEN 4
  WHEN "packageType" = 'FULL_DAY' THEN 8
  WHEN "packageType" = 'SEMESTER_BUNDLE' THEN 8
  ELSE 4
END
WHERE "hoursAllowed" IS NULL;
