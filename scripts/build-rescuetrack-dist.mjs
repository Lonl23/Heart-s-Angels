// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Dossier à déposer tel quel à la racine de rescuetrackbeta.heartsangels.be (EX2).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import esbuild from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'public', 'rescuetrack')
const sortie = path.join(root, 'dist-rescuetrack')
const supabase = path.join(root, 'node_modules', '@supabase', 'supabase-js', 'dist', 'index.mjs')

fs.rmSync(sortie, { recursive: true, force: true })
fs.mkdirSync(sortie, { recursive: true })

const scripts = ['login', 'province', 'evenements', 'event', 'patient', 'search', 'dashboard']
const pages = ['index', 'province', 'evenements', 'event', 'patient', 'search', 'dashboard']
await esbuild.build({
  absWorkingDir: source,
  entryPoints: scripts.map(nom => `${nom}.js`),
  bundle: true,
  format: 'esm',
  splitting: true,
  outdir: sortie,
  chunkNames: 'rt-[hash]',
  target: ['es2022'],
  legalComments: 'none',
  plugins: [{
    name: 'supabase-local',
    setup(build) {
      build.onResolve({ filter: /^https:\/\/esm\.sh\/@supabase\/supabase-js/ }, () => ({ path: supabase }))
    },
  }],
})

for (const nom of ['style.css', 'be.svg', '.htaccess', ...pages.map(p => `${p}.html`)]) {
  fs.copyFileSync(path.join(source, nom), path.join(sortie, nom))
}
fs.copyFileSync(path.join(root, 'public', 'config.js'), path.join(sortie, 'config.js'))

const attendus = ['index.html', 'province.html', 'evenements.html', 'event.html', 'patient.html', 'search.html', 'dashboard.html', 'be.svg', 'config.js', 'style.css', '.htaccess', 'login.js']
const manquants = attendus.filter(nom => !fs.existsSync(path.join(sortie, nom)))
if (manquants.length) {
  console.error('Fichiers RescueTrack manquants :', manquants.join(', '))
  process.exit(1)
}
const js = fs.readdirSync(sortie).filter(n => n.endsWith('.js')).map(n => fs.readFileSync(path.join(sortie, n), 'utf8')).join('\n')
if (js.includes('esm.sh')) {
  console.error('Le dist dépend encore de esm.sh')
  process.exit(1)
}
console.log(`dist-rescuetrack prêt (${fs.readdirSync(sortie).length} fichiers) pour rescuetrackbeta.heartsangels.be`)
