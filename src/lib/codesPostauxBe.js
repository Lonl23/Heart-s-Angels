/** Lookup code postal belge → localités / sous-localités (zippopotam + cache). */

const cache = new Map()

function nettoyerCp(cp) {
  return String(cp || '').replace(/\D/g, '').slice(0, 4)
}

function normaliserPlace(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .replace(/Jemeppesur-Meuse/i, 'Jemeppe-sur-Meuse')
    .trim()
}

/**
 * @returns {Promise<Array<{ localite: string, cp: string, pays: string }>>}
 */
export async function localitesDepuisCp(cp) {
  const code = nettoyerCp(cp)
  if (code.length !== 4) return []
  if (cache.has(code)) return cache.get(code)

  try {
    const r = await fetch(`https://api.zippopotam.us/be/${code}`, {
      headers: { Accept: 'application/json' },
    })
    if (!r.ok) {
      cache.set(code, [])
      return []
    }
    const j = await r.json()
    const seen = new Set()
    const places = []
    for (const p of j.places || []) {
      const localite = normaliserPlace(p['place name'])
      if (!localite || seen.has(localite.toLowerCase())) continue
      seen.add(localite.toLowerCase())
      places.push({
        localite,
        cp: code,
        pays: 'Belgique',
        region: p.state || '',
      })
    }
    cache.set(code, places)
    return places
  } catch {
    cache.set(code, [])
    return []
  }
}
