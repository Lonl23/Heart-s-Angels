const CLE = 'ha_appareil_cle'

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `a${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** Identifiant stable de cet appareil / navigateur (localStorage). */
export function cleAppareil() {
  try {
    let v = localStorage.getItem(CLE)
    if (!v) {
      v = uuid()
      localStorage.setItem(CLE, v)
    }
    return v
  } catch {
    return ''
  }
}
