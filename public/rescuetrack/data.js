// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Lecture des préventifs existants. Écriture uniquement dans rescuetrack_fiches.
import { supabase } from './auth.js'
import { estPreventif, provinceDuneActivite, unitesDuPreventif, statutPreventif, jourBruxelles, ficheVersPatient } from './model.js'

export function versEvenement(activite) {
  return {
    id: activite.id,
    description: activite.titre || 'Préventif',
    date: jourBruxelles(activite.debut),
    debut: activite.debut,
    fin: activite.fin,
    province: provinceDuneActivite(activite),
    commune: activite.adresse_ville || activite.lieu || '',
    lieu: activite.lieu || '',
    status: statutPreventif(activite),
    numero: activite.numero,
    pmas: unitesDuPreventif(activite),
  }
}

export async function listerPreventifs() {
  const { data, error } = await supabase.from('activites_secours')
    .select('id,numero,titre,type,lieu,adresse,adresse_cp,adresse_ville,debut,fin,dispositifs,dispositif')
    .order('debut', { ascending: false })
  if (error) throw error
  return (data || []).filter(estPreventif).map(versEvenement)
}

export async function lirePreventif(id) {
  const { data, error } = await supabase.from('activites_secours')
    .select('id,numero,titre,type,lieu,adresse,adresse_cp,adresse_ville,debut,fin,dispositifs,dispositif')
    .eq('id', id).maybeSingle()
  if (error) throw error
  if (!data || !estPreventif(data)) return null
  return versEvenement(data)
}

const COLONNES = 'id,preventif_id,numero_local,code_patient,nom,prenom,date_naissance,sexe,triage_initial,triage_actuel,triage_sortie,heure_entree,heure_sortie,destination,fiche,created_at'

export async function listerPatients(preventifId) {
  let req = supabase.from('rescuetrack_fiches').select(COLONNES).order('numero_local', { ascending: true })
  if (preventifId) req = req.eq('preventif_id', preventifId)
  const { data, error } = await req
  if (error) throw error
  return (data || []).map(ficheVersPatient)
}

export async function lirePatient(id) {
  const { data, error } = await supabase.from('rescuetrack_fiches').select(COLONNES).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? ficheVersPatient(data) : null
}

export async function enregistrerPatient(preventifId, fiche, id) {
  const { data, error } = await supabase.rpc('rescuetrack_enregistrer_fiche', {
    p_id: id || null, p_preventif: preventifId, p_fiche: fiche,
  })
  if (error) throw error
  return data
}

export async function listerLogbook(preventifId) {
  const { data, error } = await supabase.from('rescuetrack_logbook')
    .select('id,preventif_id,dispositif,texte,auteur,created_at')
    .eq('preventif_id', preventifId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function ajouterLogbook(preventifId, texte, dispositif, auteur) {
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase.from('rescuetrack_logbook').insert({
    preventif_id: preventifId, texte, dispositif: dispositif || null, auteur: auteur || null,
    created_by: userData.user?.id,
  })
  if (error) throw error
}
