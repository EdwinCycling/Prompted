-- Try to create the 'prompt-images' bucket across multiple Supabase versions
do $$
begin
  -- Attempt with full signature (name text, public boolean, file_size_limit bigint, allowed_mime_types text[])
  begin
    perform storage.create_bucket('prompt-images'::text, true, 10485760::bigint, ARRAY['image/jpeg','image/png','image/webp']::text[]);
  exception
    when undefined_function then
      -- Fallback: attempt minimal signature (name text, public boolean)
      begin
        perform storage.create_bucket('prompt-images'::text, true);
      exception
        when undefined_function then
          -- Function is unavailable in this project; create the bucket via Dashboard or client API
          null;
      end;
  end;
end $$;

-- If both attempts no-op, create the bucket in Supabase Dashboard → Storage → New bucket "prompt-images" (Public)
