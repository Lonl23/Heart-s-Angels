// src/components/shared/RichText.jsx
import { useRef, useEffect, useState } from 'react'

const POLICES = [
  { label: 'Par défaut', value: '' },
  { label: 'DM Sans', value: "'DM Sans', sans-serif" },
  { label: 'Cormorant', value: "'Cormorant Garamond', Georgia, serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Courier', value: "'Courier New', monospace" },
]
const TAILLES = [
  { label: 'Petit', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Grand', value: '5' },
  { label: 'Très grand', value: '6' },
  { label: 'Énorme', value: '7' },
]
const COULEURS = ['#1A1514', '#1BB0CE', '#0E7A93', '#C8435A', '#3B6D11', '#BA7517', '#7A7470', '#A8266F']
const EMOJIS = ['😊','😍','🥳','🎉','🎈','❤️','💙','💚','💛','🙏','👍','👏','🚑','🏍️','🚶','🥾','☀️','🌧️','🍔','🍟','🌭','🥤','☕','🍰','🎵','📅','🕐','📍','📞','✅','⭐','✨','🔥','💪','🎁','🎯','⚠️','ℹ️','➡️','•','–','—','€','✔','✖']

export default function RichText({ value, onChange, placeholder = 'Saisissez le texte…', minHeight = 160 }) {
  const ref = useRef(null)
  const [showEmoji, setShowEmoji] = useState(false)

  // Initialiser le contenu (une seule fois / si value change de l'extérieur)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || ''
    }
  }, [value])

  function emit() { onChange(ref.current?.innerHTML || '') }
  function cmd(command, arg = null) {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    emit()
  }
  function insererTexte(txt) {
    ref.current?.focus()
    document.execCommand('insertText', false, txt)
    emit()
  }

  const btn = { padding: '5px 9px', background: 'white', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, fontSize: 13.5, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", minWidth: 30 }
  const sel = { padding: '5px 7px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, fontSize: 12.5, fontFamily: "'DM Sans',sans-serif", cursor: 'pointer', background: 'white' }

  return (
    <div style={{ border: '1px solid rgba(0,0,0,.12)', borderRadius: 10, overflow: 'visible', position: 'relative' }}>
      {/* Barre d'outils */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: 8, background: '#F8FCFD', borderBottom: '1px solid rgba(0,0,0,.08)', alignItems: 'center' }}>
        <button type="button" onClick={() => cmd('bold')} style={{ ...btn, fontWeight: 700 }} title="Gras">G</button>
        <button type="button" onClick={() => cmd('italic')} style={{ ...btn, fontStyle: 'italic' }} title="Italique">I</button>
        <button type="button" onClick={() => cmd('underline')} style={{ ...btn, textDecoration: 'underline' }} title="Souligné">S</button>

        <select style={sel} title="Police" defaultValue="" onChange={e => { if (e.target.value) cmd('fontName', e.target.value); e.target.value = '' }}>
          <option value="">Police…</option>
          {POLICES.filter(p => p.value).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <select style={sel} title="Taille" defaultValue="" onChange={e => { if (e.target.value) cmd('fontSize', e.target.value); e.target.value = '' }}>
          <option value="">Taille…</option>
          {TAILLES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Couleurs */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {COULEURS.map(c => (
            <button key={c} type="button" onClick={() => cmd('foreColor', c)} title={`Couleur ${c}`}
              style={{ width: 18, height: 18, borderRadius: 4, background: c, border: '1px solid rgba(0,0,0,.15)', cursor: 'pointer', padding: 0 }} />
          ))}
        </div>

        <button type="button" onClick={() => cmd('insertUnorderedList')} style={btn} title="Liste à puces">• ☰</button>
        <button type="button" onClick={() => cmd('insertOrderedList')} style={btn} title="Liste numérotée">1.</button>
        <button type="button" onClick={() => cmd('removeFormat')} style={btn} title="Effacer la mise en forme">✕ format</button>

        <button type="button" onClick={() => setShowEmoji(s => !s)} style={btn} title="Émojis et symboles">😊 ▾</button>
      </div>

      {/* Sélecteur d'émojis */}
      {showEmoji && (
        <div style={{ position: 'absolute', zIndex: 50, top: 48, right: 8, background: 'white', border: '1px solid rgba(0,0,0,.12)', borderRadius: 10, padding: 10, boxShadow: '0 6px 24px rgba(0,0,0,.12)', display: 'grid', gridTemplateColumns: 'repeat(9,1fr)', gap: 3, maxWidth: 320 }}>
          {EMOJIS.map(em => (
            <button key={em} type="button" onClick={() => { insererTexte(em); setShowEmoji(false) }}
              style={{ fontSize: 18, padding: 4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 5 }}
              onMouseEnter={e => e.currentTarget.style.background = '#F0F9FB'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Zone éditable */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        style={{ minHeight, padding: '12px 14px', fontSize: 14, lineHeight: 1.7, fontFamily: "'DM Sans',sans-serif", color: '#1A1514', outline: 'none' }}
      />
      <style>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #A8A39D; }
        [contenteditable] ul, [contenteditable] ol { margin: 6px 0 6px 22px; }
      `}</style>
    </div>
  )
}