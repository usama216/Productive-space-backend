-- Add columns for soft cancellation and refund tracking
ALTER TABLE "Booking" 
ADD COLUMN IF NOT EXISTS "refundamount" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "refundreason" TEXT,
ADD COLUMN IF NOT EXISTS "refundrequestedat" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'confirmed';

-- Update existing NULL status to 'confirmed'
UPDATE "Booking" SET "status" = 'confirmed' WHERE "status" IS NULL;

-- Optional: Add comment to explain the columns
COMMENT ON COLUMN "Booking"."refundamount" IS 'Amount to be refunded for cancelled booking';
COMMENT ON COLUMN "Booking"."refundreason" IS 'Reason for cancellation/refund';
COMMENT ON COLUMN "Booking"."refundrequestedat" IS 'Timestamp when the refund/cancellation was requested';
COMMENT ON COLUMN "Booking"."status" IS 'Booking status: confirmed, cancelled, etc.';

-- Reload PostgREST schema cache to recognize new columns immediately
NOTIFY pgrst, 'reload config';
