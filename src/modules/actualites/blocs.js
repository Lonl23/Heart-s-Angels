export const TYPES_BLOC = ['texte', 'intertitre', 'photo', 'citation']

export function identifiant() {
  return crypto.randomUUID ? crypto.randomUUID() : 'b' + Date.now() + Math.random().toString(16).slice(2)
}

export function blocVide(type) {
  const id = identifiant()
  if (type === 'photo') return { id, type, path: '', legende: '' }
  if (type === 'citation') return { id, type, texte: '', source: '' }
  return { id, type: type === 'intertitre' ? 'intertitre' : 'texte', texte: '' }
}

function texte(v, max) {
  return String(v || '').replace(/\u0000/g, '').slice(0, max)
}

/** Ne garde que les blocs connus et remplis. */
export function normaliserBlocs(raw) {
  const list = Array.isArray(raw) ? raw : []
  const out = []
  for (const b of list) {
    const type = TYPES_BLOC.includes(b?.type) ? b.type : null
    if (!type) continue
    const id = texte(b.id, 80) || identifiant()
    if (type === 'photo') {
      const path = texte(b.path, 400)
      if (!path) continue
      out.push({ id, type, path, legende: texte(b.legende, 300) })
    } else if (type === 'citation') {
      const corps = texte(b.texte, 2000).trim()
      if (!corps) continue
      out.push({ id, type, texte: corps, source: texte(b.source, 200).trim() })
    } else {
      const corps = texte(b.texte, 8000).trim()
      if (!corps) continue
      out.push({ id, type, texte: corps })
    }
  }
  return out
}

export function chapoCourt(v) {
  return texte(v, 400).trim()
}
