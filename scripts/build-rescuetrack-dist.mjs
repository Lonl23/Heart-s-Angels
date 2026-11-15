import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'public', 'rescuetrack')
const sortie = path.join(root, 'dist-rescuetrack')

fs.rmSync(sortie, { recursive: true, force: true })
fs.mkdirSync(sortie, { recursive: true })
for (const nom of fs.readdirSync(source)) {
  fs.cpSync(path.join(source, nom), path.join(sortie, nom), { recursive: true })
}
fs.copyFileSync(path.join(root, 'public', 'config.js'), path.join(sortie, 'config.js'))

const attendus = ['index.html', 'province.html', 'evenements.html', 'event.html', 'patient.html', 'search.html', 'dashboard.html', 'be.svg', 'config.js', 'style.css', 'login.js', 'paths.js']
const manquants = attendus.filter(nom => !fs.existsSync(path.join(sortie, nom)))
if (manquants.length) {
  console.error('Fichiers RescueTrack manquants :', manquants.join(', '))
  process.exit(1)
}
console.log(`dist-rescuetrack prêt (${fs.readdirSync(sortie).length} fichiers), index à la racine.`)
