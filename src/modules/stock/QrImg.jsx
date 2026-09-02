import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** DK-11221 : 23 × 23 mm à 300 dpi (QL-810W). */
const DPI = 300
const TAILLE_PX = Math.round(23 * DPI / 25.4) // 272

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

/** Aperçu réel de l’étiquette 23 × 23 mm (nom + lot sous le QR). */
export function ApercuEtiq({ titre, ligne2, token, size = 184 }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!token) { setSrc(''); return }
    let stop = false
    rendreEtiquetteDataUrl({ titre, ligne2, token })
      .then(url => { if (!stop) setSrc(url) })
      .catch(() => { if (!stop) setSrc('') })
    return () => { stop = true }
  }, [titre, ligne2, token])
  if (!token) return null
  return (
    <div style={{ textAlign:'center' }}>
      {src
        ? <img src={src} alt={titre || 'étiquette'} width={size} height={size}
            style={{ background:'#fff', border:'1px solid var(--border)' }} />
        : <div style={{ width:size, height:size, background:'#fff', border:'1px solid var(--border)', margin:'0 auto' }} />}
      <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:6 }}>Aperçu 23 × 23 mm (DK-11221)</div>
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

/** Grille Word en cases 23 × 23 mm (aperçu / planche). Pour Brother : PNG ou CSV. */
export async function telechargerWord(etiqs) {
  const list = (etiqs || []).filter(e => e?.token)
  if (!list.length) return
  const cells = []
  for (const e of list) {
    const url = await rendreEtiquetteDataUrl(e)
    cells.push(`<td><img src="${url}" width="87" height="87" alt="${esc(e.titre || 'QR')}" /></td>`)
  }
  let rows = ''
  const cols = 7
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
  td { width: 23mm; height: 23mm; padding: 0; border: 0.25pt dotted #ccc; }
  img { width: 23mm; height: 23mm; }
</style></head>
<body>
<p>Heart's Angels — 23 × 23 mm. Nom et lot sous le QR : aide pour coller au bon article. Ensuite on scanne.</p>
<table>${rows}</table>
</body></html>`
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'etiquettes-hearts-angels.doc'
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

export async function rendreEtiquetteDataUrl({ titre, ligne2, lot, token }) {
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
