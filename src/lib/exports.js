import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const ASBL = "Heart's Angels"
const PRIMARY = [200, 67, 90]   // Rose HA

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy', { locale: fr })
}

function formatMoney(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(n)
}

function pdfHeader(doc, titre, exercice) {
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, 210, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(ASBL, 14, 10)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(titre, 14, 17)
  doc.setTextColor(150, 150, 150)
  doc.setFontSize(8)
  doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm')} · Exercice ${exercice}`, 196, 17, { align: 'right' })
  doc.setTextColor(0, 0, 0)
}

// ── EXPORT COMPTABILITÉ ───────────────────────────────────────────────────────

export async function exportBilanPDF(annee) {
  // Récupérer les données
  const { data: exercice } = await supabase
    .from('exercices').select('*').eq('annee', annee).single()

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, plan_comptable(code,libelle,classe)')
    .eq('exercice_id', exercice.id)
    .order('date_transaction')

  const recettes = transactions?.filter(t => t.type === 'recette') || []
  const depenses = transactions?.filter(t => t.type === 'depense') || []
  const totalR   = recettes.reduce((s, t) => s + t.montant, 0)
  const totalD   = depenses.reduce((s, t) => s + t.montant, 0)
  const resultat = totalR - totalD

  const doc = new jsPDF()
  pdfHeader(doc, `Bilan comptable — Exercice ${annee}`, annee)

  let y = 30

  // Résumé
  doc.setFontSize(11).setFont('helvetica', 'bold')
  doc.text('Résumé de l\'exercice', 14, y); y += 8

  autoTable(doc, {
    startY: y,
    head: [['', 'Montant']],
    body: [
      ['Total des recettes',       formatMoney(totalR)],
      ['Total des dépenses',       formatMoney(totalD)],
      ['Résultat de l\'exercice',  formatMoney(resultat)],
    ],
    styles: { fontSize: 10 },
    headStyles: { fillColor: PRIMARY },
    bodyStyles: { halign: 'left' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    foot: [],
  })
  y = doc.lastAutoTable.finalY + 10

  // Recettes par compte
  doc.setFontSize(11).setFont('helvetica', 'bold')
  doc.text('Produits (Recettes)', 14, y); y += 4

  const recParCompte = groupByCompte(recettes)
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Compte', 'Nb', 'Total']],
    body: recParCompte.map(r => [r.code, r.libelle, r.count, formatMoney(r.total)]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 109, 17] },
    foot: [['', 'TOTAL RECETTES', '', formatMoney(totalR)]],
    footStyles: { fillColor: [220, 245, 200], textColor: [30, 80, 10], fontStyle: 'bold' },
  })
  y = doc.lastAutoTable.finalY + 10

  // Dépenses par compte
  if (y > 240) { doc.addPage(); pdfHeader(doc, `Bilan comptable — Exercice ${annee}`, annee); y = 30 }
  doc.setFontSize(11).setFont('helvetica', 'bold')
  doc.text('Charges (Dépenses)', 14, y); y += 4

  const depParCompte = groupByCompte(depenses)
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Compte', 'Nb', 'Total']],
    body: depParCompte.map(d => [d.code, d.libelle, d.count, formatMoney(d.total)]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [163, 45, 45] },
    foot: [['', 'TOTAL DÉPENSES', '', formatMoney(totalD)]],
    footStyles: { fillColor: [252, 235, 235], textColor: [120, 30, 30], fontStyle: 'bold' },
  })
  y = doc.lastAutoTable.finalY + 12

  // Résultat final
  const resColor = resultat >= 0 ? [59, 109, 17] : [163, 45, 45]
  doc.setTextColor(...resColor)
  doc.setFontSize(13).setFont('helvetica', 'bold')
  doc.text(`Résultat de l'exercice ${annee} : ${formatMoney(resultat)}`, 14, y + 4)
  doc.setTextColor(0, 0, 0)

  // Footer RGPD
  doc.setFontSize(7).setTextColor(150, 150, 150)
  doc.text(`Document confidentiel — Heart's Angels ASBL — Usage interne uniquement`, 105, 290, { align: 'center' })

  doc.save(`Hearts-Angels_Bilan_${annee}.pdf`)
}

export async function exportGrandLivreExcel(annee) {
  const { data: exercice } = await supabase
    .from('exercices').select('*').eq('annee', annee).single()

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, plan_comptable(code,libelle), profiles!created_by(prenom,nom)')
    .eq('exercice_id', exercice.id)
    .order('date_transaction')

  const wb = XLSX.utils.book_new()

  // Onglet Grand Livre
  const rows = (transactions || []).map(t => ({
    'Date':          formatDate(t.date_transaction),
    'Type':          t.type === 'recette' ? 'Recette' : 'Dépense',
    'Code compte':   t.plan_comptable?.code || '',
    'Compte':        t.plan_comptable?.libelle || '',
    'Libellé':       t.libelle,
    'Tiers':         t.tiers || '',
    'Référence':     t.reference || '',
    'Recette (€)':   t.type === 'recette' ? t.montant : '',
    'Dépense (€)':   t.type === 'depense' ? t.montant : '',
    'Validé':        t.valide ? 'Oui' : 'Non',
    'Encodé par':    t.profiles ? `${t.profiles.prenom} ${t.profiles.nom}` : '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [10,8,12,30,40,25,15,12,12,8,20].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, `Grand Livre ${annee}`)

  // Onglet Récap par compte
  const recapRows = groupByCompte(transactions || []).map(r => ({
    'Code':     r.code,
    'Libellé':  r.libelle,
    'Classe':   r.classe,
    'Recettes': r.type === 'recette' ? r.total : 0,
    'Dépenses': r.type === 'depense' ? r.total : 0,
    'Nb opér.': r.count,
  }))
  const wsRecap = XLSX.utils.json_to_sheet(recapRows)
  XLSX.utils.book_append_sheet(wb, wsRecap, 'Récap par compte')

  // Onglet Résultat
  const recettes = transactions?.filter(t => t.type === 'recette') || []
  const depenses = transactions?.filter(t => t.type === 'depense') || []
  const wsRes = XLSX.utils.json_to_sheet([
    { '': 'EXERCICE', 'Valeur': annee },
    { '': '', 'Valeur': '' },
    { '': 'Total recettes', 'Valeur': recettes.reduce((s,t) => s+t.montant, 0) },
    { '': 'Total dépenses', 'Valeur': depenses.reduce((s,t) => s+t.montant, 0) },
    { '': 'RÉSULTAT',       'Valeur': recettes.reduce((s,t) => s+t.montant, 0) - depenses.reduce((s,t) => s+t.montant, 0) },
  ])
  XLSX.utils.book_append_sheet(wb, wsRes, 'Résultat')

  XLSX.writeFile(wb, `Hearts-Angels_GrandLivre_${annee}.xlsx`)
}

// ── EXPORT SOUHAITS ───────────────────────────────────────────────────────────

export async function exportRapportSouhaits(annee) {
  const debut = `${annee}-01-01`
  const fin   = `${annee}-12-31`

  const { data: souhaits } = await supabase
    .from('souhaits')
    .select('*, profiles!coordinateur_id(prenom,nom)')
    .gte('created_at', debut)
    .lte('created_at', fin)
    .is('deleted_at', null)
    .order('created_at')

  const doc = new jsPDF()
  pdfHeader(doc, `Rapport des souhaits — ${annee}`, annee)

  let y = 30

  // Stats globales
  const stats = {
    total:       souhaits?.length || 0,
    realises:    souhaits?.filter(s => s.statut === 'realise').length || 0,
    en_attente:  souhaits?.filter(s => s.statut === 'en_attente').length || 0,
    planifies:   souhaits?.filter(s => s.statut === 'planifie').length || 0,
    annules:     souhaits?.filter(s => s.statut === 'annule').length || 0,
  }

  doc.setFontSize(11).setFont('helvetica', 'bold')
  doc.text('Statistiques globales', 14, y); y += 6

  autoTable(doc, {
    startY: y,
    head: [['Indicateur', 'Nombre', '%']],
    body: [
      ['Total souhaits enregistrés', stats.total, '100%'],
      ['Réalisés', stats.realises, stats.total ? `${Math.round(stats.realises/stats.total*100)}%` : '—'],
      ['En attente', stats.en_attente, stats.total ? `${Math.round(stats.en_attente/stats.total*100)}%` : '—'],
      ['Planifiés', stats.planifies, stats.total ? `${Math.round(stats.planifies/stats.total*100)}%` : '—'],
      ['Annulés', stats.annules, stats.total ? `${Math.round(stats.annules/stats.total*100)}%` : '—'],
    ],
    styles: { fontSize: 10 },
    headStyles: { fillColor: PRIMARY },
  })
  y = doc.lastAutoTable.finalY + 10

  // Liste détaillée (sans données médicales dans le PDF d'export)
  doc.setFontSize(11).setFont('helvetica', 'bold')
  doc.text('Détail des souhaits', 14, y); y += 4

  autoTable(doc, {
    startY: y,
    head: [['Bénéficiaire', 'Description', 'Localisation', 'Date', 'Statut', 'Coordinateur']],
    body: (souhaits || []).map(s => [
      `${s.beneficiaire_prenom} ${s.beneficiaire_nom}`,
      s.description.slice(0, 50) + (s.description.length > 50 ? '…' : ''),
      s.localisation || '—',
      formatDate(s.date_realisee || s.date_souhaitee),
      statutLabel(s.statut),
      s.profiles ? `${s.profiles.prenom} ${s.profiles.nom}` : '—',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: PRIMARY },
  })

  doc.setFontSize(7).setTextColor(150, 150, 150)
  doc.text(`Document confidentiel — Heart's Angels ASBL`, 105, 290, { align: 'center' })

  doc.save(`Hearts-Angels_Souhaits_${annee}.pdf`)
}

// ── EXPORT DÉFRAIEMENTS ───────────────────────────────────────────────────────

export async function exportDefraiementsExcel(annee) {
  const debut = `${annee}-01-01`
  const fin   = `${annee}-12-31`

  const { data } = await supabase
    .from('defraiements')
    .select('*, volontaires(prenom,nom), souhaits(description)')
    .gte('date_frais', debut)
    .lte('date_frais', fin)
    .order('date_frais')

  const wb = XLSX.utils.book_new()

  const rows = (data || []).map(d => ({
    'Date':          formatDate(d.date_frais),
    'Volontaire':    d.volontaires ? `${d.volontaires.prenom} ${d.volontaires.nom}` : '—',
    'Catégorie':     d.categorie,
    'Description':   d.description,
    'Souhait lié':   d.souhaits?.description?.slice(0, 40) || '—',
    'Km':            d.km || '',
    'Montant (€)':   d.montant,
    'Montant km (€)':d.montant_km || '',
    'Total (€)':     d.montant + (d.montant_km || 0),
    'Statut':        d.statut,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, `Défraiements ${annee}`)

  // Récap par catégorie
  const parCat = {}
  ;(data || []).forEach(d => {
    if (!parCat[d.categorie]) parCat[d.categorie] = { total: 0, nb: 0 }
    parCat[d.categorie].total += d.montant + (d.montant_km || 0)
    parCat[d.categorie].nb++
  })
  const wsRecap = XLSX.utils.json_to_sheet(
    Object.entries(parCat).map(([cat, v]) => ({
      'Catégorie': cat, 'Nb demandes': v.nb, 'Total (€)': v.total.toFixed(2)
    }))
  )
  XLSX.utils.book_append_sheet(wb, wsRecap, 'Récap par catégorie')

  XLSX.writeFile(wb, `Hearts-Angels_Defraiements_${annee}.xlsx`)
}

// ── EXPORT VOLONTAIRES ────────────────────────────────────────────────────────

export async function exportVolontairesPDF() {
  const { data } = await supabase
    .from('volontaires')
    .select('*')
    .eq('actif', true)
    .is('deleted_at', null)
    .order('nom')

  const doc = new jsPDF()
  const annee = new Date().getFullYear()
  pdfHeader(doc, 'Registre des volontaires actifs', annee)

  autoTable(doc, {
    startY: 28,
    head: [['Nom', 'Prénom', 'Type', 'Qualification', 'Email', 'Tél.', 'Depuis']],
    body: (data || []).map(v => [
      v.nom, v.prenom,
      v.type === 'medical' ? 'Médical' : 'Non-médical',
      v.qualification || '—',
      v.email || '—',
      v.telephone || '—',
      formatDate(v.date_inscription),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: PRIMARY },
  })

  doc.setFontSize(7).setTextColor(150, 150, 150)
  doc.text(`Document confidentiel — Heart's Angels ASBL`, 105, 290, { align: 'center' })

  doc.save(`Hearts-Angels_Volontaires_${annee}.pdf`)
}

// ── Helpers internes ──────────────────────────────────────────────────────────

function groupByCompte(transactions) {
  const map = {}
  transactions.forEach(t => {
    const key = t.plan_comptable?.code || 'sans_compte'
    if (!map[key]) map[key] = {
      code: t.plan_comptable?.code || '—',
      libelle: t.plan_comptable?.libelle || 'Sans compte',
      classe: t.plan_comptable?.classe || '',
      type: t.type,
      total: 0, count: 0
    }
    map[key].total += t.montant
    map[key].count++
  })
  return Object.values(map).sort((a, b) => a.code.localeCompare(b.code))
}

function statutLabel(s) {
  const labels = {
    en_attente: 'En attente', planifie: 'Planifié', en_cours: 'En cours',
    realise: 'Réalisé', annule: 'Annulé', urgent: 'Urgent'
  }
  return labels[s] || s
}
