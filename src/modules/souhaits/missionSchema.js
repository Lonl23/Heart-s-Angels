// Configuration de la feuille de mission (reproduit les écrans).
// Chaque groupe = un sous-onglet. Types de champ : text, textarea, toggle,
// number, date, datetime, time, select.

export const GROUPES = [
  { id:'administratif', label:'Administratif', fields:[
    { k:'registre_national', l:'Registre national', t:'text' },
    { k:'patient_adresse', l:'Adresse du domicile du patient', t:'address' },
    { k:'consentement', l:'Consentement', t:'toggle' },
    { k:'autorisation_photos', l:'Autorisation photos', t:'toggle' },
    { k:'priorite_elevee', l:'Priorité élevée', t:'toggle' },
    { k:'date_demande', l:'Date demande', t:'date' },
    { k:'origine', l:'Origine', t:'text' },
    { k:'date_rencontre', l:'Date rencontre', t:'datetime' },
    { k:'recolteur', l:'Récolteur de souhait', t:'text' },
    { k:'consignes_equipage', l:'Consignes pour l\'équipage (lues sur le terrain)', t:'textarea' },
  ]},
  { id:'base', label:'Base', fields:[
    { k:'base_nom', l:'Base', t:'text' },
    { k:'base_adresse', l:'Adresse de la base', t:'address' },
    { k:'rdv_base', l:'Heure de rendez-vous', t:'datetime' },
    { k:'depart_base', l:'Heure de départ', t:'datetime' },
  ]},
  { id:'prise_en_charge', label:'Prise en charge', fields:[
    { k:'pec_type', l:'Lieu de prise en charge', t:'select', options:['','Domicile du patient','Institution'] },
    { k:'pec_institution', l:'Nom de l\'institution', t:'text' },
    { k:'pec_adresse', l:'Adresse', t:'address' },
    { k:'pec_service', l:'Service', t:'text' },
    { k:'pec_etage', l:'Étage', t:'text' },
    { k:'pec_aile', l:'Aile / route', t:'text' },
    { k:'pec_chambre', l:'Chambre', t:'text' },
    { k:'arrivee_pec', l:'Heure de prise en charge souhaitée', t:'datetime' },
    { k:'depart_pec', l:'Heure de départ souhaitée', t:'datetime' },
    { k:'pec_precisions', l:'Précisions', t:'textarea' },
  ]},
  { id:'destination', label:'Destination', fields:[
    { k:'dest_adresse', l:'Adresse complète', t:'address' },
    { k:'dest_precisions', l:'Précisions destination', t:'textarea' },
    { k:'arrivee_destination', l:'Heure souhaitée sur place', t:'datetime' },
  ]},
  { id:'retour', label:'Retour', fields:[
    { k:'retour_type', l:'Type de retour', t:'select', options:['','Sur envie du patient','Patient attendu à une heure'] },
    { k:'retour_heure', l:'Heure attendue (si patient attendu)', t:'datetime' },
    { k:'retour_precisions', l:'Précisions retour / planning particulier', t:'textarea' },
  ]},
  { id:'medical', label:'Infos médicales', fields:[
    { k:'allergies', l:'Allergies', t:'textarea' },
    { k:'ne_pas_reanimer', l:'Ne pas réanimer', t:'toggle' },
    { k:'details_acharnement', l:'Détails acharnement', t:'textarea' },
    { k:'pathologies', l:'Pathologies', t:'textarea' },
    { k:'antecedents', l:'Antécédents', t:'textarea' },
    { k:'douleurs', l:'Douleurs', t:'textarea' },
    { k:'voie_acces', l:"Voie d'accès", t:'text' },
    { k:'mobilisations', l:'Mobilisations', t:'textarea' },
    { k:'communication', l:'Communication', t:'textarea' },
    { k:'deglutition', l:'Déglutition', t:'text' },
    { k:'alimentation', l:'Alimentation', t:'text' },
    { k:'continence_urinaire', l:'Continence urinaire', t:'text' },
    { k:'continence_fecale', l:'Continence fécale', t:'text' },
    { k:'precisions_continences', l:'Précisions continences', t:'textarea' },
    { k:'sep', l:'— Paramètres —', t:'sep' },
    { k:'cible_saturation_o2', l:'Cible saturation O2', t:'text' },
    { k:'debit_o2', l:'Débit O2 (L/min)', t:'text' },
    { k:'apport_o2', l:'Apport O2', t:'text' },
    { k:'cible_ta', l:'Cible TA', t:'text' },
    { k:'cible_fc', l:'Cible FC', t:'text' },
  ]},
]

// Rapport logistique : 4 checklists + valeurs
export const CHECKLISTS = {
  base: { titre:'Checklist Base', items:['GPS','Sac d\'intervention','Sac à dos','Sac confort','O2','Carte VISA + Essence','SN Requis','Dégâts véhicule ou pannes'] },
  pec: { titre:'Checklist PEC', items:['Consentement','Autorisation photos','Feuille de traitements','Traitements avec surplus sécurité','Protections, sondes et sachet à diurèse (SN)','Divers requis'] },
  retour_pec: { titre:'Checklist Retour PEC', items:['Traitements en surplus rendu','Divers patients rendu','Si institution, échange draps/matériel','Reprise matériels et sacs'] },
  retour_base: { titre:'Checklist Retour Base', items:['Plein du véhicule','Rangement matériel (cfr Checklist Base)','Remplacement matériel pris dans le véhicule','Remise en ordre et nettoyage véhicule','Linge sale dans sac de linge','Remise des clés et papiers','Dégâts ou pannes durant la mission'] },
}

export const O2_LIGNES = ['B10','B10','B5','B5','B2']
