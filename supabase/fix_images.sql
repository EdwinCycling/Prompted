-- Normalize image_url to storage path and align prompt_images
-- Run this in Supabase SQL Editor

-- 1) Convert public URLs in prompts.image_url to storage paths
update public.prompts
set image_url = regexp_replace(image_url, '^https?://[^/]*/storage/v1/object/public/prompt-images/', '')
where image_url like 'http%/storage/v1/object/public/prompt-images/%';

-- 2) For prompts with a path in image_url but missing prompt_images rows, insert one
insert into public.prompt_images (prompt_id, user_id, path, image_url)
select p.id, p.user_id, p.image_url, p.image_url
from public.prompts p
left join public.prompt_images pi on pi.prompt_id = p.id
where p.image_url is not null
  and pi.prompt_id is null;

-- 3) Remove duplicate prompt_images rows not matching the prompt path (DO NOT delete storage objects)
delete from public.prompt_images pi
using public.prompts p
where pi.prompt_id = p.id
  and p.image_url is not null
  and pi.path <> p.image_url;

-- 4) Optional audit: list prompts whose image file is missing in storage
select p.id as prompt_id, p.image_url as path
from public.prompts p
left join storage.objects o
  on o.bucket_id = 'prompt-images'
 and o.name = p.image_url
where p.image_url is not null
  and o.id is null;
