// Catégories de l'annuaire et leurs champs.
// Types de champ : text, textarea, date, phone, select, address, institution, genre, niss.
export const CATEGORIES = [
  { v:'beneficiaire', l:'Bénéficiaires', icon:'🧑', titre:'Bénéficiaire', fields:[
    { k:'prenom', l:'Prénom', t:'text' },
    { k:'nom', l:'Nom', t:'text' },
    { k:'genre', l:'Genre', t:'genre' },
    { k:'date_naissance', l:'Date de naissance', t:'date' },
    { k:'niss', l:'Numéro national', t:'niss' },
    { k:'tel_gsm', l:'GSM', t:'phone' },
    { k:'tel_fixe', l:'Fixe', t:'phone' },
    { k:'email', l:'E-mail', t:'text' },
    { k:'adresse', l:'Adresse légale', t:'address' },
    { k:'notes', l:'Notes', t:'textarea' },
  ]},
  { v:'medical', l:'Contacts médicaux', icon:'⚕️', titre:'Contact médical', fields:[
    { k:'type_medical', l:'Type', t:'select', options:['','Médecin','Infirmier','Kiné','Psychologue','Autre'] },
    { k:'prenom', l:'Prénom', t:'text' },
    { k:'nom', l:'Nom', t:'text' },
    { k:'specialite', l:'Spécialité', t:'text' },
    { k:'inami', l:'N° INAMI', t:'text' },
    { k:'telephone', l:'Téléphone', t:'phone' },
    { k:'email', l:'E-mail', t:'text' },
    { k:'institution_id', l:'Institution', t:'institution' },
    { k:'notes', l:'Notes', t:'textarea' },
  ]},
  { v:'institution', l:'Institutions médicales', icon:'🏥', titre:'Institution médicale', fields:[
    { k:'nom', l:'Nom', t:'text' },
    { k:'type_institution', l:'Type', t:'select', options:['','Hôpital','MR / MRS','Clinique','Centre de soins','Domicile','Autre'] },
    { k:'telephone', l:'Numéro général', t:'phone' },
    { k:'email', l:'E-mail général', t:'text' },
    { k:'adresse', l:'Adresse', t:'address' },
    { k:'notes', l:'Notes', t:'textarea' },
  ]},
  { v:'externe_souhait', l:'Contacts externes (souhaits)', icon:'🎁', titre:'Contact externe', fields:[
    { k:'nom', l:'Nom / organisation', t:'text' },
    { k:'domaine', l:'Domaine', t:'text' },
    { k:'contact_personne', l:'Personne de contact', t:'text' },
    { k:'telephone', l:'Numéro général', t:'phone' },
    { k:'email', l:'E-mail général', t:'text' },
    { k:'adresse', l:'Adresse', t:'address' },
    { k:'notes', l:'Notes', t:'textarea' },
  ]},
  { v:'partenaire_logistique', l:'Partenaires logistiques', icon:'🚚', titre:'Partenaire logistique', fields:[
    { k:'nom', l:'Nom / société', t:'text' },
    { k:'type_partenaire', l:'Type', t:'text' },
    { k:'contact_personne', l:'Personne de contact', t:'text' },
    { k:'telephone', l:'Téléphone', t:'phone' },
    { k:'email', l:'E-mail', t:'text' },
    { k:'adresse', l:'Adresse', t:'address' },
    { k:'notes', l:'Notes', t:'textarea' },
  ]},
]

export const POINT_CONTACT_FIELDS = [
  { k:'prenom', l:'Prénom', t:'text' },
  { k:'nom', l:'Nom', t:'text' },
  { k:'fonction', l:'Fonction', t:'text', placeholder: 'Infirmier chef, assistante sociale…' },
  { k:'tel_gsm', l:'GSM', t:'phone' },
  { k:'tel_fixe', l:'Fixe', t:'phone' },
  { k:'email', l:'E-mail', t:'text' },
]

export const ACCOMPAGNANT_FIELDS = [
  { k:'prenom', l:'Prénom', t:'text' },
  { k:'nom', l:'Nom', t:'text' },
  { k:'lien', l:"Lien d'affiliation", t:'text' },
  { k:'date_naissance', l:'Date de naissance', t:'date' },
  { k:'niss', l:'Numéro national', t:'niss' },
  { k:'tel_gsm', l:'GSM', t:'phone' },
  { k:'tel_fixe', l:'Fixe', t:'phone' },
  { k:'adresse', l:'Adresse légale', t:'address' },
]

export const GENRES = [
  { v:'femme', l:'Femme', color:'#E6007E', bg:'#FDE8F3' },
  { v:'homme', l:'Homme', color:'#185FA5', bg:'#E6F1FB' },
  { v:'autre',  l:'Autre',  color:'#6B4E9B', bg:'#F0EAF8' },
]

export const catInfo = v => CATEGORIES.find(c => c.v === v)

export function emptyToNull(v) {
  if (v == null) return null
  if (typeof v === 'string') { const t = v.trim(); return t ? t : null }
  return v
}

export function normaliserNiss(v) {
  const d = String(v || '').replace(/\D/g, '')
  return d || ''
}

export function formaterNiss(v) {
  const d = normaliserNiss(v)
  if (d.length !== 11) return (v || '').trim()
  return `${d.slice(0,2)}.${d.slice(2,4)}.${d.slice(4,6)}-${d.slice(6,9)}.${d.slice(9)}`
}

export function fmtTelephones(r, d = {}) {
  const gsm = r.tel_gsm || d.tel_gsm
  const fixe = r.tel_fixe || d.tel_fixe
  const tel = r.telephone || d.telephone
  const parts = []
  if (gsm) parts.push(`GSM ${gsm}`)
  if (fixe) parts.push(`Fixe ${fixe}`)
  if (!gsm && !fixe && tel) parts.push(tel)
  return parts.join(' · ')
}

export function libelleGenre(v) {
  return GENRES.find(g => g.v === v)?.l || ''
}
