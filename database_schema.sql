-- Database Schema for Productive Space Backend with Promo Code System

-- ==================== EXISTING TABLES ====================

-- User table (if not exists)
CREATE TABLE IF NOT EXISTS "User" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(20),
    memberType VARCHAR(50) DEFAULT 'regular',
    -- Student verification fields
    studentVerificationStatus VARCHAR(20) DEFAULT 'PENDING' CHECK (studentVerificationStatus IN ('PENDING', 'VERIFIED', 'REJECTED')),
    studentVerificationDate TIMESTAMP WITH TIME ZONE,
    studentRejectionReason TEXT,
    studentVerificationImageUrl TEXT,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Booking table (existing - adding promo code fields)
CREATE TABLE IF NOT EXISTS "Booking" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookingRef VARCHAR(100) UNIQUE,
    userId UUID REFERENCES "User"(id),
    location VARCHAR(255),
    bookedAt TIMESTAMP WITH TIME ZONE,
    startAt TIMESTAMP WITH TIME ZONE,
    endAt TIMESTAMP WITH TIME ZONE,
    specialRequests TEXT,
    seatNumbers TEXT[],
    pax INTEGER,
    students INTEGER,
    members INTEGER,
    tutors INTEGER,
    totalCost DECIMAL(10,2),
    discountId VARCHAR(100),
    totalAmount DECIMAL(10,2),
    memberType VARCHAR(50),
    bookedForEmails TEXT[],
    confirmedPayment BOOLEAN DEFAULT FALSE,
    paymentId UUID,
    promoCodeId UUID, -- NEW: Reference to applied promo code
    discountAmount DECIMAL(10,2) DEFAULT 0, -- NEW: Amount discounted by promo code
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment table (existing)
CREATE TABLE IF NOT EXISTS "Payment" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startAt TIMESTAMP WITH TIME ZONE,
    endAt TIMESTAMP WITH TIME ZONE,
    cost DECIMAL(10,2),
    totalAmount DECIMAL(10,2),
    paidAt TIMESTAMP WITH TIME ZONE,
    bookingRef VARCHAR(100),
    paidBy VARCHAR(255),
    discountCode VARCHAR(100),
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== NEW TABLES FOR PROMO CODE SYSTEM ====================

-- PromoCode table
CREATE TABLE IF NOT EXISTS "PromoCode" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discountType VARCHAR(20) NOT NULL CHECK (discountType IN ('percentage', 'fixed')),
    discountValue DECIMAL(10,2) NOT NULL,
    maxDiscountAmount DECIMAL(10,2), -- For percentage discounts
    minimumAmount DECIMAL(10,2), -- Minimum booking amount required
    validFrom TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    validUntil TIMESTAMP WITH TIME ZONE, -- NULL means no expiration
    usageLimit INTEGER DEFAULT 1, -- How many times a user can use this code
    globalUsageLimit INTEGER, -- Total times this code can be used globally
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PromoCodeUsage table - tracks when and by whom promo codes are used
CREATE TABLE IF NOT EXISTS "PromoCodeUsage" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoCodeId UUID NOT NULL REFERENCES "PromoCode"(id),
    userId UUID NOT NULL REFERENCES "User"(id),
    bookingId UUID NOT NULL REFERENCES "Booking"(id),
    usedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES FOR PERFORMANCE ====================

-- PromoCode indexes
CREATE INDEX IF NOT EXISTS idx_promocode_code ON "PromoCode"(code);
CREATE INDEX IF NOT EXISTS idx_promocode_active ON "PromoCode"(isActive);
CREATE INDEX IF NOT EXISTS idx_promocode_validity ON "PromoCode"(validFrom, validUntil);

-- PromoCodeUsage indexes
CREATE INDEX IF NOT EXISTS idx_promocodeusage_user ON "PromoCodeUsage"(userId);
CREATE INDEX IF NOT EXISTS idx_promocodeusage_promo ON "PromoCodeUsage"(promoCodeId);
CREATE INDEX IF NOT EXISTS idx_promocodeusage_booking ON "PromoCodeUsage"(bookingId);

-- Booking indexes (if not exists)
CREATE INDEX IF NOT EXISTS idx_booking_user ON "Booking"(userId);
CREATE INDEX IF NOT EXISTS idx_booking_ref ON "Booking"(bookingRef);
CREATE INDEX IF NOT EXISTS idx_booking_promo ON "Booking"(promoCodeId);

-- ==================== SAMPLE DATA FOR TESTING ====================

-- Insert sample promo codes
INSERT INTO "PromoCode" (code, description, discountType, discountValue, maxDiscountAmount, minimumAmount, validFrom, validUntil, usageLimit, globalUsageLimit, isActive) VALUES
('WELCOME20', 'Welcome discount for new users', 'percentage', 20, 50.00, 30.00, NOW(), NOW() + INTERVAL '1 year', 1, 100, true),
('SAVE10', 'Save 10% on any booking', 'percentage', 10, NULL, 20.00, NOW(), NOW() + INTERVAL '6 months', 3, 500, true),
('FLAT5', 'Flat $5 off any booking', 'fixed', 5.00, NULL, 15.00, NOW(), NOW() + INTERVAL '3 months', 5, 200, true),
('FIRST50', '50% off first booking', 'percentage', 50, 100.00, 25.00, NOW(), NOW() + INTERVAL '1 year', 1, 50, true)
ON CONFLICT (code) DO NOTHING;

-- ==================== VIEWS FOR REPORTING ====================

-- View for promo code usage statistics
CREATE OR REPLACE VIEW "PromoCodeStats" AS
SELECT 
    pc.id,
    pc.code,
    pc.description,
    pc.discountType,
    pc.discountValue,
    pc.maxDiscountAmount,
    pc.minimumAmount,
    pc.validFrom,
    pc.validUntil,
    pc.usageLimit,
    pc.globalUsageLimit,
    pc.isActive,
    COUNT(pcu.id) as usageCount,
    pc.globalUsageLimit - COUNT(pcu.id) as remainingUses,
    CASE 
        WHEN pc.validUntil IS NULL THEN 'No Expiration'
        WHEN pc.validUntil < NOW() THEN 'Expired'
        WHEN pc.validFrom > NOW() THEN 'Not Yet Active'
        ELSE 'Active'
    END as status
FROM "PromoCode" pc
LEFT JOIN "PromoCodeUsage" pcu ON pc.id = pcu.promoCodeId
GROUP BY pc.id, pc.code, pc.description, pc.discountType, pc.discountValue, pc.maxDiscountAmount, pc.minimumAmount, pc.validFrom, pc.validUntil, pc.usageLimit, pc.globalUsageLimit, pc.isActive;

-- View for user promo code usage
CREATE OR REPLACE VIEW "UserPromoCodeUsage" AS
SELECT 
    u.id as userId,
    u.email,
    u.name,
    pc.code as promoCode,
    pc.description,
    pcu.usedAt,
    b.bookingRef,
    b.totalAmount,
    b.discountAmount
FROM "User" u
JOIN "PromoCodeUsage" pcu ON u.id = pcu.userId
JOIN "PromoCode" pc ON pcu.promoCodeId = pc.id
JOIN "Booking" b ON pcu.bookingId = b.id
ORDER BY pcu.usedAt DESC;

-- ==================== FUNCTIONS FOR AUTOMATIC UPDATES ====================

-- Function to automatically update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updatedAt updates
CREATE TRIGGER update_promocode_updated_at BEFORE UPDATE ON "PromoCode"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_updated_at BEFORE UPDATE ON "Booking"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_updated_at BEFORE UPDATE ON "Payment"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
