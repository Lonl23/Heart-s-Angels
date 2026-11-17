import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { SUPPORTS_DIFFUSION_DEFAUT } from './missionSchema'
import pdfConsentementUrl from '@/assets/papier/consentement-libre-eclaire.pdf?url'
import pdfDroitImageUrl from '@/assets/papier/autorisation-droit-image.pdf?url'

const PAGE_H = 841.92
const WHITE = rgb(1, 1, 1)
const INK = rgb(0.05, 0.08, 0.1)

/** Helvetica WinAnsi : caractères hors jeu → équivalents sûrs. */
function winAnsi(s) {
  return String(s ?? '')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'OE')
}

function dateBe(v) {
  if (!v) return ''
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v)
  if (Number.isNaN(d.getTime())) return String(v)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function txt(v) {
  return winAnsi(String(v || '').trim())
}

async function fetchBytes(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`PDF modèle introuvable (${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

async function embedDataUrl(pdf, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i)
  if (!m) return null
  const raw = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0))
  return /png/i.test(m[1]) ? pdf.embedPng(raw) : pdf.embedJpg(raw)
}

/** PyMuPDF top-left → pdf-lib baseline (bottom-left). */
function baseline(y1Top, pad = 1.5) {
  return PAGE_H - y1Top + pad
}

function blanc(page, x0, y0Top, x1, y1Top, pad = 0.6) {
  page.drawRectangle({
    x: x0 - pad,
    y: PAGE_H - y1Top - pad,
    width: (x1 - x0) + pad * 2,
    height: (y1Top - y0Top) + pad * 2,
    color: WHITE,
    borderWidth: 0,
  })
}

function ecrire(page, font, text, x0, y0Top, x1, y1Top, { size, align = 'left' } = {}) {
  const t = txt(text)
  if (!t) return
  const h = y1Top - y0Top
  const s = size || Math.min(10, Math.max(7.5, h * 0.78))
  blanc(page, x0, y0Top, x1, y1Top)
  let drawX = x0 + 1
  const maxW = x1 - x0 - 2
  let shown = t
  while (shown.length > 1 && font.widthOfTextAtSize(shown, s) > maxW) {
    shown = shown.slice(0, -1)
  }
  if (align === 'center') {
    drawX = x0 + (maxW - font.widthOfTextAtSize(shown, s)) / 2
  }
  page.drawText(shown, {
    x: Math.max(x0, drawX),
    y: baseline(y1Top),
    size: s,
    font,
    color: INK,
  })
}

/** Remplit une zone multi-lignes (pointillés successifs). */
function ecrireZone(page, font, text, lignes, size = 9) {
  const t = txt(text)
  if (!t) return
  for (const [x0, y0, x1, y1] of lignes) blanc(page, x0, y0, x1, y1)
  const words = t.split(/\s+/).filter(Boolean)
  let wi = 0
  for (const [x0, y0, x1, y1] of lignes) {
    if (wi >= words.length) break
    const maxW = x1 - x0 - 2
    let line = ''
    while (wi < words.length) {
      const next = line ? `${line} ${words[wi]}` : words[wi]
      if (font.widthOfTextAtSize(next, size) > maxW) break
      line = next
      wi += 1
    }
    if (!line && wi < words.length) {
      // mot trop long : tronquer
      let w = words[wi]
      while (w.length > 1 && font.widthOfTextAtSize(w, size) > maxW) w = w.slice(0, -1)
      line = w
      wi += 1
    }
    if (line) {
      page.drawText(line, {
        x: x0 + 1,
        y: baseline(y1),
        size,
        font,
        color: INK,
      })
    }
  }
}

function coche(page, font, x, y0Top, y1Top) {
  const size = Math.min(11, (y1Top - y0Top) * 0.95)
  page.drawText('X', {
    x: x + 0.8,
    y: baseline(y1Top, 0.5),
    size,
    font,
    color: INK,
  })
}

function rayer(page, x0, yMidTop, x1) {
  const y = PAGE_H - yMidTop
  page.drawLine({
    start: { x: x0, y },
    end: { x: x1, y },
    thickness: 1.1,
    color: INK,
  })
}

async function chargerModele(url) {
  const pdf = await PDFDocument.load(await fetchBytes(url), { updateMetadata: false })
  const page = pdf.getPages()[0]
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  return { pdf, page, font, bold }
}

async function poserSignature(pdf, page, dataUrl, box) {
  const img = await embedDataUrl(pdf, dataUrl)
  if (!img) return
  const [x0, y0Top, x1, y1Top] = box
  const maxW = x1 - x0
  const maxH = y1Top - y0Top
  const scale = Math.min(maxW / img.width, maxH / img.height)
  const w = img.width * scale
  const h = img.height * scale
  page.drawImage(img, {
    x: x0,
    y: PAGE_H - y0Top - h,
    width: w,
    height: h,
  })
}

/** PDF consentement = modèle officiel + champs + signature. */
export async function genererPdfConsentement(data = {}) {
  const { pdf, page, font, bold } = await chargerModele(pdfConsentementUrl)

  // Identité (coords = PDF officiel, origine haut-gauche)
  ecrire(page, font, data.nom, 166.6, 192.8, 330.8, 204.5, { size: 9.5 })
  ecrire(page, font, dateBe(data.ddn), 107.6, 204.6, 167.1, 216.2, { size: 8.5, align: 'center' })

  const adr = txt(data.adresse)
  if (adr) {
    const l1max = 330.8 - 223.0 - 2
    let l1 = adr
    let l2 = ''
    if (font.widthOfTextAtSize(adr, 8.5) > l1max) {
      const words = adr.split(/\s+/)
      l1 = ''
      for (const w of words) {
        const next = l1 ? `${l1} ${w}` : w
        if (font.widthOfTextAtSize(next, 8.5) > l1max) {
          l2 = words.slice(words.indexOf(w)).join(' ')
          break
        }
        l1 = next
      }
    }
    ecrire(page, font, l1, 223.0, 204.6, 330.8, 216.2, { size: 8.5 })
    if (l2) ecrire(page, font, l2, 56.6, 216.4, 330.5, 228.0, { size: 8.5 })
    else blanc(page, 56.6, 216.4, 330.5, 228.0)
  }

  ecrire(page, font, data.niss, 124.1, 228.5, 216.3, 239.7, { size: 8.5 })

  ecrireZone(page, font, data.souhait_texte, [
    [92.6, 299.4, 536.6, 311.0],
  ], 9)

  ecrire(page, font, data.medecin, 353.2, 312.0, 494.2, 323.6, { size: 9 })

  ecrireZone(page, font, data.risques, [
    [235.8, 372.7, 538.5, 384.0],
    [92.6, 384.5, 538.3, 395.8],
    [92.6, 396.2, 538.4, 407.5],
  ], 8.8)

  ecrire(page, font, dateBe(data.risques_expliques_le), 92.6, 420.3, 153.6, 431.9, { size: 8, align: 'center' })

  ecrireZone(page, font, data.frais_externes, [
    [92.6, 601.5, 536.5, 613.1],
  ], 9)

  ecrire(page, font, data.lieu || 'Awirs', 81.3, 662.2, 182.9, 673.5, { size: 9 })
  ecrire(page, font, dateBe(data.date), 194.1, 662.2, 260.8, 673.5, { size: 8.5, align: 'center' })

  // Nom / qualité + signature dans la colonne « Patient / tuteur »
  const qual = [txt(data.nom), txt(data.qualite || 'Patient')].filter(Boolean).join(' - ')
  if (qual) {
    page.drawText(qual.slice(0, 42), {
      x: 58,
      y: baseline(702, 1),
      size: 7.2,
      font: bold,
      color: INK,
    })
  }

  await poserSignature(pdf, page, data.signature, [58, 705, 175, 768])

  return pdf.save()
}

/** PDF droit à l'image = modèle officiel + champs + cases + signature. */
export async function genererPdfDroitImage(data = {}) {
  const { pdf, page, font, bold } = await chargerModele(pdfDroitImageUrl)

  ecrire(page, font, data.nom, 201.1, 208.7, 356.3, 219.9, { size: 9.5 })
  ecrire(page, font, dateBe(data.ddn), 89.4, 220.4, 148.9, 231.7, { size: 8, align: 'center' })

  const adr = txt(data.adresse)
  if (adr) {
    const l1max = 356.2 - 186.6 - 2
    let l1 = adr
    let l2 = ''
    if (font.widthOfTextAtSize(adr, 8.5) > l1max) {
      const words = adr.split(/\s+/)
      l1 = ''
      for (const w of words) {
        const next = l1 ? `${l1} ${w}` : w
        if (font.widthOfTextAtSize(next, 8.5) > l1max) {
          l2 = words.slice(words.indexOf(w)).join(' ')
          break
        }
        l1 = next
      }
    }
    ecrire(page, font, l1, 186.6, 220.4, 356.2, 231.7, { size: 8.5 })
    if (l2) ecrire(page, font, l2, 56.6, 232.2, 354.6, 243.5, { size: 8.5 })
    else blanc(page, 56.6, 232.2, 354.6, 243.5)
  }

  ecrire(page, font, data.niss, 124.1, 244.0, 216.2, 255.2, { size: 8.5 })

  const niveau = data.niveau || 'oui'
  if (niveau === 'oui') coche(page, bold, 56.6, 303.2, 313.2)
  else if (niveau === 'oui_de_dos') coche(page, bold, 56.6, 338.5, 348.5)
  else if (niveau === 'refus') coche(page, bold, 56.7, 585.8, 595.8)

  if (niveau !== 'refus') {
    const supports = Array.isArray(data.supports) && data.supports.length
      ? data.supports
      : [...SUPPORTS_DIFFUSION_DEFAUT]
    // Lignes supports du PDF officiel (texte à rayer si refusé)
    const lignes = [
      { v: 'presse', x0: 92.6, x1: 191.2, y: 414 },
      { v: 'electronique', x0: 92.6, x1: 197.4, y: 427 },
      { v: 'projections', x0: 92.6, x1: 178.6, y: 440 },
      { v: 'publicites', x0: 92.6, x1: 131.6, y: 452 },
      { v: 'autres', x0: 92.6, x1: 344.6, y: 465 },
    ]
    for (const l of lignes) {
      if (!supports.includes(l.v)) rayer(page, l.x0, l.y, l.x1)
    }
  }

  ecrire(page, font, data.lieu || 'Awirs', 81.3, 620.6, 195.1, 631.9, { size: 9 })
  ecrire(page, font, dateBe(data.date), 206.3, 620.6, 272.9, 631.9, { size: 8.5, align: 'center' })

  const qual = [txt(data.nom), txt(data.qualite || 'Patient')].filter(Boolean).join(' - ')
  if (qual) {
    page.drawText(qual.slice(0, 48), {
      x: 56.7,
      y: baseline(652, 1),
      size: 7.2,
      font: bold,
      color: INK,
    })
  }

  await poserSignature(pdf, page, data.signature, [56, 655, 230, 760])

  return pdf.save()
}
