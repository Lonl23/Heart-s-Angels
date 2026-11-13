import { escHtml, htmlDocumentA4 } from '@/modules/souhaits/documentA4'
import { lblMouv, fmtQuand } from './stockSchema'

const CSS = `
  .titre-doc { font-family:'Newsreader',Georgia,serif; font-size:20px; color:#0E4A5A; margin:0 0 4px; }
  .sous { font-size:11.5px; color:#5A6A6D; margin:0 0 12px; }
  .meta { font-size:10.5px; color:#8CA0A3; margin:0 0 12px; }
  table.tbl { width:100%; border-collapse:collapse; }
  table.tbl th {
    background:#0E4A5A !important; color:#fff; font-size:9px; text-transform:uppercase;
    letter-spacing:.6px; padding:6px 8px; text-align:left; font-weight:700;
  }
  table.tbl td { padding:5px 8px; font-size:10.5px; border-bottom:1px solid #EAF0F1; vertical-align:top; }
  table.tbl tr:nth-child(even) td { background:#F6FAFB; }
  table.tbl thead { display:table-header-group; }
  table.tbl tr { break-inside:avoid; }
  .muted { color:#8CA0A3; font-size:10.5px; }
`

function ligne(m) {
  const qte = m.quantite == null ? '' : String(Number(m.quantite))
  const devers = m.lieu_origine_nom
    ? `${m.lieu_origine_nom} → ${m.lieu_nom || '—'}`
    : (m.lieu_nom || m.lieu || '')
  return [
    escHtml(fmtQuand(m.created_at || m.quand)),
    escHtml(lblMouv(m.type)),
    escHtml(m.article || m.lieu_nom || '—'),
    escHtml(qte),
    escHtml(m.lot || ''),
    escHtml(devers),
    escHtml(m.motif || ''),
    escHtml(m.par_nom || m.par || ''),
  ]
}

export function nomFichierRapportStock(kind) {
  const d = new Date().toISOString().slice(0, 10)
  return `Rapport-stock-${kind}-${d}.html`
}

export async function htmlRapportStock({ titre, sousTitre, items }) {
  const rows = (items || []).map(m => '<tr>' + ligne(m).map(c => '<td>' + c + '</td>').join('') + '</tr>').join('')
  const inner = `<div>
    <h1 class="titre-doc">${escHtml(titre)}</h1>
    ${sousTitre ? `<p class="sous">${escHtml(sousTitre)}</p>` : ''}
    <p class="meta">Heart's Angels ASBL — ${escHtml((items || []).length)} ligne${(items || []).length > 1 ? 's' : ''} · généré le ${escHtml(fmtQuand(new Date().toISOString()))}</p>
    <table class="tbl">
      <thead><tr>
        <th>Quand</th><th>Type</th><th>Article</th><th>Qté</th>
        <th>Lot</th><th>Lieu</th><th>Motif</th><th>Par</th>
      </tr></thead>
      <tbody>
        ${rows || '<tr><td colspan="8" class="muted">Aucun mouvement.</td></tr>'}
      </tbody>
    </table>
  </div>`
  return htmlDocumentA4(titre, inner, CSS)
}
