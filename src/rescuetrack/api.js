import { supabase } from '@/lib/supabase'
import { estPreventif } from './ficheModel'

const CHAMPS_ACTIVITE = 'id, numero, titre, type, lieu, adresse, adresse_rue, adresse_numero, adresse_cp, adresse_ville, debut, fin, dispositifs, dispositif, public_attendu, organisateur_nom'

export function messageErreur(error) {
  const brut = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`
  if (/déplacée/i.test(brut)) return 'Une fiche ne peut pas changer de préventif.'
  if (/préventif/i.test(brut)) return "RescueTrack n'enregistre des patients que sur un préventif existant."
  if (/personnel/i.test(brut)) return 'Accès réservé au personnel.'
  if (/triage/i.test(brut)) return 'Triage non reconnu.'
  if (/pathologie/i.test(brut)) return 'Pathologie non reconnue.'
  if (/dispositif non reconnu|dispositif invalide/i.test(brut)) return 'Dispositif non reconnu.'
  if (/sexe/i.test(brut)) return 'Sexe non reconnu.'
  if (/orientation/i.test(brut)) return 'Orientation non reconnue.'
  if (/heure de fin/i.test(brut)) return "L'heure de fin précède l'heure de début."
  if (/introuvable/i.test(brut)) return 'Fiche introuvable.'
  if (/trop volumineuse|taille autorisée/i.test(brut)) return 'La fiche est trop volumineuse.'
  if (/row-level security|permission denied|42501/i.test(brut)) return 'Accès refusé.'
  return "L'opération n'a pas abouti. Réessayez."
}

export async function listerPreventifs() {
  const { data, error } = await supabase
    .from('activites_secours')
    .select(CHAMPS_ACTIVITE)
    .order('debut', { ascending: false })
  if (error) throw error
  const rows = (data || []).filter(estPreventif)
  const ids = rows.map(r => r.id)
  const comptes = {}
  if (ids.length) {
    const fiches = await supabase.from('fiches_patient_dps').select('activite_id').in('activite_id', ids)
    if (fiches.error) throw fiches.error
    for (const fiche of fiches.data || []) {
      comptes[fiche.activite_id] = (comptes[fiche.activite_id] || 0) + 1
    }
  }
  return rows.map(row => ({ ...row, nbFiches: comptes[row.id] || 0 }))
}

export async function lirePreventif(id) {
  const { data, error } = await supabase
    .from('activites_secours')
    .select(CHAMPS_ACTIVITE)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data || !estPreventif(data)) return null
  return data
}

export async function listerFiches(activiteId) {
  const { data, error } = await supabase
    .from('fiches_patient_dps')
    .select('id, numero_local, nom, prenom, motifs, heure_prise_en_charge, orientation')
    .eq('activite_id', activiteId)
    .order('numero_local', { ascending: true })
  if (error) throw error
  return data || []
}

export async function lireFiche(activiteId, ficheId) {
  const { data, error } = await supabase
    .from('fiches_patient_dps')
    .select('id, activite_id, numero_local, nom, prenom, date_naissance, sexe, motifs, heure_prise_en_charge, heure_fin, orientation, notes, contenu')
    .eq('activite_id', activiteId)
    .eq('id', ficheId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function enregistrerFiche({ activiteId, ficheId, payload }) {
  const { data, error } = await supabase.rpc('enregistrer_fiche_patient_dps', {
    p_activite_id: activiteId,
    p_contenu: payload.contenu,
    p_id: ficheId || null,
    p_nom: payload.nom,
    p_prenom: payload.prenom,
    p_date_naissance: payload.dateNaissance,
    p_sexe: payload.sexe,
    p_motifs: payload.motifs,
    p_heure_prise_en_charge: payload.heureDebut,
    p_heure_fin: payload.heureFin,
    p_orientation: payload.orientation,
    p_notes: payload.notes,
  })
  if (error) throw error
  return data
}
