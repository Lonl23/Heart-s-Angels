import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import {
  SUPPORTS_DIFFUSION_PHOTOS, SUPPORTS_DIFFUSION_DEFAUT,
  niveauPhotosPourStockage, lblAutorisationPhotos,
} from './missionSchema'
import { urlPublic } from '@/lib/telechargerFichier'
import enteteUrl from '@/assets/papier/entete.png?url'
import piedUrl from '@/assets/papier/pied.png?url'

const MM = 2.83465
const PAGE_W = 210 * MM
const PAGE_H = 297 * MM
const MARGIN_X = 16 * MM
const HEADER_H = 40.4 * MM
const FOOTER_H = 20 * MM
const Y_MIN = FOOTER_H + 6 * MM
const Y_START = PAGE_H - HEADER_H - 8 * MM
const INK = rgb(0.12, 0.14, 0.16)
const TEAL = rgb(0.05, 0.29, 0.35)

function dateBe(v) {
  if (!v) return '…………'
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('fr-BE')
}

function trait(v, fallback = '………………………………') {
  const s = String(v || '').trim()
  return s || fallback
}

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

async function fetchBytes(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Ressource introuvable (${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

async function embedDataUrl(pdf, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i)
  if (!m) return null
  const raw = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0))
  return /png/i.test(m[1]) ? pdf.embedPng(raw) : pdf.embedJpg(raw)
}

function wrap(font, text, size, maxW) {
  const words = winAnsi(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return ['']
  const lines = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(next, size) <= maxW) cur = next
    else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

async function creerContexte() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const [enteteBytes, piedBytes] = await Promise.all([
    fetchBytes(enteteUrl || urlPublic('papier/entete.png')),
    fetchBytes(piedUrl || urlPublic('papier/pied.png')),
  ])
  const entete = await pdf.embedPng(enteteBytes)
  const pied = await pdf.embedPng(piedBytes)

  const ctx = {
    pdf, font, bold, entete, pied,
    page: null,
    y: Y_START,
    maxW: PAGE_W - 2 * MARGIN_X,
  }

  ctx.nouvellePage = () => {
    ctx.page = pdf.addPage([PAGE_W, PAGE_H])
    ctx.page.drawImage(entete, { x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H })
    ctx.page.drawImage(pied, { x: 0, y: 9 * MM, width: PAGE_W, height: 7.3 * MM })
    ctx.y = Y_START
  }

  ctx.assurer = (besoin = 14) => {
    if (ctx.y - besoin < Y_MIN) ctx.nouvellePage()
  }

  ctx.texte = (text, { font: f = font, size = 10, color = INK, x = MARGIN_X } = {}) => {
    ctx.assurer(size + 2)
    ctx.page.drawText(winAnsi(text), { x, y: ctx.y, size, font: f, color })
    ctx.y -= size + 3
  }

  ctx.paragraphe = (text, { font: f = font, size = 10, lineH = 12, color = INK, x = MARGIN_X, maxW = ctx.maxW } = {}) => {
    for (const line of wrap(f, text, size, maxW)) {
      ctx.assurer(lineH)
      ctx.page.drawText(line, { x, y: ctx.y, size, font: f, color })
      ctx.y -= lineH
    }
  }

  ctx.espace = (n = 6) => { ctx.y -= n }

  ctx.nouvellePage()
  return ctx
}

/** PDF consentement libre & éclairé rempli + signature. */
export async function genererPdfConsentement(data = {}) {
  const ctx = await creerContexte()
  const { font, bold } = ctx
  const size = 9.2
  const lineH = 12

  ctx.texte('Consentement Libre & Éclairé', { font: bold, size: 14, color: TEAL })
  ctx.texte('(Art.8 de la loi du 22/08/2002 relative aux droits du patient)', {
    size: 9, color: rgb(0.25, 0.3, 0.32),
  })
  ctx.texte("Réalisation d'un dernier souhait en Soins Palliatifs", { font: bold, size: 10 })
  ctx.espace(6)

  ctx.paragraphe(
    `Je soussigné(e), ${trait(data.nom)}, né(e) le ${dateBe(data.ddn)}, résidant ${trait(data.adresse, '…………………………………………')}, registre national ${trait(data.niss, '………………')}, déclare que :`,
    { size, lineH },
  )
  ctx.espace(4)

  const bullets = [
    `J'ai sollicité l'asbl « Heart's Angels » pour la réalisation de mon souhait suivant : ${trait(data.souhait_texte)}.`,
    `Ce souhait est réalisé en accord avec mon médecin référent, Dr ${trait(data.medecin, '………………')}, et l'équipe médicale de l'asbl « Heart's Angels ».`,
    "J'accepte que les informations médicales adaptées et nécessaires à la réalisation du souhait soient mises à disposition de l'équipe médicale de l'asbl « Heart's Angels » afin de permettre la prise en charge optimale de ma santé.",
    `Je suis conscient et j'ai parfaitement compris les risques, conséquences et contre-indications encourus avec ma pathologie lors du souhait, qui sont : ${trait(data.risques)}.`,
    `Ces risques m'ont été expliqués par mon médecin référent et le référent de l'asbl « Heart's Angels » en date du ${dateBe(data.risques_expliques_le)}. Je donne mon consentement « libre et éclairé » à la réalisation de mon souhait ayant compris les risques encourus.`,
    'Je confirme que ma situation médicale ne me permet pas de réaliser ce souhait par mes propres moyens ou via ma famille/proches.',
    "Par la présente, je dégage l'asbl « Heart's Angels » ainsi que le médecin de toute responsabilité dans le cadre du programme de réalisation d'un dernier souhait et je comprends que cette exonération lie également ma succession, mes héritiers, mes représentants et mes ayants droit.",
    "L'asbl « Heart's Angels » s'engage à mettre les moyens appropriés suivants, afin de réaliser mon souhait dans les conditions idéales : 1 ambulance avec un équipage médical composé d'un infirmier et d'un ambulancier.",
    "L'asbl « Heart's Angels » s'engage à mettre tout en oeuvre pour un accompagnement de qualité en accord avec les directives médicales convenues et en toujours en lien avec mon médecin référent au cours de la réalisation de mon souhait.",
    "L'asbl « Heart's Angels » s'engage à offrir gratuitement l'accompagnement (véhicule adapté, personnel médical, ...) de mon souhait, aucun frais ne me sera facturé.",
    `Les frais des services externes suivants sont à ma charge : restauration, activités, ${trait(data.frais_externes, '……………………')}.`,
    "L'asbl « Heart's Angels » pourra à tout moment arrêter, reporter ou adapter avec mon accord la réalisation de mon souhait si elle estime que ma situation médicale n'est plus compatible avec celle-ci.",
    "J'ai la possibilité à tout moment d'annuler ou adapter ma demande.",
  ]

  for (const b of bullets) {
    ctx.assurer(lineH)
    ctx.page.drawText('•', { x: MARGIN_X, y: ctx.y, size, font, color: TEAL })
    ctx.paragraphe(b, { size, lineH, x: MARGIN_X + 10, maxW: ctx.maxW - 10 })
    ctx.espace(2)
  }

  ctx.espace(6)
  ctx.texte(`Fait à ${trait(data.lieu, 'Awirs')}, le ${dateBe(data.date)}.`, { font: bold, size: 10 })
  ctx.texte(`Signataire : ${trait(data.nom)} - ${trait(data.qualite, 'Patient')}`, { size: 9.5 })
  ctx.espace(4)

  const sig = await embedDataUrl(ctx.pdf, data.signature)
  if (sig) {
    const sw = 160
    const sh = (sig.height / sig.width) * sw
    ctx.assurer(sh + 4)
    ctx.page.drawImage(sig, { x: MARGIN_X, y: ctx.y - sh, width: sw, height: sh })
  } else {
    ctx.texte('(Signature manquante)', { size: 9, color: rgb(0.6, 0.2, 0.2) })
  }

  return ctx.pdf.save()
}

/** PDF autorisation droit à l'image rempli + signature. */
export async function genererPdfDroitImage(data = {}) {
  const ctx = await creerContexte()
  const { font, bold } = ctx
  const size = 9.5
  const lineH = 12.5

  ctx.texte("Autorisation du droit à l'image", { font: bold, size: 14, color: TEAL })
  ctx.texte("Réalisation d'un dernier souhait en Soins Palliatifs", { font: bold, size: 10 })
  ctx.espace(6)

  ctx.paragraphe(
    `Je soussigné(e), ${trait(data.nom)}, né(e) le ${dateBe(data.ddn)}, résidant ${trait(data.adresse, '…………………………………………')}, registre national ${trait(data.niss, '………………')},`,
    { size, lineH },
  )
  ctx.espace(8)

  const niveau = data.niveau || 'oui'
  const cases = [
    { v: 'oui', l: "autorise expressément l'asbl « Heart's Angels » à réaliser des images et vidéos de ma personne lors de la réalisation de mon souhait réalisé par l'asbl." },
    { v: 'oui_de_dos', l: "autorise expressément l'asbl « Heart's Angels » à réaliser des images et vidéos de ma personne lors de la réalisation de mon souhait réalisé par l'asbl. Toutefois, je ne souhaite pas que mon visage soit visible sur les images réalisées." },
    { v: 'refus', l: "refuse toute réalisation d'images et vidéos de ma personne lors de la réalisation de mon souhait réalisé par l'asbl." },
  ]

  for (const c of cases) {
    ctx.assurer(28)
    const coche = niveau === c.v ? 'X' : ' '
    ctx.page.drawRectangle({
      x: MARGIN_X, y: ctx.y - 1, width: 10, height: 10,
      borderColor: TEAL, borderWidth: 1,
    })
    ctx.page.drawText(coche, { x: MARGIN_X + 1.5, y: ctx.y, size: 9, font: bold, color: TEAL })
    ctx.paragraphe(c.l, { size, lineH, x: MARGIN_X + 16, maxW: ctx.maxW - 16 })
    ctx.espace(6)
  }

  if (niveau !== 'refus') {
    ctx.paragraphe(
      "Ces images/vidéos réalisées ont uniquement pour objectif la promotion des missions de l'asbl. Elles pourront être diffusées sur les supports suivants (mentions refusées rayées) :",
      { size, lineH },
    )
    ctx.espace(2)
    const supports = Array.isArray(data.supports) && data.supports.length
      ? data.supports
      : [...SUPPORTS_DIFFUSION_DEFAUT]
    for (const s of SUPPORTS_DIFFUSION_PHOTOS) {
      const ok = supports.includes(s.v)
      ctx.assurer(lineH)
      const label = `• ${s.l}${ok ? '' : '  (refusé)'}`
      ctx.page.drawText(winAnsi(label), {
        x: MARGIN_X + 8, y: ctx.y, size,
        font: ok ? font : bold,
        color: ok ? INK : rgb(0.55, 0.2, 0.2),
      })
      if (!ok) {
        const w = bold.widthOfTextAtSize(winAnsi(s.l), size)
        ctx.page.drawLine({
          start: { x: MARGIN_X + 18, y: ctx.y + 3 },
          end: { x: MARGIN_X + 18 + w, y: ctx.y + 3 },
          thickness: 1,
          color: rgb(0.55, 0.2, 0.2),
        })
      }
      ctx.y -= lineH
    }
    ctx.espace(4)
  }

  const stock = niveauPhotosPourStockage(niveau, data.supports)
  ctx.texte(`Choix enregistré : ${lblAutorisationPhotos(stock) || niveau}`, { font: bold, size: 9, color: TEAL })
  ctx.espace(4)

  for (const c of [
    "L'asbl « Heart's Angels » s'interdit expressément de procéder à une exploitation des images ou séquences vidéo susceptibles de porter atteinte à la vie privée ou à la réputation de ma personne ou toute autre exploitation préjudiciable.",
    "La présente autorisation est accordée pour une durée non limitée dans le temps et valable après mon décès.",
    "Je confirme que mon autorisation est donnée en connaissance de cause sans contrepartie. Je manifeste ainsi mon intérêt et mon soutien aux missions de l'asbl. Je ne pourrai prétendre à aucune rémunération du fait des utilisations des images réalisées.",
  ]) {
    ctx.paragraphe(c, { size, lineH })
    ctx.espace(4)
  }

  ctx.espace(2)
  ctx.texte(`Fait à ${trait(data.lieu, 'Awirs')}, le ${dateBe(data.date)}.`, { font: bold, size: 10 })
  ctx.texte(`Signataire : ${trait(data.nom)} - ${trait(data.qualite, 'Patient')}`, { size: 9.5 })
  ctx.espace(4)

  const sig = await embedDataUrl(ctx.pdf, data.signature)
  if (sig) {
    const sw = 160
    const sh = (sig.height / sig.width) * sw
    ctx.assurer(sh + 4)
    ctx.page.drawImage(sig, { x: MARGIN_X, y: ctx.y - sh, width: sw, height: sh })
  } else {
    ctx.texte('(Signature manquante)', { size: 9, color: rgb(0.6, 0.2, 0.2) })
  }

  return ctx.pdf.save()
}
