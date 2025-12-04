-- Fix Admin User Metadata for RLS
-- This script updates the 'user_metadata' of all users who are marked as 'ADMIN' in the public."User" table.
-- It sets the 'role' metadata to 'admin', which is required by the Storage RLS policies.

UPDATE auth.users au
SET raw_user_meta_data = jsonb_set(
  COALESCE(au.raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
FROM public."User" pu
WHERE au.id = pu.id AND pu."memberType" = 'ADMIN';
