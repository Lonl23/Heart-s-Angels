import { cheminLieux, lblLieu, lblMode, lblMouv, lblCommande, fmtQuand } from './stockSchema'

function slugDate() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function feuille(XLSX, rows, cols) {
  const header = cols.map(c => c.h)
  const body = (rows || []).map(r => cols.map(c => {
    const v = c.v(r)
    return v == null ? '' : v
  }))
  const ws = XLSX.utils.aoa_to_sheet([header, ...body])
  ws['!cols'] = cols.map(c => ({ wch: c.w || 18 }))
  return ws
}

const LIRE_MOI = [
  ['Heart\'s Angels — Export stock'],
  [''],
  ['Comment faire l\'inventaire'],
  ['1. Exportez ce fichier (bouton « Excel » dans Stock).'],
  ['2. Ouvrez l\'onglet Inventaire.'],
  ['3. Comptez sur le terrain, puis remplissez UNIQUEMENT :'],
  ['    • qte_comptee — pour les boîtes et les pièces (nombre restant)'],
  ['    • pression_comptee — pour l\'oxygène (bar relevé)'],
  ['4. Laissez vide ce que vous n\'avez pas encore compté : ces lignes ne seront pas touchées.'],
  ['5. Ne modifiez pas la colonne id (ni le qr).'],
  ['6. Enregistrez le fichier, puis dans Stock → Importer inventaire.'],
  [''],
  ['Les autres onglets (Articles, Lieux, Fournisseurs, Commandes, Mouvements) sont un export complet en lecture.'],
  ['Les corrections d\'inventaire sont tracées dans Mouvements (motif « inventaire Excel »).'],
]

export async function exporterStockExcel(data, lieux) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const wsHelp = XLSX.utils.aoa_to_sheet(LIRE_MOI)
  wsHelp['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(wb, wsHelp, 'Lire-moi')

  XLSX.utils.book_append_sheet(wb, feuille(XLSX, data.unites, [
    { h:'id', w:38, v: r => r.id },
    { h:'qr', w:36, v: r => r.qr },
    { h:'article', w:28, v: r => r.article },
    { h:'mode', w:12, v: r => r.mode },
    { h:'lot', w:14, v: r => r.lot },
    { h:'dlc', w:12, v: r => r.dlc },
    { h:'lieu', w:28, v: r => cheminLieux(lieux, r.lieu_id) || r.lieu || '' },
    { h:'etat', w:12, v: r => r.etat },
    { h:'qte_systeme', w:14, v: r => r.mode === 'oxygene' ? '' : r.qte_restante },
    { h:'qte_comptee', w:16, v: () => '' },
    { h:'pression_systeme', w:16, v: r => r.mode === 'oxygene' ? r.pression_bar : '' },
    { h:'pression_comptee', w:18, v: () => '' },
  ]), 'Inventaire')

  XLSX.utils.book_append_sheet(wb, feuille(XLSX, data.articles, [
    { h:'id', w:38, v: r => r.id },
    { h:'nom', w:28, v: r => r.nom },
    { h:'mode', w:12, v: r => r.mode },
    { h:'categorie', w:16, v: r => r.categorie },
    { h:'unite', w:10, v: r => r.unite },
    { h:'qte_defaut', w:12, v: r => r.qte_defaut },
    { h:'stock_minimal', w:14, v: r => r.stock_minimal },
    { h:'volume_l', w:10, v: r => r.volume_l },
    { h:'fournisseur', w:22, v: r => r.fournisseur },
    { h:'ref_fournisseur', w:18, v: r => r.ref_fournisseur },
  ]), 'Articles')

  XLSX.utils.book_append_sheet(wb, feuille(XLSX, data.lieux, [
    { h:'id', w:38, v: r => r.id },
    { h:'nom', w:24, v: r => r.nom },
    { h:'type', w:18, v: r => lblLieu(r.type) },
    { h:'chemin', w:36, v: r => cheminLieux(lieux, r.id) },
    { h:'qr', w:36, v: r => r.qr },
  ]), 'Lieux')

  XLSX.utils.book_append_sheet(wb, feuille(XLSX, data.fournisseurs, [
    { h:'id', w:38, v: r => r.id },
    { h:'nom', w:24, v: r => r.nom },
    { h:'contact', w:18, v: r => r.contact },
    { h:'telephone', w:16, v: r => r.telephone },
    { h:'email', w:24, v: r => r.email },
    { h:'adresse', w:32, v: r => r.adresse },
    { h:'notes', w:28, v: r => r.notes },
  ]), 'Fournisseurs')

  XLSX.utils.book_append_sheet(wb, feuille(XLSX, data.commandes, [
    { h:'article', w:28, v: r => r.article },
    { h:'fournisseur', w:22, v: r => r.fournisseur },
    { h:'quantite', w:12, v: r => r.quantite },
    { h:'statut', w:14, v: r => lblCommande(r.statut) },
    { h:'date_rappel', w:14, v: r => r.date_rappel },
    { h:'date_commande', w:14, v: r => r.date_commande },
    { h:'notes', w:28, v: r => r.notes },
  ]), 'Commandes')

  XLSX.utils.book_append_sheet(wb, feuille(XLSX, data.mouvements, [
    { h:'quand', w:20, v: r => fmtQuand(r.quand) },
    { h:'type', w:18, v: r => lblMouv(r.type) },
    { h:'article', w:28, v: r => r.article },
    { h:'quantite', w:12, v: r => r.quantite },
    { h:'lot', w:14, v: r => r.lot },
    { h:'de', w:22, v: r => r.lieu_origine },
    { h:'vers', w:22, v: r => r.lieu },
    { h:'motif', w:24, v: r => r.motif },
    { h:'par', w:18, v: r => r.par },
  ]), 'Mouvements')

  const nom = `stock-hearts-angels-${slugDate()}.xlsx`
  XLSX.writeFile(wb, nom)
  return nom
}

function normHeader(h) {
  return String(h || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

const ALIAS = {
  id: ['id'],
  qr: ['qr', 'qr_token', 'token'],
  qte_comptee: ['qte_comptee', 'quantite_comptee', 'qte_comptee_remplir', 'compte', 'comptee', 'quantite_comptee_remplir'],
  pression_comptee: ['pression_comptee', 'pression_comptee_remplir', 'bar_compte', 'pression'],
}

function col(map, key) {
  const aliases = ALIAS[key] || [key]
  for (const a of aliases) {
    if (map[a] != null) return map[a]
  }
  return null
}

export async function lireInventaireExcel(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const name = wb.SheetNames.find(n => /^inventaire$/i.test(n)) || wb.SheetNames.find(n => /invent/i.test(n)) || wb.SheetNames[0]
  if (!name) throw new Error('Aucune feuille dans le fichier.')
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: false })
  if (!rows.length) throw new Error('La feuille « Inventaire » est vide.')

  const sample = rows[0]
  const map = {}
  Object.keys(sample).forEach(h => { map[normHeader(h)] = h })

  const kId = col(map, 'id')
  const kQr = col(map, 'qr')
  const kQte = col(map, 'qte_comptee')
  const kPres = col(map, 'pression_comptee')
  if (!kId && !kQr) throw new Error('Colonnes id ou qr manquantes. Réexportez un fichier depuis Stock.')
  if (!kQte && !kPres) throw new Error('Colonne qte_comptee (ou pression_comptee) manquante. Réexportez un fichier depuis Stock.')

  const lignes = []
  for (const r of rows) {
    const id = kId ? String(r[kId] || '').trim() : ''
    const qr = kQr ? String(r[kQr] || '').trim() : ''
    if (!id && !qr) continue
    const qte = kQte ? String(r[kQte] ?? '').trim() : ''
    const pres = kPres ? String(r[kPres] ?? '').trim() : ''
    const ligne = { id: id || null, qr: qr || null }
    if (qte !== '') ligne.qte_comptee = qte
    if (pres !== '') ligne.pression_comptee = pres
    lignes.push(ligne)
  }
  const aRemplir = lignes.filter(l => l.qte_comptee != null || l.pression_comptee != null)
  return { feuille: name, total: rows.length, lignes, aRemplir }
}

export function resumeImport(parsed) {
  const n = parsed.aRemplir.length
  const vides = parsed.lignes.length - n
  return `${parsed.lignes.length} ligne(s) reconnue(s) · ${n} avec un compte · ${vides} laissée(s) vide(s) (inchangées)`
}

export { lblMode }
