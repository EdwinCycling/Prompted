-- ==============================================================================
-- SECURITY & RLS POLICIES
-- Run dit script in de Supabase SQL Editor om je app te beveiligen voor productie.
-- ==============================================================================

-- 1. TAGS TABEL BEVEILIGING
-- Zorg dat RLS aan staat
alter table public.tags enable row level security;

-- Iedereen mag tags lezen (nodig voor de feed en filters)
drop policy if exists "Read tags" on public.tags;
create policy "Read tags" on public.tags 
  for select to authenticated 
  using (true);

-- Alleen de eigenaar mag tags aanmaken
drop policy if exists "Insert tags" on public.tags;
create policy "Insert tags" on public.tags 
  for insert to authenticated 
  with check (auth.uid() = user_id);

-- Alleen de eigenaar mag tags bewerken
drop policy if exists "Update tags" on public.tags;
create policy "Update tags" on public.tags 
  for update to authenticated 
  using (auth.uid() = user_id);

-- Alleen de eigenaar mag tags verwijderen
drop policy if exists "Delete tags" on public.tags;
create policy "Delete tags" on public.tags 
  for delete to authenticated 
  using (auth.uid() = user_id);


-- 2. PROMPT_TAGS (Koppeltabel) BEVEILIGING
alter table public.prompt_tags enable row level security;

-- Iedereen mag zien welke tags bij welke prompt horen
drop policy if exists "Read prompt_tags" on public.prompt_tags;
create policy "Read prompt_tags" on public.prompt_tags 
  for select to authenticated 
  using (true);

-- Je mag alleen een tag koppelen als jij de eigenaar bent van de PROMPT
-- (We checken of er een prompt bestaat met dit ID waar jij de user_id van bent)
drop policy if exists "Insert prompt_tags" on public.prompt_tags;
create policy "Insert prompt_tags" on public.prompt_tags 
  for insert to authenticated 
  with check (
    exists (
      select 1 from public.prompts 
      where id = prompt_id 
      and user_id = auth.uid()
    )
  );

-- Je mag alleen een koppeling verwijderen als jij de eigenaar bent van de PROMPT
drop policy if exists "Delete prompt_tags" on public.prompt_tags;
create policy "Delete prompt_tags" on public.prompt_tags 
  for delete to authenticated 
  using (
    exists (
      select 1 from public.prompts 
      where id = prompt_id 
      and user_id = auth.uid()
    )
  );


-- 3. PROMPT_IMAGES (Tabel) BEVEILIGING
-- (Als deze tabel bestaat)
do $$
begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'prompt_images') then
    execute 'alter table public.prompt_images enable row level security';
    
    execute 'drop policy if exists "Read prompt_images" on public.prompt_images';
    execute 'create policy "Read prompt_images" on public.prompt_images for select to authenticated using (true)';
    
    execute 'drop policy if exists "Insert prompt_images" on public.prompt_images';
    execute 'create policy "Insert prompt_images" on public.prompt_images for insert to authenticated with check (auth.uid() = user_id)';
    
    execute 'drop policy if exists "Delete prompt_images" on public.prompt_images';
    execute 'create policy "Delete prompt_images" on public.prompt_images for delete to authenticated using (auth.uid() = user_id)';
  end if;
end $$;


-- 4. STORAGE BUCKET BEVEILIGING (Afbeeldingen uploaden)
-- We staan uploads toe in de 'prompt-images' bucket, maar ALLEEN als het pad begint met jouw user_id.
-- Voorbeeld pad: "user_123/image.png" -> MAG. "user_999/image.png" -> MAG NIET.

drop policy if exists "Upload prompt images" on storage.objects;
create policy "Upload prompt images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'prompt-images' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Update prompt images" on storage.objects;
create policy "Update prompt images" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'prompt-images' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Delete prompt images" on storage.objects;
create policy "Delete prompt images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'prompt-images' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Zorg dat publiek lezen aan staat (was al zo, maar voor zekerheid)
drop policy if exists "Public read prompt images" on storage.objects;
drop policy if exists "Read prompt images authenticated" on storage.objects;
create policy "Read prompt images authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'prompt-images');
