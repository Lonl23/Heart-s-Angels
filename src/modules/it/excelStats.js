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
  ws['!cols'] = cols.map(c => ({ wch: c.w || 22 }))
  return ws
}

function compte(rows) {
  return (rows || []).map(r => ({ label: r.label, n: r.n }))
}

export async function exporterStatsExcel({ filtre, lignes, blocs, km }) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const aide = XLSX.utils.aoa_to_sheet([
    ['Heart’s Angels — Statistiques des souhaits'],
    [''],
    ['Filtre', filtre || 'Ensemble'],
    ['Souhaits', lignes.length],
    ['Kilométrage', km],
    [''],
    ['L’onglet Souhaits reprend chaque dossier du filtre.'],
    ['Les autres onglets reprennent les totaux des graphiques, sur la même sélection.'],
    ['Les souhaits de formation ne sont pas inclus.'],
  ])
  aide['!cols'] = [{ wch: 28 }, { wch: 72 }]
  XLSX.utils.book_append_sheet(wb, aide, 'Lire-moi')
  XLSX.utils.book_append_sheet(wb, feuille(XLSX, lignes, [
    { h: 'Date', w: 14, v: r => r.jour || '' },
    { h: 'Statut', w: 28, v: r => r.statutLabel || r.statut || '' },
    { h: 'Bénéficiaire', w: 28, v: r => r.beneficiaire || '' },
    { h: 'Lieu', w: 24, v: r => r.lieu || '' },
    { h: 'Activités', w: 36, v: r => (r.activites || []).join(', ') },
    { h: 'Pathologies', w: 36, v: r => (r.pathologies || []).join(', ') },
    { h: 'Sexe', w: 16, v: r => r.genre || '' },
    { h: 'Âge', w: 8, v: r => r.age == null ? '' : r.age },
    { h: 'Tranche d’âge', w: 16, v: r => r.tranche || '' },
    { h: 'Institution', w: 28, v: r => r.institution || '' },
    { h: 'Service', w: 28, v: r => r.service || '' },
    { h: 'Km', w: 10, v: r => r.km || 0 },
    { h: 'Volontaires', w: 40, v: r => (r.volontaires || []).map(v => v.nom).filter(Boolean).join(', ') },
  ]), 'Souhaits')
  const simples = [
    ['Statuts', blocs.statuts],
    ['Lieux', blocs.lieux],
    ['Activites', blocs.activites],
    ['Pathologies', blocs.pathologies],
    ['Sexe', blocs.sexe],
    ['Ages', blocs.ages],
    ['Institutions', blocs.institutions],
    ['Volontaires', blocs.volontaires],
    ['Annees', blocs.annees],
  ]
  for (const [nom, rows] of simples) {
    XLSX.utils.book_append_sheet(wb, feuille(XLSX, compte(rows), [
      { h: 'Libellé', w: 36, v: r => r.label },
      { h: 'Nombre', w: 12, v: r => r.n },
    ]), nom)
  }
  XLSX.utils.book_append_sheet(wb, feuille(XLSX, blocs.services, [
    { h: 'Institution', w: 32, v: r => r.institution },
    { h: 'Service', w: 32, v: r => r.label },
    { h: 'Nombre', w: 12, v: r => r.n },
  ]), 'Services')
  XLSX.writeFile(wb, `statistiques-souhaits-${slugDate()}.xlsx`)
}
