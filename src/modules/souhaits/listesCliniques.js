export const DEGLUTITION = ['Normale', 'Épaissie', 'Paille', 'À jeun strict']
export const ALIMENTATION = ['Normale', 'Découpée', 'Mixée', 'Diabétique', 'Sonde gastrique', 'Parentérale', 'Bouton de gastrostomie']
export const CONTINENCE_URINAIRE = ['Autonome', 'Aide', 'Protection', 'Sonde urinaire', 'Cystocath', 'Stomie', 'Étui pénien']
export const CONTINENCE_FECALE = ['Autonome', 'Aide', 'Protection', 'Stomie']
export const VOIES_ACCES = ['Périphérique', 'Voie centrale', 'Pic-line', 'Mid-line', 'Port-à-cath', 'S/C']
export const MOBILISATIONS = ['Autonome', 'Aide', 'Tient debout', 'Fauteuil', 'Lit', 'Lit strict', 'Quelques pas']
export const COMMUNICATION = ['Normale', 'Faible', 'Confuse', 'Écrite', 'Occulaire', 'Autre']
export const INTERFACES_O2_DEFAUT = ['Lunettes', 'Masque 60%', 'Masque 100%']

/** Stades de priorité du souhait (préparation). Ancien 5 → ramené à 4. */
export const PRIORITES_SOUHAIT = [
  { v: 1, l: '1 · Basse' },
  { v: 2, l: '2 · Normale' },
  { v: 3, l: '3 · Haute' },
  { v: 4, l: '4 · Urgente' },
]

export function normaliserPrioriteSouhait(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1) return 2
  if (n >= 5) return 4 // ancien « Critique »
  return Math.min(4, Math.round(n))
}

export function lblPrioriteSouhait(v) {
  const n = normaliserPrioriteSouhait(v)
  return PRIORITES_SOUHAIT.find(p => p.v === n)?.l || String(n)
}

export const PATHOLOGIES = [
  'Cancérologie', 'Neurologie', 'Cardiologie', 'Pneumologie',
  'Soins palliatifs', 'Pédiatrie', 'Handicap', 'Gériatrie', 'Psychiatrie',
]
export const ACTIVITES_SOUHAIT = [
  'Mer', 'Zoo', 'Parc', 'Concert', 'Restaurant', 'Rencontre', 'Sport', 'Voyage', 'À domicile', 'Cérémonie',
]

export const TYPES_MEDECIN = [
  { v: 'traitant', l: 'Médecin traitant' },
  { v: 'specialiste', l: 'Spécialiste' },
  { v: 'garde', l: 'Médecin de garde' },
]

export const CHAMPS_CLINIQUES = [
  { k: 'deglutition', l: 'Déglutition', options: DEGLUTITION },
  { k: 'alimentation', l: 'Alimentation', options: ALIMENTATION },
  { k: 'continence_urinaire', l: 'Continence urinaire', options: CONTINENCE_URINAIRE },
  { k: 'continence_fecale', l: 'Continence fécale', options: CONTINENCE_FECALE },
  { k: 'voie_acces', l: "Voie d'accès", options: VOIES_ACCES },
  { k: 'mobilisations', l: 'Mobilisations', options: MOBILISATIONS },
  { k: 'communication', l: 'Communication', options: COMMUNICATION },
]

export function commeListe(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean)
  if (v == null || v === '') return []
  return String(v).split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
}

export function libelleMedecin(v) {
  return TYPES_MEDECIN.find(t => t.v === v)?.l || ''
}
