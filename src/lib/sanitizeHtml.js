/** Sous-ensemble HTML pour les pages d’événements internes. Pas de script ni d’on*. */

const ALLOWED = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'BR', 'HR',
  'DIV', 'SPAN', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN',
  'UL', 'OL', 'LI', 'A', 'IMG', 'STRONG', 'EM', 'B', 'I', 'U', 'S',
  'BLOCKQUOTE', 'PRE', 'CODE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH',
  'FIGURE', 'FIGCAPTION', 'SMALL', 'SUB', 'SUP', 'MARK', 'ABBR',
])

const REMOVE = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE',
  'FORM', 'INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'OPTION', 'SVG', 'MATH',
  'NOSCRIPT', 'TEMPLATE', 'VIDEO', 'AUDIO', 'SOURCE', 'TRACK', 'CANVAS',
])

const ATTRS = {
  A: new Set(['href', 'title', 'target', 'rel']),
  IMG: new Set(['src', 'alt', 'title', 'width', 'height']),
  TD: new Set(['colspan', 'rowspan']),
  TH: new Set(['colspan', 'rowspan']),
  ABBR: new Set(['title']),
}
const GLOBAL = new Set(['class'])

function safeUrl(raw, forImg) {
  const s = String(raw || '').trim()
  if (!s || /[\s<>]/.test(s) && !s.startsWith('data:')) return ''
  const lower = s.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:text')) return ''
  if (forImg && /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(s) && s.length < 400000) return s
  if (lower.startsWith('mailto:') && !forImg) return /^mailto:[^\s]+$/i.test(s) ? s : ''
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    try {
      const u = new URL(s)
      if (u.protocol === 'http:' || u.protocol === 'https:') return s
    } catch { return '' }
  }
  return ''
}

function safeClass(v) {
  return String(v || '').replace(/[^\w\s\-]/g, '').slice(0, 120)
}

function clean(el) {
  const kids = [...el.childNodes]
  for (const node of kids) {
    if (node.nodeType === 8) { node.remove(); continue }
    if (node.nodeType === 3) continue
    if (node.nodeType !== 1) { node.remove(); continue }
    const tag = node.tagName
    if (REMOVE.has(tag)) { node.remove(); continue }
    if (!ALLOWED.has(tag)) {
      clean(node)
      const inner = [...node.childNodes]
      inner.forEach(ch => el.insertBefore(ch, node))
      node.remove()
      continue
    }
    const allowed = new Set([...(ATTRS[tag] || []), ...GLOBAL])
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on') || name.startsWith('xmlns') || name === 'srcdoc' || name === 'xlink:href') {
        node.removeAttribute(attr.name)
        continue
      }
      if (!allowed.has(name)) { node.removeAttribute(attr.name); continue }
      if (name === 'href') {
        const u = safeUrl(attr.value, false)
        if (!u) node.removeAttribute('href')
        else {
          node.setAttribute('href', u)
          if (node.getAttribute('target') === '_blank') node.setAttribute('rel', 'noopener noreferrer')
        }
      } else if (name === 'src') {
        const u = safeUrl(attr.value, true)
        if (!u) node.removeAttribute('src')
        else node.setAttribute('src', u)
      } else if (name === 'target') {
        if (attr.value !== '_blank' && attr.value !== '_self') node.removeAttribute('target')
      } else if (name === 'rel') {
        node.setAttribute('rel', 'noopener noreferrer')
      } else if (name === 'class') {
        const c = safeClass(attr.value)
        if (c) node.setAttribute('class', c)
        else node.removeAttribute('class')
      } else if (name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan') {
        const n = String(attr.value).replace(/\D/g, '').slice(0, 4)
        if (n) node.setAttribute(name, n)
        else node.removeAttribute(name)
      }
    }
    clean(node)
  }
}

export function sanitizeHtml(html) {
  try {
    const raw = String(html || '')
    if (!raw.trim()) return ''
    if (typeof DOMParser === 'undefined') return ''
    const doc = new DOMParser().parseFromString(`<div id="ha-root">${raw}</div>`, 'text/html')
    const root = doc.getElementById('ha-root')
    if (!root) return ''
    clean(root)
    return root.innerHTML
  } catch {
    return ''
  }
}
