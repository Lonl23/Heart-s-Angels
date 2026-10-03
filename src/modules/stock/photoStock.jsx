import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { compressImage } from '../souhaits/TerrainPhotos'

const urlCache = new Map()

export async function signedStockPhoto(path) {
  if (!path) return null
  const hit = urlCache.get(path)
  if (hit && hit.exp > Date.now()) return hit.url
  const { data } = await supabase.storage.from('stock-photos').createSignedUrl(path, 8 * 3600)
  const url = data?.signedUrl || null
  if (url) urlCache.set(path, { url, exp: Date.now() + 7 * 3600 * 1000 })
  return url
}

export async function uploadPhotoCatalogue(catalogueId, file) {
  const blob = await compressImage(file)
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  const path = `catalogue/${catalogueId}/${id}.jpg`
  const { error } = await supabase.storage.from('stock-photos').upload(path, blob, {
    contentType: 'image/jpeg', upsert: false,
  })
  if (error) throw error
  return path
}

export function PhotoArticle({ path, size = 56, onClick }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { signedStockPhoto(path).then(setUrl) }, [path])
  if (!path) {
    return <div className="ha-stock-photo ha-stock-photo-empty" style={{ width:size, height:size }} aria-hidden />
  }
  return (
    <div className="ha-stock-photo" style={{ width:size, height:size, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      {url ? <img src={url} alt="" /> : <div className="ha-stock-photo-ph" />}
    </div>
  )
}

export function PhotoArticleChamp({ path, catalogueId, onChange, onErr }) {
  const [busy, setBusy] = useState(false)
  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !catalogueId) return
    setBusy(true)
    try {
      const next = await uploadPhotoCatalogue(catalogueId, file)
      if (path) await supabase.storage.from('stock-photos').remove([path]).catch(() => {})
      const { error } = await supabase.from('stock_catalogue').update({ photo_path: next }).eq('id', catalogueId)
      if (error) throw error
      onChange?.(next)
    } catch (err) {
      onErr?.(err.message || 'Photo impossible à enregistrer.')
    }
    setBusy(false)
  }
  async function retirer() {
    if (!catalogueId || !path) return
    setBusy(true)
    await supabase.storage.from('stock-photos').remove([path]).catch(() => {})
    const { error } = await supabase.from('stock_catalogue').update({ photo_path: null }).eq('id', catalogueId)
    setBusy(false)
    if (error) { onErr?.(error.message); return }
    onChange?.(null)
  }
  return (
    <div className="ha-stock-photo-champ">
      <PhotoArticle path={path} size={72} />
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <label className="ha-stock-photo-btn">
          {busy ? '…' : (path ? 'Changer la photo' : 'Ajouter une photo')}
          <input type="file" accept="image/*" onChange={onFile} disabled={busy || !catalogueId} />
        </label>
        {path && <button type="button" className="ha-stock-photo-del" onClick={retirer} disabled={busy}>Retirer</button>}
        {!catalogueId && <span style={{ fontSize:12, color:'var(--text-muted)' }}>Enregistrez d’abord le type, puis ajoutez la photo.</span>}
      </div>
    </div>
  )
}
