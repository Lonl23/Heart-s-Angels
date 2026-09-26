import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const jsonPath = path.join(root, 'public/native-version.json')

function readVersion() {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
}

function writeVersion(v) {
  fs.writeFileSync(jsonPath, JSON.stringify(v, null, 2) + '\n')
}

function bumpPatch(name) {
  const parts = String(name || '1.0.0').split('.').map(n => parseInt(n, 10) || 0)
  while (parts.length < 3) parts.push(0)
  parts[2] += 1
  return parts.join('.')
}

function apply(v) {
  const gradle = path.join(root, 'android/app/build.gradle')
  let g = fs.readFileSync(gradle, 'utf8')
  g = g.replace(/versionCode\s+\d+/, `versionCode ${v.versionCode}`)
  g = g.replace(/versionName\s+"[^"]*"/, `versionName "${v.versionName}"`)
  fs.writeFileSync(gradle, g)

  const pbx = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj')
  let p = fs.readFileSync(pbx, 'utf8')
  p = p.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${v.versionCode};`)
  p = p.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = "${v.versionName}";`)
  fs.writeFileSync(pbx, p)

  const pkgPath = path.join(root, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  pkg.version = v.versionName
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

function copyApk() {
  const src = path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk')
  const distDir = path.join(root, 'dist')
  const dest = path.join(distDir, 'Heart-s-Angels.apk')
  if (!fs.existsSync(src)) {
    console.error('APK introuvable :', src)
    process.exit(1)
  }
  fs.mkdirSync(distDir, { recursive: true })
  fs.copyFileSync(src, dest)
  const { size } = fs.statSync(dest)
  console.log(`APK copiée dans dist/Heart-s-Angels.apk (${Math.round(size / 1024)} Ko)`)
}

const cmd = process.argv[2]
if (cmd === 'bump') {
  const v = readVersion()
  v.versionCode = Number(v.versionCode || 0) + 1
  v.versionName = bumpPatch(v.versionName)
  v.apk = v.apk || 'Heart-s-Angels.apk'
  writeVersion(v)
  apply(v)
  console.log(`Version native ${v.versionName} (${v.versionCode})`)
} else if (cmd === 'apply') {
  apply(readVersion())
} else if (cmd === 'copy-apk') {
  copyApk()
} else {
  console.error('Usage : node scripts/native-version.mjs bump|apply|copy-apk')
  process.exit(1)
}
