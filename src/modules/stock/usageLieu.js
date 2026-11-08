export function jourFr(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return dateFr(iso)
  return new Intl.DateTimeFormat('fr-BE', {
    timeZone: 'Europe/Brussels', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d)
}

export function dateFr(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return String(iso)
  return `${d}/${m}/${y}`
}

export function bornerQte(saisie, max) {
  const plafond = Number(max)
  if (!Number.isFinite(plafond) || plafond <= 0) return 0
  const n = Number(String(saisie ?? '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return Math.min(1, plafond)
  return Math.min(n, plafond)
}

export function lignesUsage(coches) {
  return Object.entries(coches || {})
    .filter(([, q]) => Number(q) > 0)
    .map(([catalogue_id, qte]) => ({ catalogue_id, qte: Number(qte) }))
}
