import { descendantsDe, enfantsDe, cheminLieux } from './stockSchema'

export function replierTexte(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function idsSousArbre(lieux, id) {
  if (!id) return []
  return [id, ...descendantsDe(lieux, id).map(l => l.id)]
}

export function cataloguesPrevus(dotations, cats, lieuIds) {
  const set = new Set((dotations || []).filter(d => lieuIds.includes(d.lieu_id)).map(d => d.catalogue_id))
  return [...set]
    .map(id => (cats || []).find(c => c.id === id))
    .filter(Boolean)
    .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))
}

function uniteDansLieux(u, lieuIds) {
  if (!lieuIds.includes(u.lieu_id)) return false
  if (u.etat && u.etat !== 'dispo') return false
  if (u.mode === 'oxygene') return Number(u.pression_bar) > 0 || u.pression_bar == null
  return Number(u.qte_restante) > 0 || u.qte_restante == null
}

function qteUnitePourCat(u, cat) {
  const mode = cat?.mode || u.mode
  if (u.etat && u.etat !== 'dispo') return 0
  if (mode === 'boite') return Number(u.qte_restante) || 0
  if (mode === 'oxygene') return Number(u.pression_bar) > 0 || u.pression_bar == null ? 1 : 0
  return 1
}

export function cataloguesPresentsIds(unites, lieuIds) {
  return new Set((unites || []).filter(u => uniteDansLieux(u, lieuIds)).map(u => u.catalogue_id))
}

/** Quantité présente d’un catalogue dans un ensemble de lieux. */
export function qtePresenteCatalogue(unites, cats, catalogueId, lieuIds) {
  const cat = (cats || []).find(c => c.id === catalogueId)
  return (unites || [])
    .filter(u => u.catalogue_id === catalogueId && lieuIds.includes(u.lieu_id))
    .reduce((s, u) => s + qteUnitePourCat(u, cat), 0)
}

/** Contenu prévu d’un emplacement : présent / manque / hors liste (MRP : qté BOM). */
export function etatDotationLieu(n, lieux, cats, dotations, unites, arbre = false) {
  const lieuIds = arbre ? idsSousArbre(lieux, n.id) : [n.id]
  const dots = (dotations || []).filter(d => lieuIds.includes(d.lieu_id))
  const prevus = cataloguesPrevus(dotations, cats, lieuIds)
  const presents = cataloguesPresentsIds(unites, lieuIds)
  const ok = []
  const manque = []
  for (const c of prevus) {
    const qteReq = dots
      .filter(d => d.catalogue_id === c.id)
      .reduce((s, d) => s + (Number(d.qte) > 0 ? Number(d.qte) : 1), 0)
    const qteOk = qtePresenteCatalogue(unites, cats, c.id, lieuIds)
    if (qteOk >= qteReq) ok.push(c)
    else manque.push(c)
  }
  const prevuIds = new Set(prevus.map(c => c.id))
  const extraCats = [...presents]
    .filter(id => !prevuIds.has(id))
    .map(id => (cats || []).find(c => c.id === id))
    .filter(Boolean)
    .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))
  return {
    lieu: n,
    prevus,
    ok,
    manque,
    extraCats,
    nbOk: ok.length,
    nbPrevu: prevus.length,
    complet: prevus.length > 0 && manque.length === 0,
  }
}

/** Sacs (et racines) dont le contenu prévu n’est pas entièrement en place. */
export function sacsIncomplets(lieux, cats, dotations, unites) {
  return enfantsDe(lieux, null).map(r => {
    const etat = etatDotationLieu(r, lieux, cats, dotations, unites, true)
    const pochettes = [r, ...descendantsDe(lieux, r.id)]
      .map(k => etatDotationLieu(k, lieux, cats, dotations, unites, false))
      .filter(x => x.nbPrevu > 0)
    return { ...etat, pochettes }
  }).filter(s => s.nbPrevu > 0 && s.manque.length > 0)
}

export function correspondArticle(c, q) {
  const needle = replierTexte(q)
  if (!needle) return true
  return needle.split(' ').filter(Boolean).every(t =>
    replierTexte(c.nom).includes(t)
    || replierTexte(c.categorie).includes(t)
    || replierTexte(c.ref_fournisseur).includes(t)
  )
}

export function correspondLieu(l, lieux, q) {
  const needle = replierTexte(q)
  if (!needle) return true
  return needle.split(' ').filter(Boolean).every(t =>
    replierTexte(l.nom).includes(t)
    || replierTexte(cheminLieux(lieux, l.id)).includes(t)
    || replierTexte(l.type).includes(t)
  )
}

/** Ids à afficher dans l’arbre (le lieu + ses parents) pour garder le chemin. */
export function idsLieuxFiltres(lieux, q) {
  const needle = replierTexte(q)
  if (!needle) return null
  const byId = Object.fromEntries((lieux || []).map(l => [l.id, l]))
  const keep = new Set()
  for (const l of lieux || []) {
    if (!correspondLieu(l, lieux, q)) continue
    let cur = l, guard = 0
    while (cur && guard++ < 12) {
      keep.add(cur.id)
      cur = cur.parent_id ? byId[cur.parent_id] : null
    }
  }
  return keep
}
