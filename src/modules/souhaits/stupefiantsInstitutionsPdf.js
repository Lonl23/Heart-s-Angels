import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { stupefiantsMission, bilanLigne } from './stupefiantsSchema.js'
import pdfModeleUrl from '@/assets/papier/stupefiants-institutions.pdf?url'

const PAGE_H = 841.92
const WHITE = rgb(1, 1, 1)
const INK = rgb(0.05, 0.08, 0.1)

export const NOM_PDF_STUPS_INSTITUTIONS = 'Departs_retours_stupefiants_souhait.pdf'

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

function t(v) {
  return winAnsi(String(v || '').trim())
}

function dateBe(v) {
  if (!v) return ''
  const s = String(v).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return t(v)
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
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

function baseline(y1Top, pad = 1.5) {
  return PAGE_H - y1Top + pad
}

function blanc(page, x0, y0Top, x1, y1Top, pad = 0.5) {
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
  const shown0 = t(text)
  if (!shown0) return
  const h = y1Top - y0Top
  const s = size || Math.min(9.5, Math.max(7, h * 0.72))
  blanc(page, x0, y0Top, x1, y1Top)
  let shown = shown0
  const maxW = x1 - x0 - 2
  while (shown.length > 1 && font.widthOfTextAtSize(shown, s) > maxW) shown = shown.slice(0, -1)
  let drawX = x0 + 1
  if (align === 'center') drawX = x0 + (maxW - font.widthOfTextAtSize(shown, s)) / 2
  page.drawText(shown, {
    x: Math.max(x0, drawX),
    y: baseline(y1Top),
    size: s,
    font,
    color: INK,
  })
}

async function poserSig(pdf, page, dataUrl, x0, y0Top, x1, y1Top) {
  const img = await embedDataUrl(pdf, dataUrl)
  if (!img) return
  const boxW = x1 - x0 - 4
  const boxH = y1Top - y0Top - 4
  const scale = Math.min(boxW / img.width, boxH / img.height)
  const w = img.width * scale
  const h = img.height * scale
  page.drawImage(img, {
    x: x0 + (boxW - w) / 2 + 2,
    y: PAGE_H - y1Top + 2,
    width: w,
    height: h,
  })
}

/** Lignes du tableau (coords PyMuPDF top-left → pdf-lib). */
const ROWS_Y = [
  [350, 365], [370, 385], [390, 405], [410, 425], [430, 445],
  [450, 465], [470, 485], [490, 505], [510, 525], [530, 545],
  [550, 565], [570, 585], [590, 618],
]
const COL = {
  med: [38, 156],
  qDep: [162, 207],
  qRet: [213, 258],
  just: [266, 562],
}

/**
 * Remplit le modèle officiel « Départs & retours stupéfiants souhait ».
 * opts.sansSignature : n’inclut pas les signatures (aperçu / mail).
 */
export async function genererPdfStupefiantsInstitutions({ souhait, stups: stupsIn } = {}, opts = {}) {
  const stups = stupefiantsMission(stupsIn || souhait?.mission)
  const pdf = await PDFDocument.load(await fetchBytes(pdfModeleUrl), { updateMetadata: false })
  const page = pdf.getPages()[0]
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const nom = [souhait?.beneficiaire_prenom, souhait?.beneficiaire_nom].filter(Boolean).join(' ')
  ecrire(page, bold, nom, 200, 157, 380, 170, { size: 10 })
  ecrire(page, font, dateBe(souhait?.date_souhaitee || souhait?.date_fin), 430, 157, 545, 170, {
    size: 10,
    align: 'center',
  })

  const lignes = stups.lignes || []
  for (let i = 0; i < Math.min(lignes.length, ROWS_Y.length); i++) {
    const l = lignes[i]
    const [y0, y1] = ROWS_Y[i]
    const b = bilanLigne(l)
    const med = [l.produit, l.dosage].filter(Boolean).join(' ')
    const just = l.justification
      || (l.usages || []).map(u => [u.dose, u.heure, u.notes].filter(Boolean).join(' ')).filter(Boolean).join(' ; ')
      || ''
    ecrire(page, font, med, COL.med[0], y0, COL.med[1], y1, { size: 8 })
    ecrire(page, font, String(b.remise || ''), COL.qDep[0], y0, COL.qDep[1], y1, { size: 9, align: 'center' })
    ecrire(page, font, stups.retour ? String(b.retour) : '', COL.qRet[0], y0, COL.qRet[1], y1, {
      size: 9,
      align: 'center',
    })
    ecrire(page, font, just, COL.just[0], y0, COL.just[1], y1, { size: 7.5 })
  }

  if (opts.sansSignature !== true) {
    const rem = stups.remise
    const ret = stups.retour
    // Tableau signatures : lignes Institution / HA × colonnes Départ / Retour
    async function caseSig(nom, dataUrl, x0, y0, x1, y1) {
      if (nom) ecrire(page, font, nom, x0 + 2, y0 + 1, x1 - 2, y0 + 11, { size: 6.5 })
      await poserSig(pdf, page, dataUrl, x0, y0 + 10, x1, y1)
    }
    // Départ : remettant = institution, receveur = HA
    await caseSig(rem?.remettant_nom, rem?.signature_remettant, 220, 644, 374, 682)
    await caseSig(rem?.receveur_nom, rem?.signature_receveur, 220, 688, 374, 724)
    // Retour : remettant = HA, receveur = institution
    await caseSig(ret?.receveur_nom, ret?.signature_receveur, 380, 644, 534, 682)
    await caseSig(ret?.remettant_nom, ret?.signature_remettant, 380, 688, 534, 724)
  }

  return pdf.save()
}
