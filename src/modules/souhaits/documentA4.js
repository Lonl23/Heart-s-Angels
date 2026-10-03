export function escHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

export function htmlDocument(titre, body, css) {
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + escHtml(titre) + '</title>'
    + '<style>' + css + '</style></head><body>' + body + '</body></html>'
}

export function estTelephone() {
  return !!(window.navigator?.standalone
    || window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(pointer: coarse)').matches
    || window.innerWidth < 720)
}

export function telechargerHtml(nomFichier, html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nomFichier
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/** Ouvre le document A4 isolé (nouvel onglet / aperçu téléphone). Jamais une capture de l’app. */
export function imprimerHtml(html, setApercu) {
  const telephone = estTelephone()
  if (telephone) {
    setApercu(html)
    return
  }
  let w = null
  try { w = window.open('', '_blank') } catch { w = null }
  if (w && w !== window) {
    w.document.open()
    w.document.write(html)
    w.document.close()
    const go = () => { try { w.focus(); w.print() } catch { /* */ } }
    if (w.document.readyState === 'complete') setTimeout(go, 350)
    else w.addEventListener('load', () => setTimeout(go, 350))
    return
  }
  setApercu(html)
}

export function imprimerApercuIframe(iframe) {
  const w = iframe?.contentWindow
  if (!w) return
  try { w.focus(); w.print() } catch { /* */ }
}
