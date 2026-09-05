import { useState, useEffect } from 'react'
import config from '@/app.config'
// Briques d'interface partagées (thème + mobile)
export const inp = { width:'100%', padding:'9px 12px', border:'1px solid var(--border)', borderRadius:9, fontSize:13.5, background:'var(--surface)', color:'var(--text)', boxSizing:'border-box', fontFamily:'inherit' }
export const lbl = { fontSize:12.5, color:'var(--text-muted)', display:'block', marginBottom:5 }

export function Page({ title, subtitle, action, children }) {
  return (
    <div style={{ padding:'clamp(16px,3vw,28px)', width:'100%', boxSizing:'border-box' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom: subtitle ? 12 : 20 }}>
        <div>
          <h1 style={{ fontSize:'1.7rem', color:'var(--heading)', margin:0 }}>{title}</h1>
          {subtitle && <p style={{ margin:'4px 0 0', color:'var(--text-muted)', fontSize:13.5 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
export function Card({ children, style, clickable, onClick, className, ...rest }) {
  return (
    <div className={[clickable ? 'ha-click' : '', className].filter(Boolean).join(' ') || undefined}
      onClick={onClick} {...rest}
      style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px', ...style }}>
      {children}
    </div>
  )
}
export function Btn({ children, onClick, kind='primary', type='button', disabled, style, title }) {
  const kinds = {
    primary: { background:'var(--accent)', color:'#fff', border:'none' },
    soft:    { background:'var(--bg-alt)', color:'var(--text-2)', border:'1px solid var(--border)' },
    danger:  { background:'#FCEBEB', color:'#C8435A', border:'none' },
    ok:      { background:'#EAF3DE', color:'#3B6D11', border:'none' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      style={{ padding:'8px 14px', borderRadius:9, fontSize:13.5, fontWeight:600, fontFamily:'inherit', ...kinds[kind], ...style }}>
      {children}
    </button>
  )
}
export function F({ label, value, set, type='text', placeholder, required }) {
  return <div style={{ marginBottom:10 }}><label style={lbl}>{label}{required&&' *'}</label><input type={type} value={value??''} onChange={e=>set(e.target.value)} placeholder={placeholder} required={required} style={inp} /></div>
}
export function TA({ label, value, set, rows=3, placeholder }) {
  return <div style={{ marginBottom:10 }}><label style={lbl}>{label}</label><textarea value={value??''} onChange={e=>set(e.target.value)} rows={rows} placeholder={placeholder} style={{ ...inp, resize:'vertical' }} /></div>
}
export function Sel({ label, value, set, options }) {
  return <div style={{ marginBottom:10 }}><label style={lbl}>{label}</label><select value={value??''} onChange={e=>set(e.target.value)} style={inp}>{options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
}

export function Tabs({ items, value, onChange, extra }) {
  return (
    <div className="ha-tabs">
      {items.map(it => (
        <button key={it.v} type="button" className={'ha-tab' + (value===it.v ? ' is-on' : '')} onClick={()=>onChange(it.v)}>
          {it.l}{it.badge > 0 && <span className="ha-tab-badge">{it.badge}</span>}
        </button>
      ))}
      {extra && <span style={{ marginLeft:'auto', alignSelf:'center', paddingBottom:8 }}>{extra}</span>}
    </div>
  )
}

export function Empty({ title, hint, action }) {
  return (
    <div className="ha-empty">
      <div style={{ fontWeight:600, color:'var(--text-2)' }}>{title}</div>
      {hint && <p>{hint}</p>}
      {action && <div style={{ marginTop:14 }}>{action}</div>}
    </div>
  )
}

export function Flash({ kind='ok', children }) {
  return <div className={'ha-flash ha-flash-' + kind}>{children}</div>
}

export function StatutFlow({ value, info, pipeline, extras=[], onPick, locked=false }) {
  return (
    <div className="ha-step">
      {pipeline.map((k, i) => {
        const st = info(k)
        const on = value === k
        return (
          <span key={k} style={{ display:'contents' }}>
            {i > 0 && <span className="ha-step-sep">›</span>}
            <button type="button" className={'ha-step-btn' + (on ? ' is-on' : '')}
              disabled={locked && !on}
              style={on ? { background: st.c, color:'#fff' } : { color: st.c, borderColor: st.c + '55' }}
              onClick={()=>{ if (locked) return; onPick(k) }} title={locked && !on ? 'Statut verrouillé' : st.l}>
              {st.l}
            </button>
          </span>
        )
      })}
      {extras.map(k => {
        const st = info(k)
        const on = value === k
        return (
          <button key={k} type="button" className={'ha-step-btn' + (on ? ' is-on' : '')}
            disabled={locked && !on}
            style={on ? { background: st.c, color:'#fff' } : { color: st.c, borderColor: st.c + '66' }}
            onClick={()=>{ if (locked) return; onPick(k) }}>
            {st.l}
          </button>
        )
      })}
    </div>
  )
}

export function Loading({ text='Chargement…' }) {
  return <p style={{ color:'var(--text-muted)', padding:'8px 0' }}>{text}</p>
}

// Formats belges autorisés : +32 xxx.xx.xx.xx (9 chiffres, GSM) ou +32 xx.xx.xx.xx (8 chiffres, fixe).
export const PHONE_AIDE = 'Formats : +32 xxx.xx.xx.xx (GSM) ou +32 xx.xx.xx.xx (fixe)'

export function digitsPhoneBE(raw) {
  let s = String(raw || '').replace(/\D/g, '')
  if (s.startsWith('00')) s = s.slice(2)
  if (s.startsWith('32')) s = s.slice(2)
  if (s.startsWith('0')) s = s.slice(1)
  return s
}

export function formatPhone(raw) {
  if (!raw || !String(raw).trim()) return ''
  const d = digitsPhoneBE(raw)
  if (!d) return ''
  const grouper = (head, rest) => {
    const parts = head ? [head] : []
    for (let i = 0; i < rest.length; i += 2) parts.push(rest.slice(i, i + 2))
    return `+32 ${parts.filter(Boolean).join('.')}`
  }
  if (d.length >= 9) return grouper(d.slice(0, 3), d.slice(3, 9))
  if (d.length === 8) return grouper(d.slice(0, 2), d.slice(2, 8))
  if (d[0] === '4' && d.length > 2) return grouper(d.slice(0, 3), d.slice(3))
  return grouper('', d)
}

export function phoneValide(raw) {
  if (!raw || !String(raw).trim()) return true
  const d = digitsPhoneBE(raw)
  return d.length === 8 || d.length === 9
}

export function PhoneF({ label, value, set, required, placeholder = '+32 xxx.xx.xx.xx' }) {
  const [v, setV] = useState(value ?? '')
  const [err, setErr] = useState(false)
  useEffect(() => { setV(value ?? '') }, [value])
  function commit() {
    const f = formatPhone(v)
    setV(f)
    set(f)
    setErr(!!f && !phoneValide(f))
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={lbl}>{label}{required && ' *'}</label>
      <input type="tel" value={v} placeholder={placeholder}
        onChange={e => { setV(e.target.value); setErr(false) }}
        onBlur={commit}
        style={{ ...inp, borderColor: err ? '#C8435A' : undefined }} />
      <div style={{ fontSize: 11.5, color: err ? '#C8435A' : 'var(--text-faint)', marginTop: 3 }}>{PHONE_AIDE}</div>
    </div>
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="ha-modal-scrim" onClick={onClose} role="presentation">
      <div className={'ha-modal' + (wide ? ' is-wide' : '')} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ha-modal-head">
          <div className="ha-modal-title">{title}</div>
          <button type="button" className="ha-modal-x" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="ha-modal-body">{children}</div>
        {footer && <div className="ha-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function fmtAdresse(a) {
  if (!a || typeof a !== 'object') return typeof a === 'string' ? a : ''
  const l1 = [a.rue, a.numero].filter(Boolean).join(' ')
  const l2 = [a.cp, a.localite].filter(Boolean).join(' ')
  return [l1, l2, a.pays].filter(Boolean).join(', ')
}

export function texteGps(a) {
  if (!a) return ''
  if (typeof a === 'string') return a.trim()
  return fmtAdresse(a)
}

export function urlGoogleMaps(a) {
  const q = texteGps(a)
  if (!q) return ''
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
}

export function urlWaze(a) {
  const q = texteGps(a)
  if (!q) return ''
  return `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`
}

export function LiensGps({ adresse, texte, onClick }) {
  const q = texte || texteGps(adresse)
  if (!q) return null
  const stop = e => { e.stopPropagation(); onClick?.(e) }
  return (
    <span className="ha-gps" onClick={stop}>
      <a className="ha-gps-btn" href={urlGoogleMaps(q)} target="_blank" rel="noopener noreferrer" onClick={stop}>Google Maps</a>
      <a className="ha-gps-btn is-waze" href={urlWaze(q)} target="_blank" rel="noopener noreferrer" onClick={stop}>Waze</a>
    </span>
  )
}

export function AdresseAffichee({ value, texte, label, compact }) {
  const t = texte || texteGps(value)
  if (!t) return null
  return (
    <div className={'ha-addr' + (compact ? ' is-compact' : '')}>
      {label && <div className="ha-addr-lab">{label}</div>}
      <div className="ha-addr-txt">{t}</div>
      <LiensGps adresse={value} texte={t} />
    </div>
  )
}

export function AddressFields({ value, set }) {
  const a = value && typeof value === 'object' ? value : {}
  const up = (k, v) => set({ ...a, [k]: v })
  const txt = fmtAdresse(a)
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'0 10px' }}>
        <F label="Rue" value={a.rue||''} set={v=>up('rue',v)} />
        <F label="Numéro" value={a.numero||''} set={v=>up('numero',v)} />
        <F label="Code postal" value={a.cp||''} set={v=>up('cp',v)} />
        <F label="Localité" value={a.localite||''} set={v=>up('localite',v)} />
        <div style={{ gridColumn:'1 / -1' }}><F label="Pays" value={a.pays||''} set={v=>up('pays',v)} /></div>
      </div>
      {txt && (
        <div style={{ margin: '-4px 0 10px' }}>
          <LiensGps adresse={a} />
        </div>
      )}
    </div>
  )
}

export function Pill({ children, color='var(--accent)', bg='var(--bg-alt)' }) {
  return <span style={{ background:bg, color, padding:'2px 9px', borderRadius:99, fontSize:11.5, fontWeight:600, whiteSpace:'nowrap' }}>{children}</span>
}

export function Logo({ size = 72, style, className }) {
  const src = config.organisation?.logoUrl || '/icons/ha-logo-512-v4.png'
  return (
    <img src={src} alt={config.organisation?.nom || "Heart's Angels"} width={size} height={size}
      className={className}
      style={{ display:'block', objectFit:'contain', flexShrink:0, ...style }} />
  )
}
