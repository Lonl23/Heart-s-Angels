import config from '@/app.config'

/** Adresse publique de l’espace partenaire, à coller sur le site ou à envoyer. */
export function urlAccesPartenaire() {
  const fromConfig = String(config.domaine || '').trim().replace(/\/$/, '')
  const fromWindow = typeof window !== 'undefined' ? window.location.origin : ''
  const base = fromConfig || fromWindow || 'https://heart-s-angels.web.app'
  return `${base}/login/partenaire`
}

export async function copierTexte(texte) {
  const t = String(texte || '')
  if (!t) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t)
      return true
    }
  } catch { /* repli ci-dessous */ }
  try {
    const el = document.createElement('textarea')
    el.value = t
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
