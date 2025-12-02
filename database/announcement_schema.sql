-- Latest Announcement Feature Database Schema
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS "Announcement" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create index for efficient querying by order and active status
CREATE INDEX IF NOT EXISTS idx_announcement_order ON "Announcement"("order", "isActive");

-- Add comment to table
COMMENT ON TABLE "Announcement" IS 'Stores announcements displayed on the landing page carousel';

-- Optional: Insert sample data for testing
INSERT INTO "Announcement" ("title", "description", "imageUrl", "order", "isActive") VALUES
  ('Welcome to Our Space!', 'Experience the best co-working environment in town', '/mock_img/announcement1.png', 1, true),
  ('Special Offers This Month', 'Get 20% off on all monthly packages', '/mock_img/announcement2.png', 2, true),
  ('New Facilities Available', 'Check out our new meeting rooms and pods', '/mock_img/announcement3.png', 3, true);
