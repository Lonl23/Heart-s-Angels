/** Télécharge un fichier (évite la navigation SPA / écran de connexion). */
export async function telechargerFichier(url, nomFichier) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`)
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = nomFichier || 'document.pdf'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 2000)
}

export function urlPublic(chemin) {
  const base = import.meta.env.BASE_URL || '/'
  const clean = String(chemin || '').replace(/^\//, '')
  return `${base.endsWith('/') ? base : `${base}/`}${clean}`
}
