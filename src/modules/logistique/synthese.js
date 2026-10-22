import { CATEGORIES, nomPersonne, totalOuverts } from './vehicules.js'

/** Du plus grave au plus calme. Un véhicule compte une seule fois, dans sa couleur la plus grave. */
export const GRAVITES = [
  { v: 'mecanique', l: 'Mécanique', couleur: '#C8435A' },
  { v: 'materiel', l: 'Matériel', couleur: '#E07A3D' },
  { v: 'hygiene', l: 'Hygiène', couleur: '#C9A227' },
  { v: 'ok', l: 'Rien d’ouvert', couleur: '#3B6D11' },
]

const RANG = { mecanique: 0, materiel: 1, hygiene: 2, ok: 3 }

export function gravite(n) {
  if (n?.mecanique) return 'mecanique'
  if (n?.materiel) return 'materiel'
  if (n?.hygiene) return 'hygiene'
  return 'ok'
}

export function repartition(rows) {
  const n = { ok: 0, hygiene: 0, materiel: 0, mecanique: 0, total: (rows || []).length }
  for (const r of rows || []) n[gravite(r.n)] += 1
  return n
}

export function conicGradient(rep) {
  const total = rep?.total || 0
  if (!total) return 'var(--border)'
  let acc = 0
  const bits = []
  for (const g of GRAVITES) {
    const c = rep[g.v] || 0
    if (!c) continue
    const start = (acc / total) * 100
    acc += c
    bits.push(`${g.couleur} ${start}% ${(acc / total) * 100}%`)
  }
  return `conic-gradient(${bits.join(',')})`
}

export function libelleRepartition(rep) {
  return GRAVITES.map(g => `${g.l} : ${rep?.[g.v] || 0}`).join(', ')
}

export function ordreParc(rows) {
  return [...(rows || [])].sort((a, b) => {
    const d = RANG[gravite(a.n)] - RANG[gravite(b.n)]
    if (d) return d
    const na = a.libelle || a.plaque || ''
    const nb = b.libelle || b.plaque || ''
    return na.localeCompare(nb, 'fr')
  })
}

export function sommeCategorie(rows, cle) {
  return (rows || []).reduce((s, r) => s + (r.n?.[cle] || 0), 0)
}

/** Cartes du haut. Le stock n’apparaît que pour qui le gère. Aucun retard de désinfection n’est calculé. */
export function cartesSynthese(rows, stock) {
  const rep = repartition(rows)
  const points = (rows || []).reduce((s, r) => s + totalOuverts(r.n), 0)
  const concernes = rep.total - rep.ok
  const base = [
    {
      cle: 'points',
      label: 'Points ouverts',
      n: points,
      hint: 'ils restent pour l’équipe suivante',
      to: '/app/logistique/vehicules',
      ton: points ? 'alerte' : 'ok',
    },
    {
      cle: 'concernes',
      label: 'Véhicules concernés',
      n: concernes,
      hint: `sur ${rep.total} véhicule${rep.total > 1 ? 's' : ''}`,
      to: '/app/logistique/vehicules',
      ton: concernes ? 'alerte' : 'ok',
    },
  ]
  if (stock) {
    return [
      ...base,
      {
        cle: 'perimes',
        label: 'Périmés à ce jour',
        n: stock.perimes,
        hint: stock.j15 ? `et ${stock.j15} dans les 15 jours` : 'aucun dans les 15 jours',
        to: '/app/stock',
        ton: stock.perimes ? 'alerte' : 'ok',
      },
      {
        cle: 'seuil',
        label: 'Sous le seuil',
        n: stock.bas,
        hint: stock.o2 ? `et ${stock.o2} bouteille${stock.o2 > 1 ? 's' : ''} à 50 bar ou moins` : 'réserve et sacs',
        to: '/app/stock',
        ton: stock.bas || stock.o2 ? 'alerte' : 'ok',
      },
    ]
  }
  const hygiene = sommeCategorie(rows, 'hygiene')
  const mecanique = sommeCategorie(rows, 'mecanique')
  return [
    ...base,
    {
      cle: 'hygiene',
      label: 'Hygiène',
      n: hygiene,
      hint: 'points ouverts',
      to: '/app/logistique/vehicules',
      ton: hygiene ? 'alerte' : 'ok',
    },
    {
      cle: 'mecanique',
      label: 'Mécanique',
      n: mecanique,
      hint: 'points ouverts',
      to: '/app/logistique/vehicules',
      ton: mecanique ? 'alerte' : 'ok',
    },
  ]
}

export function lireStock(data) {
  if (!data || data.ok !== true) return null
  const perimes = data.perimes || []
  const j15 = data.proches_j15 || []
  const bas = data.bas || []
  const o2 = data.o2_basse || []
  return {
    perimes,
    j15,
    bas,
    o2,
    commandes: data.commandes || [],
    comptes: {
      perimes: perimes.length,
      j15: j15.length,
      bas: bas.length,
      o2: o2.length,
    },
  }
}

export function lignesHygiene(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ah = a.n?.hygiene ? 0 : 1
    const bh = b.n?.hygiene ? 0 : 1
    if (ah !== bh) return ah - bh
    const ad = a.desinfection_le ? 1 : 0
    const bd = b.desinfection_le ? 1 : 0
    if (ad !== bd) return ad - bd
    return String(b.desinfection_le || '').localeCompare(String(a.desinfection_le || ''))
  })
}

export function jour(iso) {
  if (!iso) return ''
  const brut = String(iso)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(brut) ? new Date(`${brut}T12:00:00`) : new Date(brut)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-BE', {
    timeZone: 'Europe/Brussels',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function filActivite({ ouverts, fermes, suivis, vehicules, noms }) {
  const nomV = id => {
    const v = (vehicules || []).find(x => x.id === id)
    return v?.libelle || v?.plaque || 'Véhicule'
  }
  const cat = v => CATEGORIES.find(c => c.v === v)?.l || 'Point'
  const ev = []
  for (const c of ouverts || []) {
    ev.push({
      id: `o-${c.id}`,
      at: c.created_at,
      kind: 'ouvert',
      titre: c.libelle,
      detail: `${cat(c.categorie)} · ${nomV(c.vehicule_id)}`,
      qui: nomPersonne(noms?.[c.auteur_id]),
      to: `/app/logistique/vehicules/${c.vehicule_id}`,
    })
  }
  for (const c of fermes || []) {
    ev.push({
      id: `f-${c.id}`,
      at: c.clos_le || c.created_at,
      kind: 'repare',
      titre: `Réparé · ${c.libelle}`,
      detail: nomV(c.vehicule_id),
      qui: nomPersonne(noms?.[c.clos_par]),
      to: `/app/logistique/vehicules/${c.vehicule_id}`,
    })
  }
  for (const s of suivis || []) {
    if (!s.desinfection_le) continue
    ev.push({
      id: `d-${s.vehicule_id}`,
      at: s.desinfection_le,
      kind: 'hygiene',
      titre: 'Désinfection faite',
      detail: nomV(s.vehicule_id),
      qui: nomPersonne(noms?.[s.desinfection_par]),
      to: `/app/logistique/vehicules/${s.vehicule_id}`,
    })
  }
  return ev
    .filter(e => e.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 12)
}
