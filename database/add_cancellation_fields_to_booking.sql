-- Add cancellation fields to Booking table for admin cancellation tracking
-- This migration adds columns to track who cancelled the booking and when

-- Add cancelledBy column to track who cancelled (admin/user)
ALTER TABLE "public"."Booking" 
ADD COLUMN IF NOT EXISTS "cancelledBy" VARCHAR(50);

-- Add cancelledAt column to track when booking was cancelled
ALTER TABLE "public"."Booking" 
ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP WITH TIME ZONE;

-- Add cancellationReason column to store reason for cancellation
ALTER TABLE "public"."Booking" 
ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

-- Add refundAmount column to track refund amount (if different from totalAmount)
ALTER TABLE "public"."Booking" 
ADD COLUMN IF NOT EXISTS "refundAmount" DECIMAL(10, 2);

-- Create index on cancelledBy for faster queries
CREATE INDEX IF NOT EXISTS "Booking_cancelledBy_idx" ON "public"."Booking"("cancelledBy");

-- Create index on cancelledAt for faster queries
CREATE INDEX IF NOT EXISTS "Booking_cancelledAt_idx" ON "public"."Booking"("cancelledAt");

-- Add comment to columns for documentation
COMMENT ON COLUMN "public"."Booking"."cancelledBy" IS 'Who cancelled the booking: admin or user';
COMMENT ON COLUMN "public"."Booking"."cancelledAt" IS 'Timestamp when booking was cancelled';
COMMENT ON COLUMN "public"."Booking"."cancellationReason" IS 'Reason for cancellation';
COMMENT ON COLUMN "public"."Booking"."refundAmount" IS 'Refund amount (may differ from totalAmount)';


