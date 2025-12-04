-- Add Admin Refund Fee setting to PaymentSettings table
-- Fixed: Using correct column name 'description' instead of 'settingDescription'
INSERT INTO "PaymentSettings" (
  "settingKey",
  "settingValue",
  "description",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  'ADMIN_REFUND_FEE',
  '2.00',
  'Admin fee deducted from all refund requests (in SGD)',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("settingKey") DO UPDATE
SET 
  "settingValue" = EXCLUDED."settingValue",
  "description" = EXCLUDED."description",
  "updatedAt" = NOW();

-- Add comment
COMMENT ON COLUMN "PaymentSettings"."settingKey" IS 'Unique key for the setting (e.g., PAYNOW_TRANSACTION_FEE, CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE, ADMIN_REFUND_FEE)';
