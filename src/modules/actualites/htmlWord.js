export function echapperTexte(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Retire le balisage Word (styles Mso, polices, commentaires) et garde titres, gras, listes, liens. */
export function nettoyerHtmlWord(html) {
  let s = String(html || '')
  if (!s.trim()) return ''
  const frag = s.match(/<!--\s*StartFragment\s*-->([\s\S]*?)<!--\s*EndFragment\s*-->/i)
  if (frag) s = frag[1]
  s = s.replace(/<!\[if[\s\S]*?<!\[endif\]>/gi, '')
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<\/?(o|w|m|v|st1):[^>]*>/gi, '')
  s = s.replace(/\s(?:class|lang|xmlns(?::\w+)?)="[^"]*"/gi, '')
  s = s.replace(/\sstyle="([^"]*)"/gi, (_, st) => {
    const kept = st.split(';').map(p => p.trim()).filter(p => {
      if (!p) return false
      if (/mso-|panose-|tab-stops|text-autospace|punctuation-wrap/i.test(p)) return false
      if (/^(font-family|font-size|line-height|margin|margin-top|margin-bottom|margin-left|margin-right|text-indent|color|background|background-color)\s*:/i.test(p)) return false
      return true
    })
    return kept.length ? ` style="${kept.join('; ')}"` : ''
  })
  s = s.replace(/<\/?span[^>]*>/gi, '')
  s = s.replace(/<p[^>]*>\s*(?:&nbsp;|\u00a0|<br\s*\/?>)?\s*<\/p>/gi, '')
  return s.trim()
}

export function htmlDepuisPressePapier(html, texte) {
  if (String(html || '').trim()) return nettoyerHtmlWord(html)
  const lines = String(texte || '').replace(/\r\n/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  if (!lines.length) return ''
  return lines.map(p => `<p>${echapperTexte(p).replace(/\n/g, '<br>')}</p>`).join('')
}

export function chapoDepuisHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
}
