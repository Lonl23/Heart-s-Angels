/** Papier officiel Heart's Angels (modèle en-tête / pied A4). */
export const PAPIER_ENTETE = '/papier/entete.png'
export const PAPIER_PIED = '/papier/pied.png'
/** Hauteurs du chrome (images à 300 dpi, largeur A4 210 mm). */
export const HAUTEUR_ENTETE_MM = 40.4
export const HAUTEUR_PIED_IMG_MM = 7.3
export const HAUTEUR_PIED_MM = 18
export const MARGE_LAT_MM = 16

export function escHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

/** CSS répété sur chaque page A4.
 *  En-tête : thead (prend la place, se répète).
 *  Pied : image en position fixed (collée en bas de feuille) + ligne vide
 *  dans le tfoot pour que le texte ne passe pas dessus. */
export function cssPapierOfficiel() {
  return `
  @page {
    size: A4 portrait;
    margin: 0 0 20mm 0;
    @bottom-center {
      content: "Page " counter(page) " sur " counter(pages);
      font-family: "Arial Narrow", "Franklin Gothic Medium", Calibri, Arial, sans-serif;
      font-size: 10pt;
      color: #111;
    }
  }
  html, body { margin: 0; padding: 0; background: #fff; }
  table.ha-papier { width: 210mm; border-collapse: collapse; table-layout: fixed; }
  table.ha-papier > thead { display: table-header-group; }
  table.ha-papier > tfoot { display: table-footer-group; }
  table.ha-papier > thead > tr > td,
  table.ha-papier > tfoot > tr > td,
  table.ha-papier > tbody > tr > td { border: 0; padding: 0; vertical-align: top; }
  img.ha-papier-entete {
    width: 210mm; height: ${HAUTEUR_ENTETE_MM}mm;
    object-fit: fill; display: block; border: 0;
  }
  .ha-papier-pied-espace { height: ${HAUTEUR_PIED_IMG_MM + 4}mm; }
  .ha-papier-pied {
    position: fixed; left: 0; bottom: 9mm; width: 210mm;
    height: ${HAUTEUR_PIED_IMG_MM}mm; z-index: 10000; pointer-events: none;
  }
  .ha-papier-pied img {
    width: 210mm; height: ${HAUTEUR_PIED_IMG_MM}mm;
    object-fit: fill; display: block; border: 0;
  }
  .ha-papier-corps { padding: 2mm ${MARGE_LAT_MM}mm 2mm; }
  `
}

export function envelopperPapier(inner, { entete, pied }) {
  return '<div class="ha-papier-pied" aria-hidden="true"><img src="' + escHtml(pied) + '" alt=""></div>'
    + '<table class="ha-papier">'
    + '<thead><tr><td><img class="ha-papier-entete" src="' + escHtml(entete) + '" alt=""></td></tr></thead>'
    + '<tfoot><tr><td><div class="ha-papier-pied-espace"></div></td></tr></tfoot>'
    + '<tbody><tr><td class="ha-papier-corps">' + inner + '</td></tr></tbody>'
    + '</table>'
}

let papierCache = null

async function dataUrlDepuis(chemin) {
  const r = await fetch(chemin)
  if (!r.ok) throw new Error('Papier officiel introuvable (' + chemin + ').')
  const blob = await r.blob()
  return await new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })
}

export async function chargerPapier() {
  if (papierCache) return papierCache
  const [entete, pied] = await Promise.all([
    dataUrlDepuis(PAPIER_ENTETE),
    dataUrlDepuis(PAPIER_PIED),
  ])
  papierCache = { entete, pied }
  return papierCache
}

export function htmlDocument(titre, body, css) {
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + escHtml(titre) + '</title>'
    + '<style>' + css + '</style></head><body>' + body + '</body></html>'
}

/** Document A4 isolé, en-tête et pied officiels sur chaque page. */
export async function htmlDocumentA4(titre, inner, css, papier) {
  const p = papier || await chargerPapier()
  return htmlDocument(titre, envelopperPapier(inner, p), cssPapierOfficiel() + (css || ''))
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
    if (typeof setApercu === 'function') setApercu(html)
    else telechargerHtml('document-a4.html', html)
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
  if (typeof setApercu === 'function') setApercu(html)
  else telechargerHtml('document-a4.html', html)
}

export function imprimerApercuIframe(iframe) {
  const w = iframe?.contentWindow
  if (!w) return
  try { w.focus(); w.print() } catch { /* */ }
}
