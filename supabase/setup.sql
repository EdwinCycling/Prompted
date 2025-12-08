-- Extensions
create extension if not exists pgcrypto;

-- Prompts table
create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure updated_at exists on existing installations
alter table public.prompts
  add column if not exists updated_at timestamptz not null default now();

-- Optional index for feed ordering
create index if not exists prompts_created_at_idx on public.prompts (created_at);
create index if not exists prompts_updated_at_idx on public.prompts (updated_at);

-- Row Level Security for prompts
alter table public.prompts enable row level security;

-- Read: allow authenticated users to read the feed
drop policy if exists "Allow read to authenticated" on public.prompts;
create policy "Allow read to authenticated" on public.prompts
for select to authenticated
using (true);

-- Insert: only allow users to insert their own rows
drop policy if exists "User can insert own prompt" on public.prompts;
create policy "User can insert own prompt" on public.prompts
for insert to authenticated
with check (auth.uid() = user_id);

-- Update: only row owner can update
drop policy if exists "User can update own prompt" on public.prompts;
create policy "User can update own prompt" on public.prompts
for update to authenticated
using (auth.uid() = user_id);

-- Delete: only row owner can delete
drop policy if exists "User can delete own prompt" on public.prompts;
create policy "User can delete own prompt" on public.prompts
for delete to authenticated
using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prompts_set_updated_at on public.prompts;
create trigger trg_prompts_set_updated_at
before update on public.prompts
for each row execute function public.set_updated_at();

do $$
begin
  begin
    insert into storage.buckets (name, public, file_size_limit, allowed_mime_types)
    select 'prompt-images', true, 10485760, ARRAY['image/jpeg','image/png','image/webp']::text[]
    where not exists (select 1 from storage.buckets where name = 'prompt-images');
  exception when undefined_column then
    begin
      insert into storage.buckets (id, name, public)
      select 'prompt-images', 'prompt-images', true
      where not exists (select 1 from storage.buckets where name = 'prompt-images');
    exception when undefined_table then
      null;
    end;
  end;
end $$;

do $$
begin
  begin
    execute 'alter table storage.objects enable row level security';
  exception
    when insufficient_privilege then null;
    when undefined_table then null;
  end;
end $$;

do $$
begin
  begin
    execute 'drop policy if exists "Public read prompt-images" on storage.objects';
    execute 'create policy "Public read prompt-images" on storage.objects for select using (bucket_id = ''prompt-images'')';
  exception
    when insufficient_privilege then null;
    when undefined_table then null;
  end;
end $$;

do $$
begin
  begin
    execute 'drop policy if exists "Authenticated uploads to own folder" on storage.objects';
    execute 'create policy "Authenticated uploads to own folder" on storage.objects for insert to authenticated with check (bucket_id = ''prompt-images'' and (storage.foldername(name))[1] = (select auth.uid()::text))';
  exception
    when insufficient_privilege then null;
    when undefined_table then null;
  end;
end $$;

do $$
begin
  begin
    execute 'drop policy if exists "Owners can update their objects" on storage.objects';
    execute 'create policy "Owners can update their objects" on storage.objects for update to authenticated using (bucket_id = ''prompt-images'' and owner_id = (select auth.uid()::text)) with check (bucket_id = ''prompt-images'' and owner_id = (select auth.uid()::text))';
  exception
    when insufficient_privilege then null;
    when undefined_table then null;
  end;
end $$;

do $$
begin
  begin
    execute 'drop policy if exists "Owners can delete their objects" on storage.objects';
    execute 'create policy "Owners can delete their objects" on storage.objects for delete to authenticated using (bucket_id = ''prompt-images'' and owner_id = (select auth.uid()::text))';
  exception
    when insufficient_privilege then null;
    when undefined_table then null;
  end;
end $$;

-- Done
create table if not exists public.prompt_images (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);

alter table public.prompt_images enable row level security;

drop policy if exists "PromptImages read own" on public.prompt_images;
create policy "PromptImages read own" on public.prompt_images
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "PromptImages insert own" on public.prompt_images;
create policy "PromptImages insert own" on public.prompt_images
for insert to authenticated
with check (
  auth.uid() = user_id
  and (select user_id from public.prompts where id = prompt_id) = auth.uid()
);

drop policy if exists "PromptImages delete own" on public.prompt_images;
create policy "PromptImages delete own" on public.prompt_images
for delete to authenticated
using (auth.uid() = user_id);

create index if not exists prompt_images_prompt_idx on public.prompt_images (prompt_id);
-- Tags table (per-user)
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table public.tags enable row level security;

drop policy if exists "Tags read own" on public.tags;
create policy "Tags read own" on public.tags
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Tags insert own" on public.tags;
create policy "Tags insert own" on public.tags
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Tags update own" on public.tags;
create policy "Tags update own" on public.tags
for update to authenticated
using (auth.uid() = user_id);

drop policy if exists "Tags delete own" on public.tags;
create policy "Tags delete own" on public.tags
for delete to authenticated
using (auth.uid() = user_id);

-- Prompt-Tag junction
create table if not exists public.prompt_tags (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (prompt_id, tag_id)
);

alter table public.prompt_tags enable row level security;

drop policy if exists "PromptTags read own" on public.prompt_tags;
create policy "PromptTags read own" on public.prompt_tags
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "PromptTags insert own" on public.prompt_tags;
create policy "PromptTags insert own" on public.prompt_tags
for insert to authenticated
with check (
  auth.uid() = user_id
  and (select user_id from public.prompts where id = prompt_id) = auth.uid()
  and (select user_id from public.tags where id = tag_id) = auth.uid()
);

drop policy if exists "PromptTags delete own" on public.prompt_tags;
create policy "PromptTags delete own" on public.prompt_tags
for delete to authenticated
using (auth.uid() = user_id);

create index if not exists prompt_tags_prompt_idx on public.prompt_tags (prompt_id);
create index if not exists prompt_tags_tag_idx on public.prompt_tags (tag_id);
