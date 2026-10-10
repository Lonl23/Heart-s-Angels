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

export function clePeriode(p) {
  if (!p?.debut) return ''
  return `${p.debut}|${p.fin || p.debut}`
}

export function asJours(v) {
  if (!v) return []
  if (Array.isArray(v)) return [...new Set(v.map(x => String(x).slice(0, 10)).filter(Boolean))]
  return []
}

export function fmtPeriodeCourt(p) {
  if (!p?.debut) return ''
  const opts = { weekday: 'short', day: 'numeric', month: 'short' }
  const a = new Date(p.debut + 'T12:00:00').toLocaleDateString('fr-BE', opts)
  if (p.fin && p.fin !== p.debut) {
    return `${a} → ${new Date(p.fin + 'T12:00:00').toLocaleDateString('fr-BE', opts)}`
  }
  return a
}

export function couvrePeriode(joursDispo, p) {
  const need = joursDesPeriodes([p])
  if (!need.length) return 'inconnu'
  const have = new Set(asJours(joursDispo))
  let n = 0
  for (const j of need) if (have.has(j)) n++
  if (n >= need.length) return 'plein'
  if (n > 0) return 'partiel'
  return 'non'
}

export function conflitSurPeriode(joursConflit, p) {
  const need = new Set(joursDesPeriodes([p]))
  return asJours(joursConflit).some(j => need.has(j))
}

/** Une personne : plein sur une option = dispo pour CETTE date (pas les deux). */
export function annoterPeriodes(joursDispo, joursConflit, periodes) {
  const list = normaliserPeriodes(periodes)
  const parPeriode = {}
  const conflitPeriode = {}
  for (const p of list) {
    const k = clePeriode(p)
    parPeriode[k] = couvrePeriode(joursDispo, p)
    conflitPeriode[k] = conflitSurPeriode(joursConflit, p)
  }
  const vals = list.map(p => parPeriode[clePeriode(p)])
  const dispo = !vals.length ? 'inconnu'
    : vals.some(v => v === 'plein') ? 'plein'
    : vals.some(v => v === 'partiel') ? 'partiel'
    : 'non'
  return {
    parPeriode,
    conflitPeriode,
    dispo,
    conflit: list.some(p => conflitPeriode[clePeriode(p)]),
  }
}
