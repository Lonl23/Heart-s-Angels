import { escHtml, htmlDocument } from '@/modules/souhaits/documentA4'
import {
  FORFAIT_JOUR, PLAFOND_AN, ORG_FRAIS, FORFAIT_JUSQUA,
  fmtEuro, fmtDateCourte, titrePeriode, totalForfait,
} from './constantes'

const CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: 'Karla', 'Helvetica Neue', Arial, sans-serif;
    color: #1A1514; font-size: 11.5px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  @page { size: A4; margin: 12mm; }
  .page { max-width: 190mm; margin: 0 auto; padding: 8mm 10mm 12mm; }
  .org { font-size: 13px; font-weight: 700; color: #0E4A5A; letter-spacing: .2px; }
  h1 {
    font-family: 'Newsreader', Georgia, serif;
    font-size: 16.5px; font-weight: 600; color: #0E4A5A;
    margin: 6px 0 14px; line-height: 1.25;
  }
  .intro { font-size: 12px; line-height: 1.45; margin: 0 0 12px; }
  .intro b { font-weight: 700; }
  .periode {
    display: inline-block; border: 1.5px solid #0E4A5A; border-radius: 6px;
    padding: 5px 12px; font-weight: 700; color: #0E4A5A; margin: 0 0 14px; font-size: 12px;
  }
  h2 {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
    color: #0E4A5A; background: #EDF4F5; border-left: 4px solid #7E9B76;
    padding: 6px 10px; margin: 14px 0 8px; border-radius: 4px;
  }
  table { width: 100%; border-collapse: collapse; }
  th {
    background: #0E4A5A; color: #fff; font-size: 9px; text-transform: uppercase;
    letter-spacing: .5px; padding: 6px 8px; text-align: left; font-weight: 700;
  }
  td { padding: 6px 8px; border-bottom: 1px solid #E3EBEC; font-size: 11px; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tr.total td { font-weight: 700; background: #F6FAFB; border-bottom: none; }
  .blank td { color: #C7D3D5; height: 22px; }
  .grand {
    margin-top: 14px; border: 2px solid #0E4A5A; border-radius: 8px;
    padding: 10px 14px; display: flex; justify-content: space-between; align-items: baseline;
    font-weight: 700; color: #0E4A5A;
  }
  .grand .lab { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
  .grand .val { font-size: 18px; font-family: 'Newsreader', Georgia, serif; }
  .legal { margin-top: 12px; font-size: 9px; color: #5A5552; line-height: 1.4; }
  .sigs { display: flex; gap: 24px; margin-top: 22px; }
  .sig { flex: 1; }
  .sig .who { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #0E4A5A; }
  .sig .line { border-bottom: 1px solid #C7D3D5; height: 42px; margin: 8px 0 6px; }
  .sig .hint { font-size: 10px; color: #7A7470; }
  .note-km { font-size: 10.5px; color: #5A5552; font-style: italic; margin: 4px 0 8px; }
  @media print {
    .page { max-width: none; padding: 0; }
  }
`

function lignesTableau(lignes, vides) {
  const rows = (lignes || []).map(l => (
    '<tr>'
    + `<td>${escHtml(fmtDateCourte(l.date) || l.date || '')}</td>`
    + `<td>${escHtml(l.activite || 'Souhait')}</td>`
    + `<td>${escHtml(l.lieu || '')}</td>`
    + `<td class="num">${escHtml(fmtEuro(l.montant))}</td>`
    + '</tr>'
  ))
  const n = Math.max(0, vides - rows.length)
  for (let i = 0; i < n; i++) {
    rows.push('<tr class="blank"><td>&nbsp;</td><td></td><td></td><td class="num"></td></tr>')
  }
  return rows.join('')
}

export function nomFichierNote(note, profil) {
  const qui = [profil?.nom, profil?.prenom].filter(Boolean).join('-') || 'volontaire'
  const safe = qui.replace(/[^\p{L}\p{N}]+/gu, '-')
  const m = String(note.periode_mois || '').padStart(2, '0')
  return `Note-de-frais-${safe}-${note.periode_annee}-${m}.html`
}

export function htmlNoteFrais({ note, profil }) {
  const nom = [profil?.prenom, profil?.nom].filter(Boolean).join(' ') || '—'
  const lignes = note.lignes_forfait || []
  const totF = totalForfait(lignes)
  const periode = titrePeriode(note.periode_mois, note.periode_annee)
  const iban = note.iban || '—'

  const body = `<div class="page">
    <div class="org">${escHtml(ORG_FRAIS)}</div>
    <h1>Note de frais volontariat — système des frais forfaitaires</h1>
    <p class="intro">Je soussigné(e) <b>${escHtml(nom)}</b> sollicite de ${escHtml(ORG_FRAIS)} le remboursement des frais suivants, exposés dans le cadre de mes activités bénévoles, sur le compte bancaire <b>${escHtml(iban)}</b>.</p>
    <div class="periode">Période : ${escHtml(periode)}</div>

    <h2>Défraiements forfaitaires de volontariat</h2>
    <table>
      <thead><tr><th>Date(s)</th><th>Activités</th><th>Lieu</th><th class="num">Total</th></tr></thead>
      <tbody>
        ${lignesTableau(lignes, 4)}
        <tr class="total"><td colspan="3">Total défraiement forfaitaire</td><td class="num">${escHtml(fmtEuro(totF))}</td></tr>
      </tbody>
    </table>

    <h2>Frais de déplacement</h2>
    <p class="note-km">Les kilomètres personnels ne sont pas pris en compte pour le moment. Cette section reste à 0,00&nbsp;€.</p>
    <table>
      <thead><tr><th>Date</th><th>Activités / lieux de départ et d’arrivée</th><th class="num">Km A/R</th><th class="num">Total</th></tr></thead>
      <tbody>
        <tr class="blank"><td>&nbsp;</td><td></td><td class="num">—</td><td class="num">${escHtml(fmtEuro(0))}</td></tr>
        <tr class="blank"><td>&nbsp;</td><td></td><td class="num"></td><td class="num"></td></tr>
        <tr class="total"><td colspan="3">Total frais de déplacements</td><td class="num">${escHtml(fmtEuro(0))}</td></tr>
      </tbody>
    </table>

    <div class="grand">
      <span class="lab">Total note de frais</span>
      <span class="val">${escHtml(fmtEuro(totF))}</span>
    </div>

    <p class="legal">
      Plafond forfaitaire : max. ${escHtml(fmtEuro(FORFAIT_JOUR))} par jour et ${escHtml(fmtEuro(PLAFOND_AN))} par an
      (montants valables jusqu’au ${escHtml(FORFAIT_JUSQUA)}).
      Les frais de déplacement (max. 2&nbsp;000 km, barème voiture) ne sont pas remboursés actuellement.
    </p>

    <div class="sigs">
      <div class="sig">
        <div class="who">Le volontaire</div>
        <div class="line"></div>
        <div class="hint">${escHtml(nom)} — Nom, prénom</div>
      </div>
      <div class="sig">
        <div class="who">Pour l’ASBL</div>
        <div class="line"></div>
        <div class="hint">Nom, prénom — Fonction</div>
      </div>
    </div>
  </div>`

  return htmlDocument(`Note de frais — ${nom} — ${periode}`, body, CSS)
}
