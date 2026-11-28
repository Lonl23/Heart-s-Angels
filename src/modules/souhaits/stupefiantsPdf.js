import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { stupefiantsMission, bilanLigne } from './stupefiantsSchema.js'

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

async function embedDataUrl(pdf, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i)
  if (!m) return null
  const raw = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0))
  return /png/i.test(m[1]) ? pdf.embedPng(raw) : pdf.embedJpg(raw)
}

/**
 * PDF registre stupéfiants (remise / usages / retour + signatures).
 * Intégré au rapport médical envoyé.
 */
export async function genererPdfStupefiants({ souhait, stups: stupsIn } = {}) {
  const stups = stupefiantsMission(stupsIn || souhait?.mission)
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([595.28, 841.92])
  const ink = rgb(0.08, 0.1, 0.12)
  const muted = rgb(0.35, 0.38, 0.4)
  let y = 800

  const draw = (text, x, yy, size = 10, f = font, color = ink) => {
    page.drawText(t(text).slice(0, 110), { x, y: yy, size, font: f, color })
  }

  const nom = [souhait?.beneficiaire_prenom, souhait?.beneficiaire_nom].filter(Boolean).join(' ') || 'Beneficiaire'
  draw('Heart\'s Angels — Registre stupefiants', 40, y, 14, bold)
  y -= 18
  draw(`Beneficiaire : ${nom}`, 40, y, 11, bold)
  y -= 14
  const date = String(souhait?.date_souhaitee || souhait?.date_fin || '').slice(0, 10)
  if (date) { draw(`Date du souhait : ${date}`, 40, y, 10, font, muted); y -= 14 }
  y -= 8

  const headers = [
    { l: 'Produit', x: 40, w: 150 },
    { l: 'Remis', x: 195, w: 45 },
    { l: 'Utilise', x: 245, w: 45 },
    { l: 'Retour', x: 295, w: 45 },
    { l: 'Lot / DLC', x: 345, w: 200 },
  ]
  headers.forEach(h => draw(h.l, h.x, y, 9, bold))
  y -= 4
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.6, color: muted })
  y -= 14

  if (!stups.lignes.length) {
    draw('Aucun stupefiant encode.', 40, y, 10, font, muted)
    y -= 20
  } else {
    for (const l of stups.lignes) {
      if (y < 120) break
      const b = bilanLigne(l)
      const prod = [l.produit, l.dosage].filter(Boolean).join(' · ')
      const lot = [l.lot && `lot ${l.lot}`, l.dlc && `DLC ${l.dlc}`].filter(Boolean).join(' · ')
      draw(prod, 40, y, 9, bold)
      draw(String(b.remise), 195, y, 9)
      draw(String(b.utilisee), 245, y, 9)
      draw(String(b.retour), 295, y, 9)
      draw(lot, 345, y, 8, font, muted)
      y -= 12
      for (const u of (l.usages || [])) {
        if (y < 100) break
        const ligneU = ['  →', u.heure, u.dose, u.notes].filter(Boolean).join(' ')
        draw(ligneU, 48, y, 8, font, muted)
        y -= 11
      }
      y -= 4
    }
  }

  async function blocSig(label, bloc) {
    if (!bloc) return
    if (y < 160) return
    y -= 10
    draw(label, 40, y, 11, bold)
    y -= 14
    draw(`Date : ${String(bloc.date || '').slice(0, 10)}`, 40, y, 9)
    y -= 12
    draw(`Remettant : ${bloc.remettant_nom || ''}`, 40, y, 9)
    draw(`Receveur : ${bloc.receveur_nom || ''}`, 300, y, 9)
    y -= 8
    const imgR = await embedDataUrl(pdf, bloc.signature_remettant)
    const imgV = await embedDataUrl(pdf, bloc.signature_receveur)
    const h = 48
    if (imgR) {
      const w = Math.min(160, imgR.width * h / imgR.height)
      page.drawImage(imgR, { x: 40, y: y - h, width: w, height: h })
    }
    if (imgV) {
      const w = Math.min(160, imgV.width * h / imgV.height)
      page.drawImage(imgV, { x: 300, y: y - h, width: w, height: h })
    }
    if (imgR || imgV) y -= h + 8
    else y -= 8
  }

  await blocSig('Signatures — remise depart', stups.remise)
  await blocSig('Signatures — retour base', stups.retour)

  return pdf.save()
}

export const NOM_PDF_STUPEFIANTS = 'registre-stupefiants.pdf'
