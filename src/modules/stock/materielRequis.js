import { nomTypeO2 } from './stockSchema'

export function nid() {
  return (crypto.randomUUID && crypto.randomUUID()) || ('m-' + Math.random().toString(36).slice(2, 10))
}

export function libelleRequis(r) {
  if (!r) return ''
  if (r.kind === 'o2') {
    const n = Number(r.qte) || 1
    const nom = nomTypeO2(r.volume_l)
    return n > 1 ? `${nom} × ${n}` : nom
  }
  if (r.kind === 'sac') return r.libelle || 'Sac'
  if (r.kind === 'catalogue') {
    const n = Number(r.qte) || 1
    return n > 1 ? `${r.libelle || 'Article'} × ${n}` : (r.libelle || 'Article')
  }
  return r.libelle || 'Matériel'
}

/** Associe chaque ligne prévue aux scans (O₂ / sacs / articles). */
export function couvertureMateriel(requis, emports) {
  const o2 = [...(emports?.unites || []).filter(u => u.mode === 'oxygene')]
  const sacs = [...(emports?.sacs || [])]
  const autres = [...(emports?.unites || []).filter(u => u.mode !== 'oxygene')]
  return (requis || []).map(r => {
    const need = Math.max(1, Number(r.qte) || 1)
    const pris = []
    if (r.kind === 'o2') {
      for (let i = 0; i < need; i++) {
        const j = o2.findIndex(u => !r.volume_l || Number(u.volume_l) === Number(r.volume_l))
        if (j < 0) break
        pris.push(o2.splice(j, 1)[0])
      }
    } else if (r.kind === 'sac') {
      for (let i = 0; i < need; i++) {
        const j = sacs.findIndex(s => !r.lieu_id || s.id === r.lieu_id)
        if (j < 0) break
        pris.push(sacs.splice(j, 1)[0])
      }
    } else if (r.kind === 'catalogue') {
      for (let i = 0; i < need; i++) {
        const j = autres.findIndex(u => u.catalogue_id === r.catalogue_id)
        if (j < 0) break
        pris.push(autres.splice(j, 1)[0])
      }
    }
    return { ...r, pris, ok: r.kind === 'libre' ? !!r.pris : pris.length >= need, need }
  })
}
