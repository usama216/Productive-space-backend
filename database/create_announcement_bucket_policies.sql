-- Create the announcements bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (usually enabled by default, so we skip explicit enable to avoid permission errors)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow Public Read Access
-- Everyone (anon and authenticated) can view files in the announcements bucket
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'announcements' );

-- Policy 2: Allow Admin Upload (Insert)
-- Only authenticated users with role 'admin' in metadata can upload
CREATE POLICY "Admin Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'announcements' 
  AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Policy 3: Allow Admin Update
-- Only authenticated users with role 'admin' in metadata can update
CREATE POLICY "Admin Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'announcements' 
  AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Policy 4: Allow Admin Delete
-- Only authenticated users with role 'admin' in metadata can delete
CREATE POLICY "Admin Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'announcements' 
  AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
