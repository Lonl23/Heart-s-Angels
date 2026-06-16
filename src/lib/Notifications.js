// src/lib/notifications.js
// Système de notifications internes, basé sur les FONCTIONS ASBL.
import { supabase } from '@/lib/supabase'

const COORD_PAR_DOMAINE = {
  souhait:    'coord_transports',
  logistique: 'coord_logistique',
  evenement:  'coord_benevoles',
}

// ── Récupération des destinataires par fonction ──────────────────────────────
async function idsAvecFonction(fonction) {
  const { data } = await supabase
    .from('profiles').select('id')
    .contains('fonctions', [fonction]).eq('actif', true)
  return (data || []).map(p => p.id)
}
async function idsAdjointDe(fonction) {
  const { data } = await supabase
    .from('profiles').select('id')
    .contains('fonctions_adjoint', [fonction]).eq('actif', true)
  return (data || []).map(p => p.id)
}
async function idsTresorier() {
  return idsAvecFonction('tresorier')
}
async function idsDirection() {
  const { data } = await supabase
    .from('profiles').select('id, fonctions, niveau_acces')
    .eq('actif', true)
  return (data || [])
    .filter(p => p.niveau_acces === 'super_user'
      || (p.fonctions || []).some(f => ['president', 'vice_president'].includes(f)))
    .map(p => p.id)
}

// Coordinateurs (titulaires + adjoints) responsables d'un domaine donné
async function idsCoordsDomaine(domaine) {
  const coord = COORD_PAR_DOMAINE[domaine]
  if (coord) {
    return [...await idsAvecFonction(coord), ...await idsAdjointDe(coord)]
  }
  // domaine 'autre' → tous les coordinateurs de mission
  let dest = []
  for (const c of Object.values(COORD_PAR_DOMAINE)) {
    dest.push(...await idsAvecFonction(c), ...await idsAdjointDe(c))
  }
  return dest
}

// ── Envoi générique ──────────────────────────────────────────────────────────
async function envoyer(destinataires, { type = 'info', titre, message, lien, priorite = 'normale', expediteur_id = null }) {
  const uniques = [...new Set((destinataires || []).filter(Boolean))]
  if (uniques.length === 0) return
  const rows = uniques.map(id => ({
    destinataire_id: id, expediteur_id, type, titre, message, lien, priorite, lu: false,
  }))
  // Ne bloque jamais l'action principale si la notif échoue
  try { await supabase.from('notifications').insert(rows) } catch (e) { console.warn('notif:', e?.message) }
}

const eur = (n) => (n || 0).toFixed(2) + ' €'

// ── Notifications du circuit de défraiement ──────────────────────────────────

// 1. Défraiement soumis → coordinateur(s) du domaine + adjoints
export async function notifDefraiementSoumis(d, expediteurNom, expediteur_id) {
  const dest = await idsCoordsDomaine(d.domaine)
  await envoyer(dest, {
    type: 'defraiement',
    titre: 'Défraiement à valider',
    message: `${expediteurNom} a soumis un défraiement de ${eur(d.montant_rembourse)} (${d.domaine}).`,
    lien: '/app/defraiements/validation',
    priorite: 'haute',
    expediteur_id,
  })
}

// 2. Adjoint a pré-validé → coordinateur TITULAIRE doit confirmer
export async function notifPreValidation(d, expediteurNom, expediteur_id) {
  const coord = COORD_PAR_DOMAINE[d.domaine]
  let dest = coord ? await idsAvecFonction(coord) : []
  if (!coord) for (const c of Object.values(COORD_PAR_DOMAINE)) dest.push(...await idsAvecFonction(c))
  await envoyer(dest, {
    type: 'defraiement',
    titre: 'Pré-validation à confirmer',
    message: `${expediteurNom} (adjoint) a pré-validé un défraiement. Votre confirmation est requise.`,
    lien: '/app/defraiements/validation',
    priorite: 'haute',
    expediteur_id,
  })
}

// 3. Coordinateur a validé → trésorier(s)
export async function notifTresorier(d, expediteur_id) {
  await envoyer(await idsTresorier(), {
    type: 'defraiement',
    titre: 'Défraiement à approuver',
    message: `Un défraiement de ${eur(d.montant_rembourse)} attend votre validation trésorier.`,
    lien: '/app/defraiements/validation',
    priorite: 'normale',
    expediteur_id,
  })
}

// 4. Notification au bénévole selon le statut
export async function notifBenevole(d, statut, expediteur_id) {
  const map = {
    valide_coordinateur: { t: 'Défraiement validé',   m: 'Votre défraiement a été validé par le coordinateur.', p: 'normale' },
    valide_tresorier:    { t: 'Défraiement approuvé',  m: 'Votre défraiement est approuvé, paiement en cours.', p: 'normale' },
    paye:                { t: 'Défraiement payé ✓',    m: `Votre défraiement de ${eur(d.montant_rembourse)} a été payé.`, p: 'normale' },
    refuse:              { t: 'Défraiement refusé',    m: `Votre défraiement a été refusé${d.refuse_motif ? ' : ' + d.refuse_motif : '.'}`, p: 'haute' },
  }
  const m = map[statut]
  if (!m || !d.user_id) return
  await envoyer([d.user_id], {
    type: 'defraiement', titre: m.t, message: m.m, lien: '/app/defraiements', priorite: m.p, expediteur_id,
  })
}

// ── Alerte stock minimal → coordinateur logistique + adjoint ──────────────────
export async function notifStockMinimal(materiel) {
  const dest = [
    ...await idsAvecFonction('coord_logistique'),
    ...await idsAdjointDe('coord_logistique'),
  ]
  await envoyer(dest, {
    type: 'stock',
    titre: 'Stock minimal atteint',
    message: `Le matériel « ${materiel.nom} » est à ${materiel.quantite} ${materiel.unite || ''} (seuil : ${materiel.stock_minimal}). Réapprovisionnement à prévoir.`,
    lien: '/app/stock',
    priorite: 'haute',
  })
}

// ── Soumission d'un formulaire public → fonctions destinataires + adjoints ────
export async function notifFormulaire(cleFormulaire, titreFormulaire, destinataires, resume) {
  // destinataires = tableau de fonctions ASBL
  let ids = []
  for (const fonction of (destinataires || [])) {
    ids.push(...await idsAvecFonction(fonction), ...await idsAdjointDe(fonction))
  }
  const liens = {
    contact: '/app/contenu', souhait: '/app/souhaits',
    benevole: '/app/volontaires', evenement: '/app/contenu',
  }
  await envoyer(ids, {
    type: 'formulaire',
    titre: `Nouveau : ${titreFormulaire}`,
    message: resume || `Une nouvelle soumission « ${titreFormulaire} » a été reçue.`,
    lien: liens[cleFormulaire] || '/app',
    priorite: 'normale',
  })
}

// ── Rapport final d'un souhait réalisé → coordinateurs transport & médical ────
export async function notifRapportFinalSouhait(souhait, expediteur_id) {
  const dest = [
    ...await idsAvecFonction('coord_transports'),
    ...await idsAdjointDe('coord_transports'),
    ...await idsAvecFonction('coord_medical'),
    ...await idsAdjointDe('coord_medical'),
  ]
  const patient = `${souhait.patient_prenom||''} ${souhait.patient_nom||''}`.trim() || 'un patient'
  await envoyer(dest, {
    type: 'souhait',
    titre: 'Rapport de réalisation disponible',
    message: `Le souhait de ${patient} est passé en « réalisé ». Le rapport final consolidé est disponible (PDF téléchargeable dans l'onglet Rapport).`,
    lien: `/app/souhaits/${souhait.id}`,
    priorite: 'normale',
    expediteur_id,
  })
}

export { idsDirection, envoyer, idsAvecFonction, idsAdjointDe }