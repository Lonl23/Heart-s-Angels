import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** DK-11221 : 23 × 23 mm à 300 dpi (QL-810W) — articles. */
const DPI = 300
const TAILLE_PX = Math.round(23 * DPI / 25.4) // 272

/** DK-11201 : 90,3 × 29 mm — emplacements (QR au-dessus, nom en dessous). */
const LIEU_W = Math.round(90.3 * DPI / 25.4) // 1067
const LIEU_H = Math.round(29 * DPI / 25.4)   // 343

export default function QrImg({ value, size = 160, label }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!value) { setSrc(''); return }
    let stop = false
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then(url => { if (!stop) setSrc(url) })
      .catch(() => { if (!stop) setSrc('') })
    return () => { stop = true }
  }, [value, size])
  if (!value) return null
  return (
    <div style={{ textAlign:'center' }}>
      {src
        ? <img src={src} alt={label || 'QR'} width={size} height={size} style={{ background:'#fff' }} />
        : <div style={{ width:size, height:size, background:'#fff', border:'1px solid var(--border)' }} />}
      {label && <div style={{ fontSize:12, fontWeight:600, marginTop:6, color:'var(--text)' }}>{label}</div>}
    </div>
  )
}

/** Aperçu réel : 23 × 23 mm (article) ou 90,3 × 29 mm (emplacement). */
export function ApercuEtiq({ titre, ligne2, token, format = 'article', size }) {
  const lieu = format === 'lieu'
  const w = size || (lieu ? 420 : 184)
  const h = lieu ? Math.round(w * LIEU_H / LIEU_W) : w
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!token) { setSrc(''); return }
    let stop = false
    rendreEtiquetteDataUrl({ titre, ligne2, token, format })
      .then(url => { if (!stop) setSrc(url) })
      .catch(() => { if (!stop) setSrc('') })
    return () => { stop = true }
  }, [titre, ligne2, token, format])
  if (!token) return null
  return (
    <div style={{ textAlign:'center' }}>
      {src
        ? <img src={src} alt={titre || 'étiquette'} width={w} height={h}
            style={{ background:'#fff', border:'1px solid var(--border)', borderRadius: lieu ? 12 : 0, maxWidth:'100%' }} />
        : <div style={{ width:w, height:h, background:'#fff', border:'1px solid var(--border)', margin:'0 auto', borderRadius: lieu ? 12 : 0 }} />}
      <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:6 }}>
        {lieu ? 'Aperçu 90,3 × 29 mm (DK-11201)' : 'Aperçu 23 × 23 mm (DK-11221)'}
      </div>
    </div>
  )
}

export function imprimerEtiquette(e) {
  telechargerWord([e])
}

export async function telechargerPng(e) {
  if (!e?.token) return
  const url = await rendreEtiquetteDataUrl(e)
  const a = document.createElement('a')
  a.href = url
  a.download = slug(e.titre || 'etiquette') + '.png'
  a.click()
}

export async function copierPng(e) {
  const token = typeof e === 'string' ? e : e?.token
  if (!token || !navigator.clipboard?.write) return false
  const payload = typeof e === 'string' ? { token } : e
  const url = await rendreEtiquetteDataUrl(payload)
  const blob = await (await fetch(url)).blob()
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

/** Grille Word. Articles : 23 × 23 mm. Emplacements : 90,3 × 29 mm. */
export async function telechargerWord(etiqs) {
  const list = (etiqs || []).filter(e => e?.token)
  if (!list.length) return
  const lieu = list.every(e => e.format === 'lieu')
  const cells = []
  for (const e of list) {
    const url = await rendreEtiquetteDataUrl(e)
    if (lieu) {
      cells.push(`<td><img src="${url}" width="256" height="82" alt="${esc(e.titre || 'QR')}" /></td>`)
    } else {
      cells.push(`<td><img src="${url}" width="87" height="87" alt="${esc(e.titre || 'QR')}" /></td>`)
    }
  }
  let rows = ''
  const cols = lieu ? 2 : 7
  for (let i = 0; i < cells.length; i += cols) {
    rows += `<tr>${cells.slice(i, i + cols).join('')}${'<td></td>'.repeat(Math.max(0, cols - (cells.length - i)))}</tr>`
  }
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8" />
<title>Étiquettes Heart's Angels</title>
<style>
  @page { size: A4; margin: 8mm; }
  body { font-family: Calibri, Arial, sans-serif; color: #111; }
  p { font-size: 10pt; color: #555; }
  table { border-collapse: collapse; }
  td { padding: 1mm; border: 0.25pt dotted #ccc; vertical-align: middle; }
  ${lieu
    ? 'td { width: 90.3mm; height: 29mm; } img { width: 90.3mm; height: 29mm; }'
    : 'td { width: 23mm; height: 23mm; } img { width: 23mm; height: 23mm; }'}
</style></head>
<body>
<p>${lieu
    ? "Heart's Angels — emplacements 90,3 × 29 mm. QR en haut, nom en bas. Ensuite on scanne."
    : "Heart's Angels — 23 × 23 mm. Nom et lot sous le QR : aide pour coller au bon article. Ensuite on scanne."}</p>
<table>${rows}</table>
</body></html>`
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = lieu ? 'etiquettes-lieux-hearts-angels.doc' : 'etiquettes-hearts-angels.doc'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/** CSV pour P-touch Editor : colonnes nom, lot, qr. */
export function telechargerCsv(etiqs) {
  const list = (etiqs || []).filter(e => e?.token)
  if (!list.length) return
  const lignes = ['nom,lot,qr']
  for (const e of list) {
    lignes.push([csv(e.titre), csv(e.lot || ''), csv(e.token)].join(','))
  }
  const blob = new Blob(['\ufeff', lignes.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'etiquettes-hearts-angels.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export async function rendreEtiquetteDataUrl({ titre, ligne2, lot, token, format }) {
  if (format === 'lieu') return rendreEtiquetteLieuDataUrl({ titre, token })
  const size = TAILLE_PX
  const pad = 8
  const textH = 54
  const qrPx = size - pad * 2 - textH
  const qrUrl = await QRCode.toDataURL(token, {
    width: qrPx * 2,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  })
  const img = await charger(qrUrl)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(img, pad, pad, qrPx, qrPx)

  const ligneLot = ligne2 || (lot ? `Lot ${lot}` : '')
  const maxW = size - pad * 2
  const cx = size / 2
  let y = pad + qrPx + 3
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#111111'
  ctx.font = 'bold 26px Arial, Helvetica, sans-serif'
  ctx.fillText(couper(ctx, titre || '', maxW), cx, y)
  y += 27
  ctx.fillStyle = '#333333'
  ctx.font = '22px Arial, Helvetica, sans-serif'
  if (ligneLot) ctx.fillText(couper(ctx, ligneLot, maxW), cx, y)
  return canvas.toDataURL('image/png')
}

/** Emplacement : bandeau 90,3 × 29 mm, QR centré en haut, nom en dessous. */
async function rendreEtiquetteLieuDataUrl({ titre, token }) {
  const w = LIEU_W
  const h = LIEU_H
  const padX = 36
  const padY = 22
  const qrPx = Math.round(13.5 * DPI / 25.4) // ~14 mm, comme le modèle P-touch
  const qrUrl = await QRCode.toDataURL(token, {
    width: qrPx * 2,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  })
  const img = await charger(qrUrl)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, 1, 1, w - 2, h - 2, 36)
  ctx.fill()
  ctx.strokeStyle = '#bdbdbd'
  ctx.lineWidth = 3
  ctx.stroke()
  const qx = (w - qrPx) / 2
  const qy = padY
  ctx.drawImage(img, qx, qy, qrPx, qrPx)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#111111'
  const maxW = w - padX * 2
  const nom = String(titre || '')
  let size = 72
  ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`
  while (size > 32 && ctx.measureText(nom).width > maxW) {
    size -= 2
    ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`
  }
  const textY = qy + qrPx + (h - (qy + qrPx) - padY) / 2
  ctx.fillText(couper(ctx, nom, maxW), w / 2, textY)
  return canvas.toDataURL('image/png')
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function charger(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
function couper(ctx, texte, max) {
  const t = String(texte || '')
  if (ctx.measureText(t).width <= max) return t
  let s = t
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1)
  return s + '…'
}
function slug(s) {
  return String(s || 'qr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'qr'
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')
}
function csv(s) {
  const t = String(s || '')
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}
