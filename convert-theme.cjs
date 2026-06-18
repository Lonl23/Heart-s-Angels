#!/usr/bin/env node
/* ============================================================================
 * Heart's Angels — Thématisation des couleurs
 * Convertit les couleurs codées en dur (texte foncé, fonds blancs/crème,
 * bordures noires translucides) en variables CSS (var(--...)) pour que le
 * mode sombre s'applique partout.
 *
 * SÛR : ne touche PAS à color:'white' (texte blanc sur boutons), ni aux
 * couleurs de marque (cyan, teal, rose, vert, ambre), ni aux dégradés.
 *
 * Usage :  node convert-theme.cjs           (modifie les fichiers)
 *          node convert-theme.cjs --dry      (aperçu, ne modifie rien)
 *
 * ⚠️  Fais un commit git AVANT de lancer, puis relis le diff.
 * ========================================================================== */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(process.cwd(), 'src')
const DRY = process.argv.includes('--dry')

// 1) Texte foncé → tokens de texte (valeurs uniquement utilisées en avant-plan)
const TEXT = {
  '#1A1514': 'var(--text)', '#1a1514': 'var(--text)',
  '#1A1A1A': 'var(--text)', '#1a1a1a': 'var(--text)',
  '#4A4340': 'var(--text-2)', '#4a4340': 'var(--text-2)',
  '#3A3530': 'var(--text-2)', '#3a3530': 'var(--text-2)',
  '#7A7470': 'var(--text-muted)', '#7a7470': 'var(--text-muted)',
  '#6B6259': 'var(--text-muted)', '#6b6259': 'var(--text-muted)',
  '#A8A39D': 'var(--text-faint)', '#a8a39d': 'var(--text-faint)',
  '#8A8681': 'var(--text-faint)', '#8a8681': 'var(--text-faint)',
}
// 2) Fonds crème/neutres → fond de page (toujours des arrière-plans)
const BG = ['#FDFAF6','#FAFAF8','#FFFCF8','#F5F0EB','#FBF8F3','#FAF8F4']

function convert(src) {
  let n = 0
  let out = src

  // Texte foncé (quel que soit le contexte : color, const C, bordures…)
  for (const [hex, varname] of Object.entries(TEXT)) {
    const re = new RegExp(`(['"])${hex}\\1`, 'g')
    out = out.replace(re, (m, q) => { n++; return `${q}${varname}${q}` })
  }

  // Fonds crème → var(--bg)
  for (const hex of BG) {
    const re = new RegExp(`(['"])${hex}\\1`, 'gi')
    out = out.replace(re, (m, q) => { n++; return `${q}var(--bg)${q}` })
  }

  // Blanc UNIQUEMENT en arrière-plan → var(--card)  (jamais color:'white')
  out = out.replace(
    /(background(?:Color)?\s*:\s*)(['"])(white|#fff|#ffffff|#FFFFFF|#FFF|#fefefe)\2/g,
    (m, pre, q) => { n++; return `${pre}${q}var(--card)${q}` }
  )

  // Bordures noires translucides → var(--border)
  out = out.replace(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.\d+\s*\)/g, (m) => { n++; return 'var(--border)' })

  return { out, n }
}

function walk(dir, acc=[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes:true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(jsx?|tsx?)$/.test(e.name)) acc.push(p)
  }
  return acc
}

if (!fs.existsSync(ROOT)) { console.error('Dossier src/ introuvable. Lance la commande à la racine du projet.'); process.exit(1) }

let total = 0, files = 0
for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8')
  const { out, n } = convert(src)
  if (n > 0) {
    files++; total += n
    console.log(`${n.toString().padStart(4)}  ${path.relative(process.cwd(), file)}`)
    if (!DRY) fs.writeFileSync(file, out)
  }
}
console.log(`\n${DRY ? '[aperçu] ' : ''}${total} remplacements dans ${files} fichiers.`)
if (DRY) console.log('Relance sans --dry pour appliquer.')
