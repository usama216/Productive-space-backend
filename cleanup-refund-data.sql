-- Refund System Data Cleanup Script
-- This script clears all refund-related data for testing purposes

-- 1. Clear credit usage records
DELETE FROM creditusage;

-- 2. Clear user credits
DELETE FROM usercredits;

-- 3. Clear refund transactions
DELETE FROM refundtransactions;

-- 4. Reset booking refund status to NONE
UPDATE "Booking" SET 
    refundstatus = 'NONE',
    refundrequestedat = NULL,
    refundapprovedat = NULL,
    refundapprovedby = NULL,
    refundreason = NULL;

-- 5. Show cleanup summary
SELECT 
    'Credit Usage Records' as table_name, 
    COUNT(*) as remaining_records 
FROM creditusage
UNION ALL
SELECT 
    'User Credits' as table_name, 
    COUNT(*) as remaining_records 
FROM usercredits
UNION ALL
SELECT 
    'Refund Transactions' as table_name, 
    COUNT(*) as remaining_records 
FROM refundtransactions
UNION ALL
SELECT 
    'Bookings with Refund Status' as table_name, 
    COUNT(*) as remaining_records 
FROM "Booking" 
WHERE refundstatus != 'NONE';

-- Success message
SELECT 'Refund data cleanup completed successfully!' as status;
