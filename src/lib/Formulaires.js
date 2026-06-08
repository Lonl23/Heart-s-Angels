// src/lib/formulaires.js
// Catalogue des champs PRÉDÉFINIS de chaque formulaire public.
// Sert à la fois à l'app interne (configuration) et aux pages publiques (rendu).

export const FORMULAIRES = {
  contact: {
    titre: 'Formulaire de contact',
    table: 'contacts',
    champs: [
      { nom: 'nom',     label: 'Nom',       type: 'text',     defautActif: true,  defautRequis: true },
      { nom: 'prenom',  label: 'Prénom',    type: 'text',     defautActif: true,  defautRequis: true },
      { nom: 'email',   label: 'E-mail',    type: 'email',    defautActif: true,  defautRequis: true },
      { nom: 'telephone', label: 'Téléphone', type: 'tel',    defautActif: true,  defautRequis: false },
      { nom: 'sujet',   label: 'Sujet',     type: 'text',     defautActif: true,  defautRequis: false },
      { nom: 'message', label: 'Message',   type: 'textarea', defautActif: true,  defautRequis: true },
    ],
  },
  souhait: {
    titre: 'Demande de souhait',
    table: 'demandes_souhaits',
    champs: [
      { nom: 'patient_prenom',     label: 'Prénom du bénéficiaire', type: 'text',  defautActif: true, defautRequis: true },
      { nom: 'patient_nom',        label: 'Nom du bénéficiaire',    type: 'text',  defautActif: true, defautRequis: true },
      { nom: 'patient_ddn',        label: 'Date de naissance',      type: 'date',  defautActif: true, defautRequis: false },
      { nom: 'etablissement',      label: 'Établissement',          type: 'text',  defautActif: false, defautRequis: false },
      { nom: 'medecin_referent',   label: 'Médecin référent',       type: 'text',  defautActif: false, defautRequis: false },
      { nom: 'contact_prenom',     label: 'Prénom du contact',      type: 'text',  defautActif: true, defautRequis: true },
      { nom: 'contact_nom',        label: 'Nom du contact',         type: 'text',  defautActif: true, defautRequis: true },
      { nom: 'contact_relation',   label: 'Relation avec le bénéficiaire', type: 'text', defautActif: true, defautRequis: false },
      { nom: 'contact_email',      label: 'E-mail du contact',      type: 'email', defautActif: true, defautRequis: true },
      { nom: 'contact_telephone',  label: 'Téléphone du contact',   type: 'tel',   defautActif: true, defautRequis: false },
      { nom: 'souhait_description', label: 'Description du souhait', type: 'textarea', defautActif: true, defautRequis: true },
      { nom: 'souhait_lieu',       label: 'Lieu / Destination',     type: 'text',  defautActif: false, defautRequis: false },
      { nom: 'mobilite',           label: 'Mobilité',               type: 'text',  defautActif: false, defautRequis: false },
      { nom: 'equipement_medical', label: 'Équipement médical',     type: 'text',  defautActif: false, defautRequis: false },
      { nom: 'allergies',          label: 'Allergies',              type: 'text',  defautActif: false, defautRequis: false },
    ],
  },
  benevole: {
    titre: 'Candidature bénévole',
    table: 'candidatures_benevoles',
    champs: [
      { nom: 'nom',         label: 'Nom',                type: 'text',     defautActif: true, defautRequis: true },
      { nom: 'prenom',      label: 'Prénom',             type: 'text',     defautActif: true, defautRequis: true },
      { nom: 'email',       label: 'E-mail',             type: 'email',    defautActif: true, defautRequis: true },
      { nom: 'telephone',   label: 'Téléphone',          type: 'tel',      defautActif: true, defautRequis: true },
      { nom: 'ville',       label: 'Ville',              type: 'text',     defautActif: true, defautRequis: false },
      { nom: 'profession',  label: 'Profession',         type: 'text',     defautActif: true, defautRequis: false },
      { nom: 'competences', label: 'Compétences / qualifications', type: 'textarea', defautActif: true, defautRequis: false },
      { nom: 'motivation',  label: 'Motivation',         type: 'textarea', defautActif: true, defautRequis: true },
      { nom: 'disponibilites', label: 'Disponibilités',  type: 'text',     defautActif: true, defautRequis: false },
    ],
  },
  evenement: {
    titre: 'Inscription à un événement',
    table: 'inscriptions_evenements',
    champs: [
      { nom: 'nom',         label: 'Nom',         type: 'text',   defautActif: true, defautRequis: true },
      { nom: 'prenom',      label: 'Prénom',      type: 'text',   defautActif: true, defautRequis: true },
      { nom: 'email',       label: 'E-mail',      type: 'email',  defautActif: true, defautRequis: true },
      { nom: 'telephone',   label: 'Téléphone',   type: 'tel',    defautActif: true, defautRequis: false },
      { nom: 'nb_personnes', label: 'Nombre de personnes', type: 'number', defautActif: true, defautRequis: false },
      { nom: 'commentaire', label: 'Commentaire', type: 'textarea', defautActif: true, defautRequis: false },
    ],
  },
}

// Types de champs libres proposés dans le constructeur
export const TYPES_CHAMP_LIBRE = [
  { type: 'text',     label: 'Texte court' },
  { type: 'textarea', label: 'Texte long' },
  { type: 'email',    label: 'E-mail' },
  { type: 'tel',      label: 'Téléphone' },
  { type: 'number',   label: 'Nombre' },
  { type: 'date',     label: 'Date' },
  { type: 'select',   label: 'Liste de choix' },
  { type: 'checkbox', label: 'Case à cocher' },
]

// Construit la config effective d'un formulaire en fusionnant catalogue + config base
export function configEffective(cle, configBase) {
  const cat = FORMULAIRES[cle]
  if (!cat) return null
  const champsCfg = configBase?.champs || {}
  const champs = cat.champs.map(ch => ({
    ...ch,
    actif:  champsCfg[ch.nom]?.actif  ?? ch.defautActif,
    requis: champsCfg[ch.nom]?.requis ?? ch.defautRequis,
  }))
  return {
    titre: configBase?.titre || cat.titre,
    table: cat.table,
    champs,
    champsLibres: configBase?.champs_libres || [],
    destinataires: configBase?.destinataires || [],
  }
}