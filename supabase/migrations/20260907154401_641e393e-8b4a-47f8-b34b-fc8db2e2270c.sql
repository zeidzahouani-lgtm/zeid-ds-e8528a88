ALTER TABLE public.media ADD COLUMN IF NOT EXISTS file_size bigint;

UPDATE public.media m
SET file_size = (o.metadata->>'size')::bigint
FROM storage.objects o
WHERE o.bucket_id = 'media'
  AND m.file_size IS NULL
  AND m.url LIKE '%' || o.name;