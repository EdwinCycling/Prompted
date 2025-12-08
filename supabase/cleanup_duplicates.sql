-- Remove duplicate prompt_images rows: keep the one referenced by prompts.image_url
-- Run in Supabase SQL editor

begin;

delete from public.prompt_images pi
using public.prompts p
where pi.prompt_id = p.id
  and p.image_url is not null
  and pi.image_url <> p.image_url;

commit;

-- Optional: if you also want to clear orphaned storage objects later,
-- list candidates with:
-- select o.* from storage.objects o
-- left join public.prompt_images pi on pi.path = o.name and pi.image_url = o.name
-- where o.bucket_id = 'prompt-images' and pi.prompt_id is null;
