import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Upload de photo réutilisable AVEC recadrage.
 * Props :
 *  - value, onChange(url), folder
 *  - shape : 'circle' | 'square'
 *  - size : taille de l'aperçu en px (défaut 96)
 *  - label : texte du bouton
 *  - aspect : ratio de recadrage L/H (défaut 1 = carré ; 1.78 = 16:9 ; 2.4 = bandeau large)
 *  - sortie : largeur de sortie en px (défaut 800)
 */
export default function PhotoUpload({
  value, onChange, folder = 'divers',
  shape = 'circle', size = 96, label = 'Choisir une photo',
  aspect = 1, sortie = 800,
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(value || null)
  const [cropSrc, setCropSrc] = useState(null)   // image à recadrer (dataURL)
  const inputRef = useRef(null)

  useEffect(() => { setPreview(value || null) }, [value])

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    if (file.size > 8 * 1024 * 1024) { setError('Fichier trop volumineux (max 8 Mo).'); return }
    if (!file.type.startsWith('image/')) { setError('Seules les images sont acceptées.'); return }
    // Charger en dataURL pour le recadrage
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result)
    reader.readAsDataURL(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function uploadBlob(blob) {
    setUploading(true)
    const localUrl = URL.createObjectURL(blob)
    setPreview(localUrl)
    try {
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`
      const { error: upErr } = await supabase.storage.from('uploads')
        .upload(fileName, blob, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName)
      setPreview(urlData.publicUrl)
      onChange(urlData.publicUrl)
    } catch (err) {
      setError('Erreur upload : ' + (err.message || 'réessayez'))
      setPreview(value || null)
    }
    setUploading(false)
  }

  function removePhoto() {
    setPreview(null); onChange('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const radius = shape === 'circle' ? '50%' : '14px'

  return (
    <div style={{ display:'flex', alignItems:'center', gap:16 }}>
      <div style={{ position:'relative', flexShrink:0 }}>
        {preview ? (
          <img src={preview} alt="" style={{ width:size, height:size, borderRadius:radius, objectFit:'cover', border:'2px solid #E6F7FA' }}/>
        ) : (
          <div style={{ width:size, height:size, borderRadius:radius, background:'#F0F9FB', border:'2px dashed rgba(27,176,206,.3)', display:'flex', alignItems:'center', justifyContent:'center', color:'#1BB0CE', fontSize:size*0.32 }}>📷</div>
        )}
        {uploading && (
          <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,.75)', borderRadius:radius, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:24, height:24, border:'3px solid rgba(27,176,206,.2)', borderTopColor:'#1BB0CE', borderRadius:'50%', animation:'phup .7s linear infinite' }}/>
            <style>{`@keyframes phup{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display:'none' }}/>
        <button type="button" onClick={()=>inputRef.current?.click()} disabled={uploading}
          style={{ padding:'8px 16px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:uploading?'wait':'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          {uploading ? '⏳ Envoi…' : (preview ? '📷 Changer' : label)}
        </button>
        {preview && !uploading && (
          <button type="button" onClick={removePhoto}
            style={{ padding:'6px 14px', background:'none', color:'#C8435A', border:'1px solid rgba(200,67,90,.2)', borderRadius:8, fontSize:12.5, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            Retirer
          </button>
        )}
        <span style={{ fontSize:11, color:'#A8A39D' }}>JPG, PNG, WebP · max 8 Mo</span>
        {error && <span style={{ fontSize:11.5, color:'#C8435A' }}>{error}</span>}
      </div>

      {cropSrc && (
        <CropModal src={cropSrc} aspect={aspect} sortie={sortie} shape={shape}
          onCancel={()=>setCropSrc(null)}
          onConfirm={async (blob)=>{ setCropSrc(null); await uploadBlob(blob) }}/>
      )}
    </div>
  )
}

// ── Fenêtre de recadrage (zoom + déplacement) ─────────────────────────────────
function CropModal({ src, aspect, sortie, shape, onCancel, onConfirm }) {
  const VIEW_W = 340
  const VIEW_H = Math.round(VIEW_W / aspect)
  const imgRef = useRef(null)
  const [nat, setNat] = useState({ w:0, h:0 })
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x:0, y:0 })
  const drag = useRef(null)

  // Échelle de base pour "couvrir" la zone
  const baseCover = nat.w && nat.h ? Math.max(VIEW_W / nat.w, VIEW_H / nat.h) : 1
  const scale = baseCover * zoom
  const dispW = nat.w * scale
  const dispH = nat.h * scale

  // Contraindre l'image pour qu'elle couvre toujours la zone
  function clamp(o) {
    const minX = VIEW_W - dispW, minY = VIEW_H - dispH
    return { x: Math.min(0, Math.max(minX, o.x)), y: Math.min(0, Math.max(minY, o.y)) }
  }
  useEffect(() => { setOff(o => clamp(o)) }, [zoom, nat])  // eslint-disable-line

  function onImgLoad(e) {
    const w = e.target.naturalWidth, h = e.target.naturalHeight
    setNat({ w, h })
    // centrer
    const bc = Math.max(VIEW_W / w, VIEW_H / h)
    setOff({ x: (VIEW_W - w*bc)/2, y: (VIEW_H - h*bc)/2 })
  }
  function start(e) {
    const p = e.touches ? e.touches[0] : e
    drag.current = { px:p.clientX, py:p.clientY, ox:off.x, oy:off.y }
  }
  function move(e) {
    if (!drag.current) return
    const p = e.touches ? e.touches[0] : e
    setOff(clamp({ x: drag.current.ox + (p.clientX - drag.current.px), y: drag.current.oy + (p.clientY - drag.current.py) }))
  }
  function end() { drag.current = null }

  function valider() {
    const outW = sortie, outH = Math.round(sortie / aspect)
    const canvas = document.createElement('canvas')
    canvas.width = outW; canvas.height = outH
    const ctx = canvas.getContext('2d')
    // zone source dans l'image d'origine
    const srcX = (-off.x) / scale, srcY = (-off.y) / scale
    const srcW = VIEW_W / scale, srcH = VIEW_H / scale
    ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, outW, outH)
    canvas.toBlob(b => { if (b) onConfirm(b) }, 'image/jpeg', 0.9)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'white', borderRadius:18, padding:'22px', width:'100%', maxWidth:420 }}>
        <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:600, color:'#1A1514', fontFamily:"'Cormorant Garamond',Georgia,serif" }}>Recadrer l'image</h3>
        <p style={{ fontSize:12.5, color:'#7A7470', marginBottom:14 }}>Déplacez et zoomez pour cadrer ce que vous voulez afficher.</p>

        {/* Zone de recadrage */}
        <div
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          style={{ position:'relative', width:VIEW_W, height:VIEW_H, margin:'0 auto', overflow:'hidden', borderRadius: shape==='circle'?'50%':'12px', background:'#222', cursor:'grab', touchAction:'none', userSelect:'none' }}>
          <img ref={imgRef} src={src} alt="" onLoad={onImgLoad} draggable={false}
            style={{ position:'absolute', left:off.x, top:off.y, width:dispW, height:dispH, maxWidth:'none', pointerEvents:'none' }}/>
          {/* grille de tiers */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px)', backgroundSize:`${VIEW_W/3}px ${VIEW_H/3}px` }}/>
        </div>

        {/* Zoom */}
        <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0 18px' }}>
          <span style={{ fontSize:16 }}>🔍</span>
          <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={e=>setZoom(parseFloat(e.target.value))}
            style={{ flex:1, accentColor:'#1BB0CE' }}/>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button type="button" onClick={onCancel} style={{ flex:1, padding:11, background:'none', border:'1px solid rgba(0,0,0,.12)', borderRadius:9, fontSize:13.5, color:'#7A7470', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Annuler</button>
          <button type="button" onClick={valider} style={{ flex:2, padding:11, background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>✓ Recadrer et envoyer</button>
        </div>
      </div>
    </div>
  )
}