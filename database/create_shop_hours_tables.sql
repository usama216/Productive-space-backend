-- Create Shop Hours Management Tables
-- This enables admins to set daily operating hours and special closure dates

-- Table 1: Operating Hours (Daily Schedule)
CREATE TABLE IF NOT EXISTS "OperatingHours" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "location" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6),
  "openTime" TIME NOT NULL,
  "closeTime" TIME NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("location", "dayOfWeek")
);

-- Table 2: Closure Dates (Vacation/Holiday Mode)
CREATE TABLE IF NOT EXISTS "ClosureDates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "location" TEXT NOT NULL,
  "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "reason" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK ("endDate" >= "startDate")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_operating_hours_location" ON "OperatingHours"("location");
CREATE INDEX IF NOT EXISTS "idx_operating_hours_active" ON "OperatingHours"("isActive");
CREATE INDEX IF NOT EXISTS "idx_closure_dates_location" ON "ClosureDates"("location");
CREATE INDEX IF NOT EXISTS "idx_closure_dates_active" ON "ClosureDates"("isActive");
CREATE INDEX IF NOT EXISTS "idx_closure_dates_range" ON "ClosureDates"("startDate", "endDate");

-- Add comments for documentation
COMMENT ON TABLE "OperatingHours" IS 'Daily operating hours for each location (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON TABLE "ClosureDates" IS 'Special closure dates for vacation, maintenance, or holidays';
COMMENT ON COLUMN "OperatingHours"."dayOfWeek" IS '0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday';
COMMENT ON COLUMN "ClosureDates"."reason" IS 'Reason for closure (e.g., Vacation, Maintenance, Holiday)';

-- Insert default operating hours for Kovan (Mon-Sun 7am-11pm)
INSERT INTO "OperatingHours" ("location", "dayOfWeek", "openTime", "closeTime")
VALUES
  ('Kovan', 0, '07:00:00', '23:00:00'), -- Sunday
  ('Kovan', 1, '07:00:00', '23:00:00'), -- Monday
  ('Kovan', 2, '07:00:00', '23:00:00'), -- Tuesday
  ('Kovan', 3, '07:00:00', '23:00:00'), -- Wednesday
  ('Kovan', 4, '07:00:00', '23:00:00'), -- Thursday
  ('Kovan', 5, '07:00:00', '23:00:00'), -- Friday
  ('Kovan', 6, '07:00:00', '23:00:00')  -- Saturday
ON CONFLICT ("location", "dayOfWeek") DO NOTHING;
