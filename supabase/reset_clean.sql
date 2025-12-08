-- ==============================================================================
-- RESET SCRIPT: DELETE ALL PROMPTS AND IMAGES
-- Run this in Supabase SQL Editor to wipe all user data for clean testing.
-- ==============================================================================

begin;

-- 1. Delete all files from Storage (Metadata + Actual Files via Trigger)
-- Note: Supabase storage uses the 'storage.objects' table. Deleting rows here
-- triggers the actual file removal from the backend.
delete from storage.objects
where bucket_id = 'prompt-images';

-- 2. Delete all rows from prompt_images (if table exists)
delete from public.prompt_images;

-- 3. Delete all rows from prompt_tags (if table exists)
delete from public.prompt_tags;

-- 4. Delete all prompts
-- (If you have Cascade delete set up, step 2 & 3 might happen automatically,
-- but explicit delete is safer for a full wipe script)
delete from public.prompts;

-- Optional: Delete tags if you want a TRULY clean slate
-- delete from public.tags;

commit;

-- Verification: Check if everything is empty
select 'storage.objects' as table_name, count(*) from storage.objects where bucket_id = 'prompt-images'
union all
select 'prompts', count(*) from public.prompts
union all
select 'prompt_images', count(*) from public.prompt_images;
