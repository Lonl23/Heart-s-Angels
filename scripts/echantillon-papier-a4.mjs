/**
 * Génère un PDF A4 d’exemple (rapport stock, plusieurs pages)
 * pour vérifier en-tête + pied officiels sur chaque page.
 */
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  cssPapierOfficiel, envelopperPapier, htmlDocument,
} from '../src/modules/souhaits/documentA4.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = '/tmp/papier-a4'

function dataUrl(rel, mime) {
  const buf = readFileSync(join(ROOT, rel))
  return `data:${mime};base64,${buf.toString('base64')}`
}

function lignes(n) {
  const rows = []
  for (let i = 1; i <= n; i++) {
    rows.push(`<tr>
      <td>15/10/2026 10:${String(i).padStart(2, '0')}</td>
      <td>Sortie</td>
      <td>Article déclassé ${i}</td>
      <td>${(i % 5) + 1}</td>
      <td>LOT-${1000 + i}</td>
      <td>Réserve → —</td>
      <td>${i % 3 === 0 ? 'Casse' : i % 3 === 1 ? 'Don' : 'Destruction'}</td>
      <td>Laurent</td>
    </tr>`)
  }
  return rows.join('')
}

const CSS_TABLE = `
  .titre-doc { font-family: Georgia, serif; font-size: 20px; color: #0E4A5A; margin: 0 0 4px; }
  .sous { font-size: 11.5px; color: #5A6A6D; margin: 0 0 12px; }
  table.tbl { width: 100%; border-collapse: collapse; }
  table.tbl th {
    background: #0E4A5A !important; color: #fff; font-size: 9px; text-transform: uppercase;
    letter-spacing: .6px; padding: 6px 8px; text-align: left; font-weight: 700;
  }
  table.tbl td { padding: 5px 8px; font-size: 10.5px; border-bottom: 1px solid #EAF0F1; }
  table.tbl tr:nth-child(even) td { background: #F6FAFB; }
  table.tbl thead { display: table-header-group; }
  table.tbl tr { break-inside: avoid; }
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #243033; }
`

const papier = {
  entete: dataUrl('public/papier/entete.png', 'image/png'),
  pied: dataUrl('public/papier/pied.png', 'image/png'),
}
const inner = `<div>
  <h1 class="titre-doc">Rapport de déclassement</h1>
  <p class="sous">Casse, don, destruction, cession — sorties hors mission. Document d’exemple (plusieurs pages).</p>
  <table class="tbl">
    <thead><tr>
      <th>Quand</th><th>Type</th><th>Article</th><th>Qté</th>
      <th>Lot</th><th>Lieu</th><th>Motif</th><th>Par</th>
    </tr></thead>
    <tbody>${lignes(42)}</tbody>
  </table>
</div>`
const html = htmlDocument(
  'Rapport de déclassement — échantillon',
  envelopperPapier(inner, papier),
  cssPapierOfficiel() + CSS_TABLE,
)

mkdirSync(OUT, { recursive: true })
const htmlPath = join(OUT, 'echantillon-declasse.html')
const pdfPath = join(OUT, 'echantillon-declasse.pdf')
writeFileSync(htmlPath, html)

const chrome = spawnSync('timeout', [
  '25',
  '/opt/google/chrome/chrome',
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-pdf-header-footer',
  '--user-data-dir=/tmp/chrome-pdf-ha',
  `--print-to-pdf=${pdfPath}`,
  htmlPath,
], { encoding: 'utf8' })
if (chrome.status !== 0 && chrome.status !== 124) {
  console.error(chrome.stderr || chrome.stdout)
  process.exit(chrome.status || 1)
}
if (!existsSync(pdfPath)) {
  console.error('PDF non généré')
  process.exit(1)
}

const ppm = spawnSync('pdftoppm', ['-png', '-r', '150', pdfPath, join(OUT, 'page')], { encoding: 'utf8' })
if (ppm.status !== 0) {
  console.error(ppm.stderr)
  process.exit(ppm.status || 1)
}

console.log('HTML', htmlPath)
console.log('PDF', pdfPath)
for (const dir of ['/opt/cursor/artifacts', '/cursor/stores/self/artifacts']) {
  try {
    mkdirSync(dir, { recursive: true })
    copyFileSync(pdfPath, join(dir, 'rapport_declasse_entete_pied.pdf'))
    copyFileSync(join(OUT, 'page-1.png'), join(dir, 'rapport_a4_page1_entete_pied.png'))
    copyFileSync(join(OUT, 'page-2.png'), join(dir, 'rapport_a4_page2_entete_pied.png'))
  } catch (e) { console.warn(dir, e.message) }
}
