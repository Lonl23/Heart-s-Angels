import { useEffect, useState } from 'react'
import { lbl, inp } from '@/components/ui'
import { GENRES, formaterNiss } from './annuaireSchema'

function SvgVenus() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" focusable="false">
      <circle cx="16" cy="11.5" r="7.2" fill="currentColor" />
      <path d="M16 19v10M11 24.5h10" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square" />
    </svg>
  )
}

function SvgMars() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" focusable="false">
      <circle cx="13.2" cy="19.2" r="7.2" fill="currentColor" />
      <path d="M18.2 13.8L26.4 5.6M19.6 5.6h6.8V12.4" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  )
}

// Symbole combiné (croix de Vénus + flèche de Mars) — option « autre », distincte.
function SvgAutre() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" focusable="false">
      <circle cx="14.5" cy="16.5" r="6.4" fill="currentColor" />
      <path d="M14.5 23v7M10.2 27.4h8.6M19.2 11.6L26.6 4.2M20.4 4.2h6.2V10.4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  )
}

const ICONS = { femme: SvgVenus, homme: SvgMars, autre: SvgAutre }

export function GenreIcon({ genre, size = 22, title }) {
  const g = GENRES.find(x => x.v === genre)
  const Icon = ICONS[genre]
  if (!g || !Icon) return null
  return (
    <span className="ha-genre-icon" title={title || g.l} style={{ color: g.color, width: size, height: size }} aria-hidden={!title}>
      <Icon />
    </span>
  )
}

export function GenrePicker({ label = 'Genre', value, set }) {
  return (
    <div className="ha-genre-picker" role="group" aria-label={label}>
      <div style={lbl}>{label}</div>
      <div className="ha-genre-row">
        {GENRES.map(g => {
          const on = value === g.v
          const Icon = ICONS[g.v]
          return (
            <button
              key={g.v}
              type="button"
              className={'ha-genre-btn' + (on ? ' is-on' : '')}
              aria-pressed={on}
              aria-label={g.l}
              title={g.l}
              onClick={() => set(on ? '' : g.v)}
              style={on ? { borderColor: g.color, background: g.bg, color: g.color } : { color: g.color }}
            >
              <Icon />
              <span>{g.l}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function NissF({ label = 'Numéro national', value, set }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={lbl}>{label}</label>
      <input
        inputMode="numeric"
        autoComplete="off"
        value={v}
        placeholder="00.00.00-000.00"
        onChange={e => setV(e.target.value)}
        onBlur={() => { const f = formaterNiss(v); setV(f); set(f) }}
        style={inp}
      />
      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3 }}>Confidentiel — personnel Heart’s Angels uniquement.</div>
    </div>
  )
}
