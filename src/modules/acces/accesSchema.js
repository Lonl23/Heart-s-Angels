// Accès que l’on peut encore autoriser ou non par la matrice.
// Mes missions, défraiements et disponibilités sont ouverts à tout le personnel
// (sauf partenaires) : ils n’apparaissent pas ici.
export const ACCES = [
  { v:'souhaits', l:'Souhaits' },
  { v:'stock',    l:'Stock' },
  { v:'annuaire', l:'Annuaire' },
]

/** Responsable et adjoint d’une même catégorie = une équipe dans la matrice. */
export const EQUIPES_ACCES = [
  { v:'presidence',    l:'Présidence',                 roles:['president','vice_president'] },
  { v:'tresorerie',    l:'Équipe trésorerie',          roles:['tresorier','tresorier_adjoint'] },
  { v:'logistique',    l:'Équipe logistique',          roles:['resp_logistique','resp_logistique_adjoint'] },
  { v:'transport',     l:'Équipe transport',           roles:['coord_transport','coord_transport_adjoint'] },
  { v:'medical',       l:'Équipe médicale',            roles:['coord_medical','coord_medical_adjoint','coordinateur_medical'] },
  { v:'recolte',       l:'Récolteurs de souhait',      roles:['recolteur_souhait'] },
  { v:'benevoles',     l:'Équipe bénévoles',           roles:['coord_benevoles','coord_benevoles_adjoint'] },
  { v:'rp',            l:'Équipe relations publiques', roles:['relations_publiques','relations_publiques_adjoint'] },
  { v:'informatique',  l:'Équipe informatique',        roles:['resp_informatique','resp_informatique_adjoint'] },
  { v:'admin_asbl',    l:"Administrateur de l'ASBL",   roles:['administrateur_asbl'] },
  { v:'volontaire',    l:'Simple volontaire',          roles:['simple_volontaire'] },
]
