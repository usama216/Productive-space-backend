-- Migration script to add student verification fields to User table
-- Run this script on your existing database to add the missing fields

-- Add student verification fields to existing User table
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "studentVerificationStatus" VARCHAR(20) DEFAULT 'PENDING' CHECK ("studentVerificationStatus" IN ('PENDING', 'VERIFIED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS "studentVerificationDate" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "studentRejectionReason" TEXT,
ADD COLUMN IF NOT EXISTS "studentVerificationImageUrl" TEXT;

-- Update existing users to have PENDING status
UPDATE "User" 
SET "studentVerificationStatus" = 'PENDING' 
WHERE "studentVerificationStatus" IS NULL;

-- Create index for better performance on verification status queries
CREATE INDEX IF NOT EXISTS idx_user_verification_status ON "User"("studentVerificationStatus");

-- Display the updated table structure
\d "User"
