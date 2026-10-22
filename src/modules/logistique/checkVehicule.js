import { CATEGORIES, nomPersonne } from './vehicules.js'

const JOUR = 86400000

export function idsLieuEtEnfants(lieux, lieuId) {
  const ids = new Set(lieuId ? [lieuId] : [])
  let ajout = true
  while (ajout) {
    ajout = false
    for (const l of lieux || []) {
      if (l.parent_id && ids.has(l.parent_id) && !ids.has(l.id)) {
        ids.add(l.id)
        ajout = true
      }
    }
  }
  return [...ids]
}

export function familleLieu(type) {
  if (type === 'sac' || type === 'pochette') return 'Sac'
  return 'Appareil'
}

/** Articles prévus (dotation) et présents (unités dispo) dans le sac et ses pochettes. */
export function lignesDepuisStock({ lieuId, lieux, dotations, unites, articles }) {
  const ids = new Set(idsLieuEtEnfants(lieux, lieuId))
  const byId = Object.fromEntries((articles || []).map(a => [a.id, a]))
  const map = new Map()
  const assurer = catalogueId => {
    if (!catalogueId) return null
    if (map.has(catalogueId)) return map.get(catalogueId)
    const a = byId[catalogueId]
    if (!a) return null
    const row = {
      catalogue_id: catalogueId,
      libelle: a.nom || 'Article',
      categorie: String(a.categorie || 'Sans catégorie').trim() || 'Sans catégorie',
      qte: 0,
      date_peremption: null,
    }
    map.set(catalogueId, row)
    return row
  }
  for (const d of dotations || []) {
    if (ids.has(d.lieu_id)) assurer(d.catalogue_id)
  }
  for (const u of unites || []) {
    if (!ids.has(u.lieu_id) || u.etat !== 'dispo') continue
    const row = assurer(u.catalogue_id)
    if (!row) continue
    row.qte += Number(u.qte_restante) || 0
    if (u.date_peremption && (!row.date_peremption || u.date_peremption < row.date_peremption)) {
      row.date_peremption = String(u.date_peremption).slice(0, 10)
    }
  }
  return [...map.values()].sort((a, b) =>
    a.categorie.localeCompare(b.categorie, 'fr') || a.libelle.localeCompare(b.libelle, 'fr'))
}

export function groupesLignes(lignes) {
  const ordre = []
  const map = new Map()
  for (const l of lignes || []) {
    const c = l.categorie || 'Sans catégorie'
    if (!map.has(c)) {
      map.set(c, [])
      ordre.push(c)
    }
    map.get(c).push(l)
  }
  return ordre.map(c => ({ categorie: c, lignes: map.get(c) }))
}

export function progression(lignes) {
  const total = (lignes || []).length
  const coches = (lignes || []).filter(l => l.coche).length
  const pct = total ? Math.round((100 * coches) / total) : 0
  return { total, coches, pct }
}

export function manquants(lignes) {
  return (lignes || []).filter(l => !l.coche)
}

/** Fait calendaire, sans seuil de retard. */
export function ilYa(iso, maintenant = new Date()) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const jours = Math.floor((maintenant.getTime() - d.getTime()) / JOUR)
  if (jours <= 0) return 'aujourd’hui'
  if (jours === 1) return 'il y a 1 j'
  return `il y a ${jours} j`
}

export function jourBruxelles(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function peremptionLibelle(date, aujourdhui) {
  if (!date) return { l: 'Sans date', ton: 'neutre' }
  const jour = String(date).slice(0, 10)
  const ref = aujourdhui || jourBruxelles()
  if (jour < ref) return { l: 'Périmé', ton: 'alerte' }
  return { l: jour, ton: 'ok' }
}

export function actionsRecentes({ constats, verifications, lieux, noms }) {
  const nomLieu = id => (lieux || []).find(l => l.id === id)?.nom || 'Sac'
  const cat = v => CATEGORIES.find(c => c.v === v)?.l || 'Point'
  const ev = []
  for (const c of constats || []) {
    ev.push({
      id: `o-${c.id}`,
      at: c.created_at,
      titre: c.libelle,
      detail: cat(c.categorie),
      qui: nomPersonne(noms?.[c.auteur_id]),
    })
    if (!c.ouvert && c.clos_le) {
      ev.push({
        id: `f-${c.id}`,
        at: c.clos_le,
        titre: `Réparé · ${c.libelle}`,
        detail: cat(c.categorie),
        qui: nomPersonne(noms?.[c.clos_par] || noms?.[c.auteur_id]),
      })
    }
  }
  for (const v of verifications || []) {
    const quand = v.valide_le || (v.ouverte ? v.commence_le : null)
    if (!quand) continue
    ev.push({
      id: `v-${v.id}`,
      at: quand,
      titre: v.valide_le ? `Vérification · ${nomLieu(v.lieu_id)}` : `Vérification en cours · ${nomLieu(v.lieu_id)}`,
      detail: v.dates_verifiees ? 'Dates de péremption vérifiées' : '',
      qui: nomPersonne(noms?.[v.valide_par || v.auteur_id]),
    })
  }
  return ev
    .filter(e => e.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8)
}
