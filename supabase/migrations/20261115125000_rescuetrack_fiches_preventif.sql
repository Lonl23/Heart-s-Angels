-- RescueTrack : une fiche patient ne s'attache qu'à un préventif déjà présent.
-- Aucune création, modification ou suppression de préventif.

ALTER TABLE public.fiches_patient_dps
  ADD COLUMN contenu jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.fiches_patient_dps
  ADD CONSTRAINT fiches_patient_dps_contenu CHECK (
    jsonb_typeof(contenu) = 'object'
    AND octet_length(contenu::text) < 16000
  );

CREATE OR REPLACE FUNCTION public.activite_est_preventif(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce((
    SELECT a.type = 'preventif'
        OR a.dispositif IS NOT NULL
        OR cardinality(a.dispositifs) > 0
    FROM public.activites_secours a
    WHERE a.id = p_id
  ), false);
$function$;

REVOKE ALL ON FUNCTION public.activite_est_preventif(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activite_est_preventif(uuid) TO authenticated, service_role;

ALTER POLICY fiches_patient_dps_insert ON public.fiches_patient_dps
  WITH CHECK (
    is_staff()
    AND (created_by IS NULL OR created_by = auth.uid())
    AND public.activite_est_preventif(activite_id)
  );

ALTER POLICY fiches_patient_dps_update ON public.fiches_patient_dps
  USING (is_staff() AND public.activite_est_preventif(activite_id))
  WITH CHECK (is_staff() AND public.activite_est_preventif(activite_id));

CREATE OR REPLACE FUNCTION public.enregistrer_fiche_patient_dps(
  p_activite_id uuid,
  p_contenu jsonb DEFAULT '{}'::jsonb,
  p_id uuid DEFAULT NULL,
  p_nom text DEFAULT NULL,
  p_prenom text DEFAULT NULL,
  p_date_naissance date DEFAULT NULL,
  p_sexe text DEFAULT NULL,
  p_motifs text DEFAULT NULL,
  p_heure_prise_en_charge timestamptz DEFAULT NULL,
  p_heure_fin timestamptz DEFAULT NULL,
  p_orientation text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contenu jsonb;
  v_nom text;
  v_prenom text;
  v_sexe text;
  v_motifs text;
  v_orientation text;
  v_notes text;
  v_inconnue boolean := false;
  v_triage text;
  v_pathologie text;
  v_disp text;
  v_num integer;
  v_existing public.fiches_patient_dps%ROWTYPE;
  v_row jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'Accès réservé au personnel' USING ERRCODE = '42501';
  END IF;

  IF p_activite_id IS NULL OR NOT public.activite_est_preventif(p_activite_id) THEN
    RAISE EXCEPTION 'RescueTrack n''enregistre des patients que sur un préventif existant'
      USING ERRCODE = '23514';
  END IF;

  v_contenu := coalesce(p_contenu, '{}'::jsonb);
  IF jsonb_typeof(v_contenu) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Le contenu de la fiche doit être un objet JSON' USING ERRCODE = '22P02';
  END IF;
  IF octet_length(v_contenu::text) >= 16000 THEN
    RAISE EXCEPTION 'La fiche dépasse la taille autorisée' USING ERRCODE = '22023';
  END IF;

  IF v_contenu ? 'identite_inconnue' THEN
    IF jsonb_typeof(v_contenu->'identite_inconnue') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'identite_inconnue doit être un booléen' USING ERRCODE = '22P02';
    END IF;
    v_inconnue := (v_contenu->>'identite_inconnue')::boolean;
  END IF;

  IF v_contenu ? 'triage' AND jsonb_typeof(v_contenu->'triage') IS DISTINCT FROM 'null' THEN
    IF jsonb_typeof(v_contenu->'triage') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Triage non reconnu' USING ERRCODE = '23514';
    END IF;
    v_triage := nullif(btrim(v_contenu->>'triage'), '');
    IF v_triage IS NOT NULL AND v_triage NOT IN ('U1', 'U2', 'U3H', 'U3NH', 'IMPLIQUE', 'DCD') THEN
      RAISE EXCEPTION 'Triage non reconnu' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_contenu ? 'pathologie' AND jsonb_typeof(v_contenu->'pathologie') IS DISTINCT FROM 'null' THEN
    IF jsonb_typeof(v_contenu->'pathologie') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Pathologie non reconnue' USING ERRCODE = '23514';
    END IF;
    v_pathologie := nullif(btrim(v_contenu->>'pathologie'), '');
    IF v_pathologie IS NOT NULL AND v_pathologie NOT IN (
      'Intox', 'Trauma', 'Malaise', 'Brûlure', 'Cardio', 'Respiratoire', 'Neurologique', 'Autre'
    ) THEN
      RAISE EXCEPTION 'Pathologie non reconnue' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_contenu ? 'dispositif' AND jsonb_typeof(v_contenu->'dispositif') IS DISTINCT FROM 'null' THEN
    IF jsonb_typeof(v_contenu->'dispositif') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Dispositif non reconnu' USING ERRCODE = '23514';
    END IF;
    v_disp := nullif(btrim(v_contenu->>'dispositif'), '');
    IF v_disp IS NOT NULL AND v_disp NOT IN (
      'paps', 'ps', 'echo', 'pma_cat2', 'pma_cat1', 'pma_cat0', 'ambu_112', 'ambu'
    ) THEN
      RAISE EXCEPTION 'Dispositif non reconnu' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_contenu ? 'dispositif_index' AND jsonb_typeof(v_contenu->'dispositif_index') IS DISTINCT FROM 'null' THEN
    IF jsonb_typeof(v_contenu->'dispositif_index') IS DISTINCT FROM 'number'
       OR (v_contenu->>'dispositif_index') !~ '^[0-9]+$'
       OR (v_contenu->>'dispositif_index')::int > 50 THEN
      RAISE EXCEPTION 'Dispositif invalide' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF char_length(coalesce(v_contenu->>'nationalite', '')) > 40
     OR char_length(coalesce(v_contenu->>'numero_national', '')) > 32
     OR char_length(coalesce(v_contenu->>'adresse', '')) > 240
     OR char_length(coalesce(v_contenu->>'cp', '')) > 12
     OR char_length(coalesce(v_contenu->>'localite', '')) > 120 THEN
    RAISE EXCEPTION 'La fiche dépasse la taille autorisée' USING ERRCODE = '22023';
  END IF;

  v_nom := nullif(btrim(coalesce(p_nom, '')), '');
  v_prenom := nullif(btrim(coalesce(p_prenom, '')), '');
  IF v_inconnue THEN
    v_nom := NULL;
    v_prenom := NULL;
  END IF;
  IF v_nom IS NOT NULL AND char_length(v_nom) > 120 THEN
    RAISE EXCEPTION 'Le nom dépasse 120 caractères' USING ERRCODE = '23514';
  END IF;
  IF v_prenom IS NOT NULL AND char_length(v_prenom) > 120 THEN
    RAISE EXCEPTION 'Le prénom dépasse 120 caractères' USING ERRCODE = '23514';
  END IF;

  v_sexe := nullif(btrim(coalesce(p_sexe, '')), '');
  IF v_sexe IS NOT NULL AND v_sexe NOT IN ('F', 'M', 'X', 'inconnu') THEN
    RAISE EXCEPTION 'Sexe non reconnu' USING ERRCODE = '23514';
  END IF;

  v_motifs := nullif(btrim(coalesce(p_motifs, '')), '');
  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  v_orientation := nullif(btrim(coalesce(p_orientation, '')), '');
  IF v_motifs IS NOT NULL AND char_length(v_motifs) > 4000 THEN
    RAISE EXCEPTION 'Le motif est trop long' USING ERRCODE = '23514';
  END IF;
  IF v_notes IS NOT NULL AND char_length(v_notes) > 8000 THEN
    RAISE EXCEPTION 'Les remarques sont trop longues' USING ERRCODE = '23514';
  END IF;
  IF v_orientation IS NOT NULL AND v_orientation NOT IN (
    'sur place', 'retour', 'conseil', 'évacuation', 'refus', 'autre'
  ) THEN
    RAISE EXCEPTION 'Orientation non reconnue' USING ERRCODE = '23514';
  END IF;

  IF p_heure_prise_en_charge IS NOT NULL
     AND p_heure_fin IS NOT NULL
     AND p_heure_fin < p_heure_prise_en_charge THEN
    RAISE EXCEPTION 'L''heure de fin précède l''heure de début' USING ERRCODE = '23514';
  END IF;

  IF p_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('rescuetrack.fiches_patient_dps:' || p_activite_id::text, 0));
    SELECT coalesce(max(numero_local), 0) + 1
      INTO v_num
    FROM public.fiches_patient_dps
    WHERE activite_id = p_activite_id;

    INSERT INTO public.fiches_patient_dps AS f (
      activite_id, numero_local, nom, prenom, date_naissance, sexe, motifs,
      heure_prise_en_charge, heure_fin, orientation, notes, contenu, created_by
    ) VALUES (
      p_activite_id, v_num, v_nom, v_prenom, p_date_naissance, v_sexe, v_motifs,
      p_heure_prise_en_charge, p_heure_fin, v_orientation, v_notes, v_contenu, auth.uid()
    )
    RETURNING to_jsonb(f.*) INTO v_row;
  ELSE
    SELECT * INTO v_existing
    FROM public.fiches_patient_dps
    WHERE id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fiche introuvable' USING ERRCODE = 'P0002';
    END IF;

    IF v_existing.activite_id IS DISTINCT FROM p_activite_id THEN
      RAISE EXCEPTION 'Une fiche ne peut pas être déplacée vers un autre préventif'
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.fiches_patient_dps AS f SET
      nom = v_nom,
      prenom = v_prenom,
      date_naissance = p_date_naissance,
      sexe = v_sexe,
      motifs = v_motifs,
      heure_prise_en_charge = p_heure_prise_en_charge,
      heure_fin = p_heure_fin,
      orientation = v_orientation,
      notes = v_notes,
      contenu = v_contenu,
      updated_at = now()
    WHERE f.id = p_id
    RETURNING to_jsonb(f.*) INTO v_row;
  END IF;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.enregistrer_fiche_patient_dps(
  uuid, jsonb, uuid, text, text, date, text, text, timestamptz, timestamptz, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.enregistrer_fiche_patient_dps(
  uuid, jsonb, uuid, text, text, date, text, text, timestamptz, timestamptz, text, text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.enregistrer_fiche_patient_dps(
  uuid, jsonb, uuid, text, text, date, text, text, timestamptz, timestamptz, text, text
) IS 'Enregistre une fiche patient sur un préventif existant. Ne crée pas de dispositif.';
