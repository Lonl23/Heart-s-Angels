/** Familles de dotation individuelle (vêtements + badges). */
export const CLES_DOTATION = [
  { v: 'polo', l: 'Polo', vetement: true },
  { v: 'tshirt', l: 'T-shirt', vetement: true },
  { v: 'chemise', l: 'Chemise', vetement: true },
  { v: 'veste', l: 'Veste', vetement: true },
  { v: 'badge_asbl', l: 'Badge ASBL', vetement: false },
  { v: 'badge_chc', l: 'Badge d’accès CHC', vetement: false },
  { v: 'badge_solumob', l: 'Badge Solumob', vetement: false },
]

export const TAILLES_VETEMENT = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export const lblCleDotation = v => CLES_DOTATION.find(c => c.v === v)?.l || v || '—'

export function estVetementCle(cle) {
  return !!CLES_DOTATION.find(c => c.v === cle)?.vetement
}

/** Articles parents (sans parent_id) destinés à la dotation. */
export function parentsDotation(cats) {
  return (cats || [])
    .filter(c => c.actif !== false && c.dotation_personnel && !c.parent_id)
    .sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'))
}

/** Variantes d’un parent (tailles, couleurs…). */
export function variantesDe(cats, parentId) {
  return (cats || [])
    .filter(c => c.actif !== false && c.parent_id === parentId)
    .sort((a, b) => {
      const ia = TAILLES_VETEMENT.indexOf(a.variante)
      const ib = TAILLES_VETEMENT.indexOf(b.variante)
      if (ia >= 0 && ib >= 0) return ia - ib
      return String(a.variante || a.nom || '').localeCompare(String(b.variante || b.nom || ''), 'fr')
    })
}

/** Articles attribuables : variantes si présentes, sinon le parent. */
export function articlesAttribuables(cats, parentId) {
  const vars = variantesDe(cats, parentId)
  if (vars.length) return vars
  const p = (cats || []).find(c => c.id === parentId)
  return p ? [p] : []
}

export function libelleArticleDotation(row) {
  const base = row?.parent_nom || row?.article || 'Article'
  const v = row?.variante
  return v ? `${base} — ${v}` : base
}

export function fmtDateBe(v) {
  if (!v) return '—'
  const d = new Date(String(v).slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('fr-BE')
}
