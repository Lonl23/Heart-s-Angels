const GEO = 'https://photon.komoot.io/api/'
const ROUTES = [
  'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
  'https://router.project-osrm.org/route/v1/driving/',
]

const geoCache = new Map()
const routeCache = new Map()

export function sansAccent(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function scoreLieu(feature, query) {
  const p = feature?.properties || {}
  const q = sansAccent(query)
  let s = 0
  const rue = sansAccent(p.street || (p.osm_key === 'highway' ? p.name : ''))
  const nom = sansAccent(p.name || '')
  if (rue && rue.length > 3 && q.includes(rue)) s += 6
  else if (nom && nom.length > 3 && q.includes(nom)) s += 5
  if (p.postcode && q.includes(String(p.postcode))) s += 3
  if (p.housenumber && new RegExp(`(?:^|\\D)${String(p.housenumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\D|$)`).test(q)) s += 2
  const ville = sansAccent(p.city || p.district || '')
  if (ville && ville.length > 2 && q.includes(ville)) s += 2
  if (p.countrycode === 'BE') s += 1
  return s
}

export function choisirLieu(features, query) {
  let best = null
  let bestScore = 0
  for (const f of features || []) {
    const s = scoreLieu(f, query)
    if (s > bestScore) { bestScore = s; best = f }
  }
  if (!best || bestScore < 5) return null
  const [lon, lat] = best.geometry?.coordinates || []
  if (typeof lat !== 'number' || typeof lon !== 'number') return null
  return { lat, lon }
}

export function fmtKm(metres) {
  if (metres == null || !Number.isFinite(metres)) return ''
  const km = metres / 1000
  const n = km < 10
    ? km.toLocaleString('fr-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : Math.round(km).toLocaleString('fr-BE')
  return `${n} km`
}

export function fmtDuree(secondes) {
  if (secondes == null || !Number.isFinite(secondes)) return ''
  const min = Math.max(1, Math.round(secondes / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

export function fmtMesure(leg) {
  if (!leg || !Number.isFinite(leg.metres) || !Number.isFinite(leg.secondes)) return ''
  return `${fmtKm(leg.metres)} · ${fmtDuree(leg.secondes)}`
}

export function totalMesures(legs) {
  if (!legs?.length || legs.some(l => !l)) return null
  return legs.reduce((a, l) => ({
    metres: a.metres + l.metres,
    secondes: a.secondes + l.secondes,
  }), { metres: 0, secondes: 0 })
}

async function fetchGeo(q) {
  const url = `${GEO}?q=${encodeURIComponent(q)}&limit=5&lang=fr&lat=50.5&lon=4.7`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return choisirLieu(data.features, q)
}

function geocoder(q) {
  const key = sansAccent(q).replace(/\s+/g, ' ').trim()
  if (key.length < 4) return Promise.resolve(null)
  if (!geoCache.has(key)) {
    geoCache.set(key, fetchGeo(q).catch(err => { geoCache.delete(key); throw err }))
  }
  return geoCache.get(key)
}

async function fetchRoute(path) {
  for (const base of ROUTES) {
    try {
      const res = await fetch(`${base}${path}?overview=false`)
      if (!res.ok) continue
      const data = await res.json()
      const legs = data.routes?.[0]?.legs
      if (!legs?.length) continue
      return legs.map(l => ({ metres: l.distance, secondes: l.duration }))
    } catch { /* serveur suivant */ }
  }
  return null
}

function router(points) {
  const path = points.map(p => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';')
  if (!routeCache.has(path)) {
    routeCache.set(path, fetchRoute(path).catch(err => { routeCache.delete(path); throw err }))
  }
  return routeCache.get(path)
}

export async function mesurerEtapes(textes) {
  const pts = []
  for (const t of textes || []) pts.push(await geocoder(t))
  if (pts.length < 2) return []
  if (pts.every(Boolean)) {
    const legs = await router(pts)
    if (legs && legs.length === pts.length - 1) return legs
  }
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    if (!pts[i] || !pts[i + 1]) { out.push(null); continue }
    const legs = await router([pts[i], pts[i + 1]])
    out.push(legs?.[0] || null)
  }
  return out
}
