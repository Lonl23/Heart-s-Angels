import { escHtml, htmlDocument } from '@/modules/souhaits/documentA4'
import {
  ORG_FRAIS, FORFAIT_JUSQUA, TAUX_KM, MAX_KM,
  fmtEuro, fmtDateCourte, titrePeriode, totalForfait, totalKm, nomCompletNote,
} from './constantes'

const ORANGE = '#EC7C30'
const N_FORFAIT = 8
const N_KM = 8

const CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: Calibri, 'Segoe UI', Arial, Helvetica, sans-serif;
    color: #000; font-size: 10pt;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  @page { size: A4; margin: 12mm 14mm 14mm; }
  .page { width: 182mm; margin: 0 auto; }
  .head { position: relative; min-height: 28mm; margin-bottom: 2mm; }
  .org {
    text-align: center; font-style: italic; font-size: 13.5pt;
    padding-top: 8mm; margin: 0;
  }
  .logo {
    position: absolute; right: 0; top: 0;
    width: 24mm; height: 24mm; object-fit: contain;
  }
  .titre {
    border: 1px solid #000; text-align: center; color: ${ORANGE};
    font-size: 14.5pt; font-weight: 700; letter-spacing: .2px;
    padding: 4px 8px 5px; margin: 0 0 8px;
  }
  .intro {
    text-align: center; font-size: 9.5pt; line-height: 1.35;
    margin: 0 4mm 8px;
  }
  .intro b { font-weight: 700; }
  .intro .asbl { font-style: italic; font-weight: 700; }
  .periode {
    text-align: center; color: ${ORANGE}; font-weight: 700; font-size: 13.5pt;
    border-top: 1px solid #000; border-bottom: 1.6px solid #000;
    padding: 3px 0 4px; margin: 0 0 0;
  }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.bloc { margin: 0; }
  td, th {
    border: 1px solid #000; padding: 2px 4px; text-align: center;
    vertical-align: middle; font-size: 9.5pt; font-weight: 400;
  }
  th { font-weight: 400; height: 9mm; }
  .th-2 { line-height: 1.15; }
  .sec td {
    border: 1px solid #000; color: ${ORANGE}; font-style: italic; font-weight: 700;
    font-size: 9.5pt; padding: 3px 6px 2px; text-align: center;
  }
  .legal {
    display: block; font-weight: 400; font-style: italic; font-size: 9.5pt;
    color: ${ORANGE}; margin-top: 1px;
  }
  tr.data td { height: 5.2mm; }
  tr.tot td { height: 9mm; color: ${ORANGE}; font-weight: 700; font-style: italic; }
  tr.tot td.vide { color: #000; font-weight: 400; font-style: normal; border-right: 1px solid #000; }
  .grand-wrap { display: flex; margin-top: 0; }
  .grand-wrap .sp { flex: 0 0 32%; }
  .grand-wrap table { flex: 1; }
  .grand td {
    color: ${ORANGE}; font-weight: 700; font-size: 11pt; height: 8mm;
    font-style: normal;
  }
  .sigs {
    display: flex; margin-top: 10mm; padding: 0 8mm;
  }
  .sig { flex: 1; font-size: 11pt; }
  .sig .who { margin-bottom: 2mm; }
  .sig .img {
    height: 18mm; display: flex; align-items: center; justify-content: flex-start;
  }
  .sig .img img { max-height: 18mm; max-width: 55mm; }
  .sig .line { margin-top: 1mm; }
  @media print {
    .page { width: auto; }
  }
`

function padRows(lignes, n, cells) {
  const out = []
  for (let i = 0; i < n; i++) {
    const l = lignes[i]
    out.push('<tr class="data">' + cells(l, i) + '</tr>')
  }
  return out.join('')
}

export function nomFichierNote(note, profil) {
  const qui = nomCompletNote(profil).replace(/[^\p{L}\p{N}]+/gu, '-') || 'volontaire'
  const m = String(note.periode_mois || '').padStart(2, '0')
  return `Note-de-frais-${qui}-${note.periode_annee}-${m}.html`
}

export function htmlNoteFrais({ note, profil, logoDataUrl }) {
  const nom = nomCompletNote(profil)
  const lignes = note.lignes_forfait || []
  const lignesKm = note.lignes_km || []
  const totF = totalForfait(lignes)
  const totK = Number.isFinite(Number(note.total_km)) ? Number(note.total_km) : totalKm(lignesKm)
  const tot = Number.isFinite(Number(note.total)) ? Number(note.total) : Math.round((totF + totK) * 100) / 100
  const periode = titrePeriode(note.periode_mois, note.periode_annee)
  const iban = note.iban || '—'
  const sigV = note.signature_volontaire
  const sigA = note.signature_asbl
  const nomV = note.signature_volontaire_nom || nom
  const nomA = note.signature_asbl_nom || ''
  const foncA = note.signature_asbl_fonction || ''

  const logo = logoDataUrl
    ? `<img class="logo" alt="" src="${escHtml(logoDataUrl)}">`
    : ''

  const forfait = padRows(lignes, N_FORFAIT, (l) => (
    `<td>${escHtml(l?.activite || '')}</td>`
    + `<td>${escHtml(l?.lieu || '')}</td>`
    + `<td>${escHtml(l ? fmtDateCourte(l.date) : '')}</td>`
    + `<td>${l ? escHtml(fmtEuro(l.montant)) : ''}</td>`
  ))

  const km = padRows(lignesKm, Math.max(N_KM, lignesKm.length), (l) => (
    `<td>${escHtml(l ? fmtDateCourte(l.date) : '')}</td>`
    + `<td>${escHtml(l?.activite || '')}</td>`
    + `<td>${escHtml(l?.lieux || '')}</td>`
    + `<td>${l && l.km ? escHtml(String(l.km).replace('.', ',')) : ''}</td>`
    + `<td>${l ? escHtml(fmtEuro(l.montant)) : ''}</td>`
  ))

  const imgV = sigV ? `<img src="${escHtml(sigV)}" alt="Signature du volontaire">` : ''
  const imgA = sigA ? `<img src="${escHtml(sigA)}" alt="Signature ASBL">` : ''

  const body = `<div class="page">
    <div class="head">
      <p class="org">${escHtml(ORG_FRAIS)}</p>
      ${logo}
    </div>
    <div class="titre">NOTE DE FRAIS VOLONTARIAT - SYSTÈME DES FRAIS FORFAITAIRES</div>
    <p class="intro">Je soussigné <b>${escHtml(nom)}</b> sollicite de <span class="asbl">${escHtml(ORG_FRAIS)}</span> le remboursement des frais suivants, exposés dans le cadre de mes activités bénévoles, <b>sur le compte bancaire ${escHtml(iban)}</b></p>
    <div class="periode">PERIODE : ${escHtml(periode)}</div>

    <table class="bloc">
      <tr class="sec"><td colspan="4">DEFRAIEMENTS FORFAITAIRES DE VOLONTARIAT<br><span class="legal">(max. 44,02€ par jour et 1760,83 €- montants valables jusqu’au ${escHtml(FORFAIT_JUSQUA)})</span></td></tr>
      <tr>
        <th>ACTIVITES</th>
        <th>LIEU</th>
        <th>DATE(S)</th>
        <th>TOTAL</th>
      </tr>
      ${forfait}
      <tr class="tot">
        <td class="vide" colspan="2"></td>
        <td>Total défraiement forfaitaire</td>
        <td>${escHtml(fmtEuro(totF))}</td>
      </tr>
    </table>

    <table class="bloc" style="margin-top:3mm">
      <tr class="sec"><td colspan="5">FRAIS DE DEPLACEMENT<br><span class="legal">Max. ${escHtml(String(MAX_KM))} kms remboursés à max. ${escHtml(String(TAUX_KM).replace('.', ','))}€/km voiture (montant 2026) , ou en frais réels pour les transports en commun</span></td></tr>
      <tr>
        <th>DATE</th>
        <th>ACTIVITES</th>
        <th class="th-2">LIEUX DE DEPART ET<br>D'ARRIVEE</th>
        <th class="th-2">KILOMETRAGE<br>A/R</th>
        <th>TOTAL</th>
      </tr>
      ${km}
      <tr class="tot">
        <td class="vide" colspan="3"></td>
        <td>Total frais de déplacements</td>
        <td>${escHtml(fmtEuro(totK))}</td>
      </tr>
    </table>

    <div class="grand-wrap">
      <div class="sp"></div>
      <table>
        <tr class="grand">
          <td>TOTAL NOTE DE FRAIS</td>
          <td style="width:22%">${escHtml(fmtEuro(tot))}</td>
        </tr>
      </table>
    </div>

    <div class="sigs">
      <div class="sig">
        <div class="who">Pour l’ASBL,</div>
        <div class="img">${imgA}</div>
        <div class="line">${escHtml(nomA || 'Nom, Prénom')}</div>
        <div class="line">${escHtml(foncA || 'Fonction')}</div>
      </div>
      <div class="sig">
        <div class="who">Le volontaire</div>
        <div class="img">${imgV}</div>
        <div class="line">${escHtml(nomV || 'Nom, Prénom')}</div>
      </div>
    </div>
  </div>`

  return htmlDocument(`Note de frais — ${nom} — ${periode}`, body, CSS)
}

let logoCache = null
export async function chargerLogoNote() {
  if (logoCache) return logoCache
  try {
    const r = await fetch('/icons/ha-logo-rond.png')
    if (!r.ok) return ''
    const blob = await r.blob()
    logoCache = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
    return logoCache
  } catch {
    return ''
  }
}
