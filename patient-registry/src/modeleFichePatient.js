/** Modèle de fiche patient DPS (appli liée). Aligné sur public.fiches_patient_dps. */

export const FICHE_PATIENT_VIDE = {
  activite_id: null,
  numero_local: null,
  nom: '',
  prenom: '',
  date_naissance: '',
  sexe: '',
  motifs: '',
  heure_prise_en_charge: '',
  heure_fin: '',
  orientation: '',
  notes: '',
}

export const SEXES = [
  { v: 'F', l: 'F' },
  { v: 'M', l: 'M' },
  { v: 'X', l: 'X' },
  { v: 'inconnu', l: 'Inconnu' },
]

export const ORIENTATIONS = [
  { v: 'laisse_sur_place', l: 'Laissé sur place' },
  { v: 'secours_publics', l: 'Remis aux secours publics' },
  { v: 'transport', l: 'Transport' },
  { v: 'refus', l: 'Refus de soins' },
  { v: 'autre', l: 'Autre' },
]
