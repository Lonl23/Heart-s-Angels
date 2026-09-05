import { cheminLieux } from './stockSchema'

/** Clé d’un lot : article catalogue + n° de lot (insensible à la casse). */
export function cleLot(catalogueId, lot) {
  return `${catalogueId || ''}::${(lot || '').trim().toLowerCase()}`
}

export function fmtDlc(d) {
  if (!d) return 'sans DLC'
  const x = new Date(String(d).slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(x.getTime())) return String(d)
  return x.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function dlcPassee(d) {
  if (!d) return false
  return String(d).slice(0, 10) < new Date().toISOString().slice(0, 10)
}

export function dlcProche(d, jours = 90) {
  if (!d || dlcPassee(d)) return false
  const lim = new Date()
  lim.setDate(lim.getDate() + jours)
  return String(d).slice(0, 10) <= lim.toISOString().slice(0, 10)
}

export function qteLotLabel(lot) {
  const n = Number(lot?.qte_totale) || 0
  const u = Number(lot?.nb_unites) || 0
  const unite = lot?.unite || 'pièce'
  if (lot?.mode === 'oxygene') return `${u} bouteille${u > 1 ? 's' : ''}`
  if (lot?.mode === 'boite') return `${n} ${unite}${n > 1 && !unite.endsWith('s') ? 's' : ''} · ${u} boîte${u > 1 ? 's' : ''}`
  if (lot?.mode === 'durable') return `${u} en place`
  if (u > 1 && n === u) return `${n} pièces`
  return `${n} restant${n > 1 ? 's' : ''}`
}

/**
 * Agrège les unités physiques (1 QR) en lots : article, n° de lot, DLC,
 * quantité restante, répartition par emplacement.
 */
export function aggregerLots(unites, lieux) {
  const map = new Map()
  for (const u of unites || []) {
    if (u.etat && u.etat !== 'dispo') continue
    const lotTxt = (u.lot || '').trim()
    const key = cleLot(u.catalogue_id || u.nom, lotTxt)
    let g = map.get(key)
    if (!g) {
      g = {
        catalogue_id: u.catalogue_id,
        article: u.nom,
        photo_path: u.photo_path,
        mode: u.mode,
        unite: u.unite,
        lot: lotTxt || null,
        dlcsSet: new Set(),
        qte_totale: 0,
        nb_unites: 0,
        lieuxMap: new Map(),
      }
      map.set(key, g)
    }
    const qte = Number(u.qte_restante) || 0
    g.qte_totale += qte
    g.nb_unites += 1
    if (u.date_peremption) g.dlcsSet.add(String(u.date_peremption).slice(0, 10))
    const lieuId = u.lieu_id || ''
    const chemin = cheminLieux(lieux, u.lieu_id) || u.lieu_nom || 'sans lieu'
    const lg = g.lieuxMap.get(lieuId) || {
      lieu_id: u.lieu_id || null,
      nom: u.lieu_nom || 'sans lieu',
      chemin,
      qte: 0,
    }
    lg.qte += qte
    g.lieuxMap.set(lieuId, lg)
  }
  return [...map.values()].map(g => {
    const dlcs = [...g.dlcsSet].sort()
    return {
      catalogue_id: g.catalogue_id,
      article: g.article,
      photo_path: g.photo_path,
      mode: g.mode,
      unite: g.unite,
      lot: g.lot,
      dlc: dlcs[0] || null,
      dlcs,
      dlc_incoherente: dlcs.length > 1,
      qte_totale: g.qte_totale,
      nb_unites: g.nb_unites,
      lieux: [...g.lieuxMap.values()].sort((a, b) => (a.chemin || '').localeCompare(b.chemin || '', 'fr')),
    }
  }).sort((a, b) =>
    (a.article || '').localeCompare(b.article || '', 'fr')
    || (a.lot || 'ÿ').localeCompare(b.lot || 'ÿ', 'fr')
  )
}

/** DLC déjà connue pour un couple article + n° de lot (réception). */
export function lotConnuPour(unites, catalogueId, lot) {
  const n = (lot || '').trim().toLowerCase()
  if (!n || !catalogueId) return null
  const same = (unites || []).filter(u =>
    u.catalogue_id === catalogueId && (u.lot || '').trim().toLowerCase() === n
  )
  if (!same.length) return null
  const dlcs = [...new Set(same.map(u => u.date_peremption).filter(Boolean).map(d => String(d).slice(0, 10)))].sort()
  const dispo = same.filter(u => !u.etat || u.etat === 'dispo')
  return {
    dlc: dlcs[0] || null,
    dlcs,
    dlc_incoherente: dlcs.length > 1,
    qte: dispo.reduce((s, u) => s + (Number(u.qte_restante) || 0), 0),
    nb: dispo.length,
  }
}

export function lotCorrespond(lot, q) {
  if (!q) return true
  const hay = [
    lot.article,
    lot.lot,
    lot.dlc,
    ...(lot.lieux || []).flatMap(x => [x.chemin, x.nom]),
  ].map(x => (x || '').toLowerCase())
  return hay.some(h => h.includes(q))
}
