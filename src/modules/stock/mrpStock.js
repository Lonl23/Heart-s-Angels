/**
 * MRP léger ASBL — calcul client de secours si la RPC est indisponible.
 * Nomenclature = stock_dotation (lieu × article × qté).
 * Besoin net = sécurité + trous BOM − stock − commandes ouvertes.
 */

import { cheminLieux } from './stockSchema'

const STATUTS_OUVERTS = new Set(['a_commander', 'commandee', 'en_attente'])

function estLieuMission(lieu) {
  return ['sac', 'pochette', 'kit', 'vehicule'].includes(lieu?.type)
}

function qteUnite(u, mode) {
  if (u.etat && u.etat !== 'dispo') return 0
  if (mode === 'boite') return Number(u.qte_restante) || 0
  if (mode === 'oxygene') return Number(u.pression_bar) > 0 || u.pression_bar == null ? 1 : 0
  return 1
}

export function calculerBesoinsMrp({ cats, lieux, unites, dotations, commandes }) {
  const byLieu = Object.fromEntries((lieux || []).map(l => [l.id, l]))
  const dispo = new Map() // catalogue_id -> { total, reserve, mission }
  for (const u of unites || []) {
    const cat = (cats || []).find(c => c.id === u.catalogue_id)
    if (!cat) continue
    const q = qteUnite(u, cat.mode || u.mode)
    if (!q) continue
    const cur = dispo.get(u.catalogue_id) || { total: 0, reserve: 0, mission: 0 }
    cur.total += q
    const lieu = byLieu[u.lieu_id]
    if (estLieuMission(lieu)) cur.mission += q
    else cur.reserve += q
    dispo.set(u.catalogue_id, cur)
  }

  const presentLieu = new Map() // `${lieu}|${cat}` -> qte
  for (const u of unites || []) {
    if (!u.lieu_id) continue
    const cat = (cats || []).find(c => c.id === u.catalogue_id)
    if (!cat) continue
    const q = qteUnite(u, cat.mode || u.mode)
    if (!q) continue
    const k = `${u.lieu_id}|${u.catalogue_id}`
    presentLieu.set(k, (presentLieu.get(k) || 0) + q)
  }

  const bom = new Map() // catalogue_id -> { qte_bom, manque_bom }
  for (const d of dotations || []) {
    const qte = Number(d.qte) > 0 ? Number(d.qte) : 1
    const present = presentLieu.get(`${d.lieu_id}|${d.catalogue_id}`) || 0
    const cur = bom.get(d.catalogue_id) || { qte_bom: 0, manque_bom: 0 }
    cur.qte_bom += qte
    cur.manque_bom += Math.max(qte - present, 0)
    bom.set(d.catalogue_id, cur)
  }

  const enCmd = new Map()
  for (const c of commandes || []) {
    if (!STATUTS_OUVERTS.has(c.statut)) continue
    enCmd.set(c.catalogue_id, (enCmd.get(c.catalogue_id) || 0) + (Number(c.quantite) || 0))
  }

  const lignes = []
  for (const c of cats || []) {
    if (c.actif === false) continue
    const d = dispo.get(c.id) || { total: 0, reserve: 0, mission: 0 }
    const b = bom.get(c.id) || { qte_bom: 0, manque_bom: 0 }
    const en_commande = enCmd.get(c.id) || 0
    const stock_minimal = Number(c.stock_minimal) || 0
    const stock_minimal_sacs = Number(c.stock_minimal_sacs) || 0
    const manque_securite_reserve = Math.max(stock_minimal - d.reserve, 0)
    const manque_securite_mission = Math.max(stock_minimal_sacs - d.mission, 0)
    const a_doter = Math.min(b.manque_bom, d.total)
    const a_acheter = Math.max(
      manque_securite_reserve + manque_securite_mission + Math.max(b.manque_bom - d.total, 0) - en_commande,
      0,
    )
    if (a_acheter <= 0 && a_doter <= 0 && b.manque_bom <= 0
      && manque_securite_reserve <= 0 && manque_securite_mission <= 0) continue
    lignes.push({
      catalogue_id: c.id,
      nom: c.nom,
      mode: c.mode,
      nature: c.nature,
      unite: c.unite,
      fournisseur_id: c.fournisseur_id || null,
      ref_fournisseur: c.ref_fournisseur || null,
      delai_reappro: c.delai_reappro || null,
      stock_minimal,
      stock_minimal_sacs,
      qte_dispo: d.total,
      qte_reserve: d.reserve,
      qte_mission: d.mission,
      qte_bom: b.qte_bom,
      manque_bom: b.manque_bom,
      en_commande,
      manque_securite_reserve,
      manque_securite_mission,
      a_doter,
      a_acheter,
    })
  }

  lignes.sort((a, b) => {
    const pa = a.a_acheter > 0 ? 0 : a.a_doter > 0 ? 1 : 2
    const pb = b.a_acheter > 0 ? 0 : b.a_doter > 0 ? 1 : 2
    if (pa !== pb) return pa - pb
    return (a.nom || '').localeCompare(b.nom || '', 'fr')
  })

  return {
    ok: true,
    calcule_le: new Date().toISOString(),
    lignes,
    totaux: {
      articles: lignes.filter(l => l.a_acheter > 0 || l.a_doter > 0).length,
      a_acheter: lignes.reduce((s, l) => s + l.a_acheter, 0),
      a_doter: lignes.reduce((s, l) => s + l.a_doter, 0),
    },
  }
}

export function nomenclaturesParLieu(lieux, cats, dotations) {
  const byCat = Object.fromEntries((cats || []).map(c => [c.id, c]))
  const groupes = new Map()
  for (const d of dotations || []) {
    const list = groupes.get(d.lieu_id) || []
    list.push({
      ...d,
      qte: Number(d.qte) > 0 ? Number(d.qte) : 1,
      article: byCat[d.catalogue_id] || null,
    })
    groupes.set(d.lieu_id, list)
  }
  return [...groupes.entries()]
    .map(([lieu_id, lignes]) => ({
      lieu_id,
      chemin: cheminLieux(lieux, lieu_id),
      lieu: (lieux || []).find(l => l.id === lieu_id) || null,
      lignes: lignes.sort((a, b) => (a.article?.nom || '').localeCompare(b.article?.nom || '', 'fr')),
    }))
    .filter(g => g.lignes.length)
    .sort((a, b) => (a.chemin || '').localeCompare(b.chemin || '', 'fr'))
}
