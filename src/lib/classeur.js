/** Petit classeur .xlsx, sans la librairie SheetJS.
 *  Écriture au format Office (texte dans les cellules). Lecture du premier
 *  tableau : fichiers produits ici, fichiers réenregistrés par Excel, ou CSV. */

function xml(s) {
  return String(s ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function colLettre(i) {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function nomFeuille(s, pris) {
  let t = String(s || 'Feuille').replace(/[:\\/?*[\]]/g, ' ').trim() || 'Feuille'
  t = t.slice(0, 31)
  let nom = t
  let n = 2
  while (pris.has(nom.toLowerCase())) {
    const suffixe = ` ${n++}`
    nom = (t.slice(0, 31 - suffixe.length) + suffixe).trim()
  }
  pris.add(nom.toLowerCase())
  return nom
}

function cellule(v) {
  if (v == null || v === '') return ''
  if (typeof v === 'number' && Number.isFinite(v)) {
    return `<c r="__R__" t="n"><v>${v}</v></c>`
  }
  const texte = xml(v)
  const espace = /^\s|\s$|\n/.test(String(v)) ? ' xml:space="preserve"' : ''
  return `<c r="__R__" t="inlineStr"><is><t${espace}>${texte}</t></is></c>`
}

function feuilleXml(lignes) {
  const rows = []
  ;(lignes || []).forEach((ligne, r) => {
    const cells = []
    ;(ligne || []).forEach((v, c) => {
      const inner = cellule(v)
      if (!inner) return
      cells.push(inner.replace('__R__', `${colLettre(c)}${r + 1}`))
    })
    if (cells.length) rows.push(`<row r="${r + 1}">${cells.join('')}</row>`)
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rows.join('')}</sheetData></worksheet>`
}

function crc32(bytes) {
  let c = ~0 >>> 0
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i]
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  }
  return (~c) >>> 0
}

function u16(n) {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, n, true)
  return b
}
function u32(n) {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}

function zipStore(files) {
  const enc = new TextEncoder()
  const locals = []
  const centrals = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const data = f.data instanceof Uint8Array ? f.data : enc.encode(f.data)
    const crc = crc32(data)
    const local = new Uint8Array([
      ...[0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0),
      ...name, ...data,
    ])
    const central = new Uint8Array([
      ...[0x50, 0x4b, 0x01, 0x02, 0x14, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
      ...name,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((n, x) => n + x.length, 0)
  const end = new Uint8Array([
    ...[0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00],
    ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset),
    ...u16(0),
  ])
  const parts = [...locals, ...centrals, end]
  const total = parts.reduce((n, x) => n + x.length, 0)
  const out = new Uint8Array(total)
  let p = 0
  for (const part of parts) { out.set(part, p); p += part.length }
  return out
}

export function octetsClasseur(feuilles) {
  const pris = new Set()
  const propres = (feuilles || []).map((f, i) => ({
    nom: nomFeuille(f.nom || `Feuille${i + 1}`, pris),
    xml: feuilleXml(f.lignes),
  }))
  if (!propres.length) propres.push({ nom: 'Feuille1', xml: feuilleXml([]) })
  const enc = new TextEncoder()
  const types = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`,
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`,
    `<Default Extension="xml" ContentType="application/xml"/>`,
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`,
    ...propres.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`),
    `</Types>`,
  ].join('')
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${propres.map((f, i) => `<sheet name="${xml(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
    `</workbook>`
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    propres.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `</Relationships>`
  return zipStore([
    { name: '[Content_Types].xml', data: enc.encode(types) },
    { name: '_rels/.rels', data: enc.encode(rels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRels) },
    ...propres.map((f, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(f.xml) })),
  ])
}

export function telechargerClasseur(feuilles, nomFichier) {
  const octets = octetsClasseur(feuilles)
  const blob = new Blob([octets], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nomFichier
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

function attr(balise, nom) {
  const m = new RegExp(`(?:^|\\s)${nom}="([^"]*)"`).exec(balise)
  return m ? m[1] : ''
}

function decodeXml(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/_x000D_/g, '')
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Ce navigateur ne relit pas un fichier Excel compressé. Enregistrez-le en CSV.')
  }
  const flux = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

async function lireZip(buffer) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  let eocd = -1
  const plancher = Math.max(0, u8.length - 22 - 65535)
  for (let i = u8.length - 22; i >= plancher; i--) {
    if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Fichier Excel illisible.')
  const count = view.getUint16(eocd + 10, true)
  let pos = view.getUint32(eocd + 16, true)
  const files = {}
  const dec = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('Fichier Excel illisible.')
    const method = view.getUint16(pos + 10, true)
    const comp = view.getUint32(pos + 20, true)
    const nameLen = view.getUint16(pos + 28, true)
    const extra = view.getUint16(pos + 30, true)
    const comment = view.getUint16(pos + 32, true)
    const localOff = view.getUint32(pos + 42, true)
    const name = dec.decode(u8.subarray(pos + 46, pos + 46 + nameLen)).replace(/\\/g, '/')
    const localNameLen = view.getUint16(localOff + 26, true)
    const localExtra = view.getUint16(localOff + 28, true)
    const start = localOff + 30 + localNameLen + localExtra
    const slice = u8.subarray(start, start + comp)
    if (method === 0) files[name] = slice
    else if (method === 8) files[name] = await inflateRaw(slice)
    else throw new Error('Enregistrez le classeur au format .xlsx, pas dans un ancien format Excel.')
    pos += 46 + nameLen + extra + comment
  }
  return files
}

function chainesPartagees(xmlText) {
  const out = []
  const si = xmlText.match(/<si\b[^>]*>[\s\S]*?<\/si>/g) || []
  for (const bloc of si) {
    const morceaux = [...bloc.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => decodeXml(m[1]))
    out.push(morceaux.join(''))
  }
  return out
}

function grille(xmlText, chaines) {
  const rows = []
  const blocs = xmlText.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) || []
  for (const bloc of blocs) {
    const rAttr = attr(bloc.slice(0, bloc.indexOf('>')), 'r')
    const r = rAttr ? Number(rAttr) - 1 : rows.length
    if (!rows[r]) rows[r] = []
    const cells = bloc.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) || []
    for (const c of cells) {
      const head = c.slice(0, c.indexOf('>'))
      const ref = attr(head, 'r')
      const pos = ref ? refVers(ref) : null
      if (!pos) continue
      if (!rows[pos.r]) rows[pos.r] = []
      const type = attr(head, 't')
      let valeur = ''
      if (type === 'inlineStr') {
        valeur = [...c.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => decodeXml(m[1])).join('')
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(c)
        const brut = v ? decodeXml(v[1]) : ''
        valeur = type === 's' ? (chaines[Number(brut)] ?? '') : brut
      }
      rows[pos.r][pos.c] = valeur
    }
  }
  return rows
}

function refVers(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)
  if (!m) return null
  let c = 0
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64)
  return { c: c - 1, r: Number(m[2]) - 1 }
}

function objets(grilleRows) {
  const entete = (grilleRows[0] || []).map(h => String(h ?? '').trim())
  const rows = []
  for (let r = 1; r < grilleRows.length; r++) {
    const ligne = grilleRows[r] || []
    if (!ligne.some(v => String(v ?? '').trim() !== '')) continue
    const obj = {}
    entete.forEach((h, c) => { if (h) obj[h] = ligne[c] == null ? '' : String(ligne[c]) })
    rows.push(obj)
  }
  return rows
}

function feuillesDuClasseur(files) {
  const dec = new TextDecoder()
  const wb = dec.decode(files['xl/workbook.xml'] || new Uint8Array())
  const rels = dec.decode(files['xl/_rels/workbook.xml.rels'] || new Uint8Array())
  const cibles = {}
  for (const m of rels.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const id = attr(m[0], 'Id')
    const target = attr(m[0], 'Target')
    if (id && target) cibles[id] = target.replace(/^\//, '').replace(/^xl\//, 'xl/')
  }
  const liste = []
  for (const m of wb.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const nom = decodeXml(attr(m[0], 'name'))
    const id = [...m[0].matchAll(/\br:id="([^"]+)"/g)].map(x => x[1])[0]
    let chemin = cibles[id] || ''
    if (chemin && !chemin.startsWith('xl/')) chemin = `xl/${chemin}`
    liste.push({ nom, chemin })
  }
  return liste
}

function choisirFeuille(liste, vouloir) {
  if (!liste.length) return null
  if (!vouloir) return liste[0]
  return liste.find(f => vouloir(f.nom)) || liste[0]
}

export async function lireTableau(buffer, vouloir) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const files = await lireZip(u8)
  const liste = feuillesDuClasseur(files)
  const feuille = choisirFeuille(liste, vouloir)
  if (!feuille?.chemin || !files[feuille.chemin]) throw new Error('Aucune feuille dans le fichier.')
  const dec = new TextDecoder()
  const chaines = files['xl/sharedStrings.xml'] ? chainesPartagees(dec.decode(files['xl/sharedStrings.xml'])) : []
  const rows = objets(grille(dec.decode(files[feuille.chemin]), chaines))
  return { feuille: feuille.nom, rows }
}

function separateurCsv(ligne) {
  const virgules = (ligne.match(/,/g) || []).length
  const points = (ligne.match(/;/g) || []).length
  return points > virgules ? ';' : ','
}

function couperCsv(texte) {
  const brut = String(texte || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lignes = brut.split('\n').filter(l => l.trim() !== '')
  if (!lignes.length) return []
  const sep = separateurCsv(lignes[0])
  return lignes.map(ligne => {
    const cellules = []
    let cur = ''
    let quote = false
    for (let i = 0; i < ligne.length; i++) {
      const ch = ligne[i]
      if (quote) {
        if (ch === '"') {
          if (ligne[i + 1] === '"') { cur += '"'; i++ } else quote = false
        } else cur += ch
      } else if (ch === '"') quote = true
      else if (ch === sep) { cellules.push(cur); cur = '' }
      else cur += ch
    }
    cellules.push(cur)
    return cellules
  })
}

export function lireCsv(texte) {
  const grilleRows = couperCsv(texte)
  return objets(grilleRows)
}

export async function lireFichierTableau(file, vouloir) {
  const nom = String(file?.name || '').toLowerCase()
  if (nom.endsWith('.xls') && !nom.endsWith('.xlsx')) {
    throw new Error('L’ancien format .xls n’est pas lu. Enregistrez le fichier en .xlsx ou en CSV.')
  }
  const buf = await file.arrayBuffer()
  const u8 = new Uint8Array(buf)
  const estZip = u8[0] === 0x50 && u8[1] === 0x4b
  if (!estZip) {
    const texte = new TextDecoder().decode(u8)
    return { feuille: 'CSV', rows: lireCsv(texte) }
  }
  return lireTableau(u8, vouloir)
}
