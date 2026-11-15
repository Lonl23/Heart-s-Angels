-- Le stockage parallèle (rescuetrack_fiches / rescuetrack_logbook) était vide.
-- Les fiches patients restent dans public.fiches_patient_dps.

DROP TABLE IF EXISTS public.rescuetrack_logbook;
DROP TABLE IF EXISTS public.rescuetrack_fiches;
DROP FUNCTION IF EXISTS public.rescuetrack_enregistrer_fiche(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.rescuetrack_code_province(text);
DROP FUNCTION IF EXISTS public.rescuetrack_fiche_garde();
