
ALTER TABLE public.contents 
ADD COLUMN IF NOT EXISTS confirmation_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
ADD COLUMN IF NOT EXISTS sender_email text;
