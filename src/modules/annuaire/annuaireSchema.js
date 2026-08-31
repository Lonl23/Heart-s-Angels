// Catégories de l'annuaire et leurs champs.
// Types de champ : text, textarea, date, phone, select, address, institution.
export const CATEGORIES = [
  { v:'beneficiaire', l:'Bénéficiaires', icon:'🧑', titre:'Bénéficiaire', fields:[
    { k:'prenom', l:'Prénom', t:'text' },
    { k:'nom', l:'Nom', t:'text' },
    { k:'date_naissance', l:'Date de naissance', t:'date' },
    { k:'telephone', l:'Téléphone', t:'phone' },
    { k:'email', l:'E-mail', t:'text' },
    { k:'adresse', l:'Adresse', t:'address' },
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
    { k:'telephone', l:'Téléphone', t:'phone' },
    { k:'email', l:'E-mail', t:'text' },
    { k:'adresse', l:'Adresse', t:'address' },
    { k:'notes', l:'Notes', t:'textarea' },
  ]},
  { v:'externe_souhait', l:'Contacts externes (souhaits)', icon:'🎁', titre:'Contact externe', fields:[
    { k:'nom', l:'Nom / organisation', t:'text' },
    { k:'domaine', l:'Domaine', t:'text' },
    { k:'contact_personne', l:'Personne de contact', t:'text' },
    { k:'telephone', l:'Téléphone', t:'phone' },
    { k:'email', l:'E-mail', t:'text' },
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

export const ACCOMPAGNANT_FIELDS = [
  { k:'prenom', l:'Prénom', t:'text' },
  { k:'nom', l:'Nom', t:'text' },
  { k:'lien', l:'Lien / affiliation', t:'text' },
  { k:'telephone', l:'Téléphone', t:'phone' },
  { k:'email', l:'E-mail', t:'text' },
]

export const catInfo = v => CATEGORIES.find(c => c.v === v)
