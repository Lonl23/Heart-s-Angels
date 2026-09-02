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

export function StatutFlow({ value, info, pipeline, extras=[], onPick }) {
  return (
    <div className="ha-step">
      {pipeline.map((k, i) => {
        const st = info(k)
        const on = value === k
        return (
          <span key={k} style={{ display:'contents' }}>
            {i > 0 && <span className="ha-step-sep">›</span>}
            <button type="button" className={'ha-step-btn' + (on ? ' is-on' : '')}
              style={on ? { background: st.c, color:'#fff' } : { color: st.c, borderColor: st.c + '55' }}
              onClick={()=>onPick(k)} title={st.l}>
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
            style={on ? { background: st.c, color:'#fff' } : { color: st.c, borderColor: st.c + '66' }}
            onClick={()=>onPick(k)}>
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

// Formate un numéro : +indicatif puis groupé xxx.xx.xx.xx
export function formatPhone(raw) {
  if (!raw) return ''
  let s = String(raw).trim().replace(/[^\d+]/g, '')
  let cc = '', rest = s
  if (s.startsWith('+')) {
    const digits = s.slice(1)
    const three = ['352','377','378','379','380','381','382','383','385','386','387','389','420','421','423','350','356','357']
    const one = ['1','7']
    let n = 2
    if (three.includes(digits.slice(0,3))) n = 3
    else if (one.includes(digits.slice(0,1))) n = 1
    cc = '+' + digits.slice(0, n); rest = digits.slice(n)
  } else if (s.startsWith('00')) {
    return formatPhone('+' + s.slice(2))
  }
  const groups = []
  if (rest.length) { groups.push(rest.slice(0,3)); let r = rest.slice(3); while (r.length) { groups.push(r.slice(0,2)); r = r.slice(2) } }
  const nat = groups.join('.')
  return cc ? `${cc} ${nat}`.trim() : nat
}

export function PhoneF({ label, value, set, required, placeholder='+32 477.07.11.34' }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <div style={{ marginBottom:10 }}>
      <label style={lbl}>{label}{required && ' *'}</label>
      <input type="tel" value={v} placeholder={placeholder}
        onChange={e=>setV(e.target.value)}
        onBlur={()=>{ const f = formatPhone(v); setV(f); set(f) }}
        style={inp} />
    </div>
  )
}

export function fmtAdresse(a) {
  if (!a || typeof a !== 'object') return typeof a === 'string' ? a : ''
  const l1 = [a.rue, a.numero].filter(Boolean).join(' ')
  const l2 = [a.cp, a.localite].filter(Boolean).join(' ')
  return [l1, l2, a.pays].filter(Boolean).join(', ')
}

export function AddressFields({ value, set }) {
  const a = value && typeof value === 'object' ? value : {}
  const up = (k, v) => set({ ...a, [k]: v })
  return (
    <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'0 10px' }}>
      <F label="Rue" value={a.rue||''} set={v=>up('rue',v)} />
      <F label="Numéro" value={a.numero||''} set={v=>up('numero',v)} />
      <F label="Code postal" value={a.cp||''} set={v=>up('cp',v)} />
      <F label="Localité" value={a.localite||''} set={v=>up('localite',v)} />
      <div style={{ gridColumn:'1 / -1' }}><F label="Pays" value={a.pays||''} set={v=>up('pays',v)} /></div>
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
