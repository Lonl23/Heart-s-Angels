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
const GLOBAL = new Set(['class', 'style'])

const STYLE_PROPS = new Set([
  'color', 'background', 'background-color', 'background-image', 'background-size',
  'background-position', 'background-repeat',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border', 'border-radius', 'border-color', 'border-width', 'border-style',
  'border-top', 'border-right', 'border-bottom', 'border-left',
  'font-size', 'font-weight', 'font-family', 'font-style', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'text-decoration',
  'display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
  'align-self', 'gap', 'row-gap', 'column-gap', 'flex', 'flex-grow', 'flex-shrink',
  'flex-basis', 'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
  'overflow', 'overflow-x', 'overflow-y', 'box-sizing', 'box-shadow', 'opacity',
  'object-fit', 'object-position', 'white-space', 'word-break',
  'grid-template-columns', 'grid-template-rows', 'grid-gap', 'grid-column', 'grid-row',
  'position', 'top', 'left', 'right', 'bottom', 'list-style', 'vertical-align',
  'aspect-ratio',
])

function safeUrl(raw, forImg) {
  const s = String(raw || '').trim()
  if (!s || (/[\s<>]/.test(s) && !s.startsWith('data:'))) return ''
  const lower = s.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:text')) return ''
  if (forImg && /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(s) && s.length < 400000) return s
  if (lower.startsWith('mailto:') && !forImg) return /^mailto:[^\s]+$/i.test(s) ? s : ''
  if (s.startsWith('/') && !s.startsWith('//') && !s.includes('\\')) {
    const path = s.split('?')[0]
    if (forImg) return /\.(jpe?g|png|gif|webp)$/i.test(path) ? s : ''
    if (path.startsWith('/app') || path.startsWith('/evenements') || path.startsWith('/icons')) return s
    return ''
  }
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    try {
      const u = new URL(s)
      if (u.protocol === 'http:' || u.protocol === 'https:') return s
    } catch { return '' }
  }
  return ''
}

function safeStyle(raw) {
  const src = String(raw || '')
  if (!src.trim()) return ''
  const low = src.toLowerCase()
  if (low.includes('expression') || low.includes('javascript') || low.includes('behavior') || low.includes('@import') || low.includes('</')) return ''
  const out = []
  for (const part of src.split(';')) {
    const i = part.indexOf(':')
    if (i < 1) continue
    const prop = part.slice(0, i).trim().toLowerCase()
    let val = part.slice(i + 1).trim()
    if (!STYLE_PROPS.has(prop) || !val) continue
    if (prop === 'position' && !/^(relative|static|absolute)$/i.test(val)) continue
    const urls = [...val.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/ig)]
    if (urls.length) {
      let ok = true
      let rebuilt = val
      for (const m of urls) {
        const u = safeUrl(m[2], true)
        if (!u) { ok = false; break }
        rebuilt = rebuilt.replace(m[0], `url("${u}")`)
      }
      if (!ok) continue
      val = rebuilt
    }
    if (/expression|javascript|behavior|@import/i.test(val)) continue
    out.push(`${prop}: ${val}`)
  }
  return out.slice(0, 24).join('; ')
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
      } else       if (name === 'class') {
        const c = safeClass(attr.value)
        if (c) node.setAttribute('class', c)
        else node.removeAttribute('class')
      } else if (name === 'style') {
        const st = safeStyle(attr.value)
        if (st) node.setAttribute('style', st)
        else node.removeAttribute('style')
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
