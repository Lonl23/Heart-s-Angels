const slice = v => (v ? String(v).slice(0, 10) : '')

function asArray(v) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

function nextDay(iso) {
  const t = new Date(iso + 'T12:00:00')
  t.setDate(t.getDate() + 1)
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function periodesDepuisSouhait(s) {
  const raw = asArray(s?.dates_possibles)
  const fromJson = raw.map(p => ({
    debut: slice(p?.debut || p?.date_debut),
    fin: slice(p?.fin || p?.date_fin || p?.debut || p?.date_debut),
  })).filter(p => p.debut)
  if (fromJson.length) return fromJson
  if (s?.date_souhaitee) {
    const debut = slice(s.date_souhaitee)
    return [{ debut, fin: slice(s.date_fin) || debut }]
  }
  return [{ debut: '', fin: '' }]
}

export function normaliserPeriodes(periodes) {
  return (periodes || [])
    .map(p => {
      const debut = slice(p?.debut)
      if (!debut) return null
      let fin = slice(p?.fin) || debut
      if (fin < debut) fin = debut
      return { debut, fin }
    })
    .filter(Boolean)
    .sort((a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin))
}

export function plageGlobale(periodes) {
  const n = normaliserPeriodes(periodes)
  if (!n.length) return { date_souhaitee: null, date_fin: null }
  return {
    date_souhaitee: n[0].debut,
    date_fin: n.reduce((acc, p) => (p.fin > acc ? p.fin : acc), n[0].fin),
  }
}

export function fmtPeriode(p) {
  if (!p?.debut) return ''
  const d0 = new Date(p.debut + 'T12:00:00').toLocaleDateString('fr-BE')
  if (p.fin && p.fin !== p.debut) return `${d0} → ${new Date(p.fin + 'T12:00:00').toLocaleDateString('fr-BE')}`
  return d0
}

export function joursDesPeriodes(periodes) {
  const set = new Set()
  for (const p of normaliserPeriodes(periodes)) {
    let d = p.debut
    while (d && d <= p.fin) {
      set.add(d)
      d = nextDay(d)
    }
  }
  return [...set].sort()
}

export function fmtDatesSouhait(s) {
  const n = normaliserPeriodes(
    asArray(s?.dates_possibles).length
      ? asArray(s?.dates_possibles)
      : (s?.date_souhaitee ? [{ debut: s.date_souhaitee, fin: s.date_fin || s.date_souhaitee }] : []),
  )
  if (!n.length) return 'Date à définir'
  return n.map(fmtPeriode).join(' · ')
}
