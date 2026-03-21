ALTER TABLE public.registration_requests
  ADD COLUMN matricule_fiscal text DEFAULT NULL,
  ADD COLUMN registre_commerce text DEFAULT NULL,
  ADD COLUMN code_tva text DEFAULT NULL,
  ADD COLUMN code_categorie text DEFAULT NULL,
  ADD COLUMN secteur_activite text DEFAULT NULL;