import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, inp } from '@/components/ui'

export const COTES = [
  { id:'avant',   l:'Avant' },
  { id:'arriere', l:'Arrière' },
  { id:'gauche',  l:'Côté gauche' },
  { id:'droit',   l:'Côté droit' },
]

export async function compressImage(file) {
  try {
    const bmp = await createImageBitmap(file)
    const max = 1600
    let w = bmp.width, h = bmp.height
    if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r) }
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    c.getContext('2d').drawImage(bmp, 0, 0, w, h)
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.82))
    bmp.close?.()
    return blob || file
  } catch {
    return file
  }
}

const urlCache = new Map()
export async function signedPhoto(path) {
  if (!path) return null
  const hit = urlCache.get(path)
  if (hit && hit.exp > Date.now()) return hit.url
  const { data } = await supabase.storage.from('mission-photos').createSignedUrl(path, 8 * 3600)
  const url = data?.signedUrl || null
  if (url) urlCache.set(path, { url, exp: Date.now() + 7 * 3600 * 1000 })
  return url
}

export async function uploadMissionPhoto(souhaitId, vecteurId, slot, file) {
  const blob = await compressImage(file)
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  const path = `${souhaitId}/${vecteurId}/${slot}/${id}.jpg`
  const { error } = await supabase.storage.from('mission-photos').upload(path, blob, {
    contentType: 'image/jpeg', upsert: false,
  })
  if (error) throw error
  return { id, path, marks: [], note: '', at: new Date().toISOString() }
}

export function PhotoMarks({ marks, onPointer }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="ha-photo-svg"
      onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer}>
      {(marks || []).map((mk, i) => mk.type === 'rect'
        ? <rect key={i} x={mk.x * 100} y={mk.y * 100} width={mk.w * 100} height={mk.h * 100}
            fill="rgba(200,67,90,.22)" stroke="#C8435A" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        : <g key={i}>
            <circle cx={mk.x * 100} cy={mk.y * 100} r="2.2" fill="#C8435A" stroke="#fff" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          </g>
      )}
    </svg>
  )
}

export function PhotoThumb({ meta, onOpen, onAnnotate }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { signedPhoto(meta?.path).then(setUrl) }, [meta?.path])
  if (!meta?.path) return null
  const n = (meta.marks || []).length
  return (
    <button type="button" className="ha-photo-thumb" onClick={() => (onAnnotate || onOpen)?.(meta)}>
      {url ? <img src={url} alt="" /> : <div className="ha-photo-ph" />}
      {n > 0 && <span className="ha-photo-badge">{n} dégât{n > 1 ? 's' : ''}</span>}
    </button>
  )
}

export function PhotoAnnotator({ meta, onSave, onClose }) {
  const [url, setUrl] = useState(null)
  const [marks, setMarks] = useState(meta.marks || [])
  const [note, setNote] = useState(meta.note || '')
  const [tool, setTool] = useState('point')
  const [draft, setDraft] = useState(null)
  const box = useRef(null)

  useEffect(() => { signedPhoto(meta.path).then(setUrl) }, [meta.path])

  function rel(e) {
    const r = box.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    return { x, y }
  }
  function onPointer(e) {
    if (!box.current) return
    if (e.type === 'pointerdown') {
      e.currentTarget.setPointerCapture?.(e.pointerId)
      const p = rel(e)
      if (tool === 'point') {
        setMarks(m => [...m, { type:'point', x:p.x, y:p.y }])
      } else {
        setDraft({ type:'rect', x:p.x, y:p.y, w:0, h:0, ox:p.x, oy:p.y })
      }
    } else if (e.type === 'pointermove' && draft) {
      const p = rel(e)
      const x = Math.min(draft.ox, p.x), y = Math.min(draft.oy, p.y)
      setDraft({ ...draft, x, y, w: Math.abs(p.x - draft.ox), h: Math.abs(p.y - draft.oy) })
    } else if (e.type === 'pointerup' && draft) {
      if (draft.w > 0.02 && draft.h > 0.02) setMarks(m => [...m, { type:'rect', x:draft.x, y:draft.y, w:draft.w, h:draft.h }])
      setDraft(null)
    }
  }

  const shown = draft ? [...marks, draft] : marks

  return (
    <div className="ha-annot-scrim" onClick={onClose}>
      <div className="ha-annot" onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight:700, color:'var(--heading)', marginBottom:8 }}>Marquer un dégât</div>
        <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 10px' }}>
          Touchez la photo pour poser un point, ou dessinez un cadre autour de la zone abîmée.
        </p>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <button type="button" className={'ha-tab-like' + (tool==='point'?' is-on':'')} onClick={()=>setTool('point')}>Point</button>
          <button type="button" className={'ha-tab-like' + (tool==='zone'?' is-on':'')} onClick={()=>setTool('zone')}>Zone</button>
          <button type="button" className="ha-tab-like" onClick={()=>setMarks(m => m.slice(0,-1))} disabled={!marks.length}>Annuler le dernier</button>
        </div>
        <div ref={box} className="ha-annot-img" style={{ touchAction:'none' }}>
          {url && <img src={url} alt="" draggable={false} />}
          <PhotoMarks marks={shown} onPointer={onPointer} />
        </div>
        <label style={{ display:'block', fontSize:12, color:'var(--text-muted)', margin:'10px 0 4px' }}>Précision (optionnel)</label>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex. : rayure portière avant droite" style={inp} />
        <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
          <Btn onClick={()=>onSave({ ...meta, marks, note })}>Enregistrer</Btn>
          <Btn kind="soft" onClick={()=>onSave({ ...meta, marks:[], note:'' })}>Aucun dégât</Btn>
          <Btn kind="soft" onClick={onClose}>Fermer</Btn>
        </div>
      </div>
    </div>
  )
}

export function CoinPhotos({ coins, onCapture, onAnnotate, onDelete, disabled, hint }) {
  return (
    <div>
      <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>
        {hint || 'Photographiez les 4 côtés du véhicule. S\'il y a un dégât, marquez-le sur la photo.'}
      </div>
      <div className="ha-coins">
        {COTES.map(c => {
          const meta = coins?.[c.id]
          return (
            <div key={c.id} className="ha-coin">
              <div className="ha-coin-label">{c.l}</div>
              {meta?.path
                ? <PhotoThumb meta={meta} onAnnotate={()=>onAnnotate(c.id, meta)} />
                : (
                  <label className="ha-coin-empty">
                    <input type="file" accept="image/*" capture="environment" disabled={disabled}
                      onChange={e => { const f = e.target.files?.[0]; e.target.value=''; if (f) onCapture(c.id, f) }} />
                    <span>📷 Prendre</span>
                  </label>
                )}
              {meta?.path && (
                <div className="ha-coin-actions">
                  <label className="ha-coin-replace">
                    <input type="file" accept="image/*" capture="environment" disabled={disabled}
                      onChange={e => { const f = e.target.files?.[0]; e.target.value=''; if (f) onCapture(c.id, f) }} />
                    Reprendre
                  </label>
                  {onDelete && (
                    <button type="button" className="ha-coin-delete" disabled={disabled}
                      onClick={() => onDelete(c.id)}>
                      Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TicketPhoto({ meta, onCapture, disabled }) {
  return (
    <div>
      <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>
        Photographiez le ticket de caisse du carburant (plein ou appoint).
      </div>
      {meta?.path
        ? (
          <div style={{ maxWidth: 280 }}>
            <PhotoThumb meta={meta} />
            <label className="ha-coin-replace">
              <input type="file" accept="image/*" capture="environment" disabled={disabled}
                onChange={e => { const f = e.target.files?.[0]; e.target.value=''; if (f) onCapture(f) }} />
              Reprendre
            </label>
          </div>
        )
        : (
          <label className="ha-coin-empty" style={{ maxWidth: 280 }}>
            <input type="file" accept="image/*" capture="environment" disabled={disabled}
              onChange={e => { const f = e.target.files?.[0]; e.target.value=''; if (f) onCapture(f) }} />
            <span>📷 Ticket carburant</span>
          </label>
        )}
    </div>
  )
}
