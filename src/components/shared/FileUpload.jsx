// src/components/shared/FileUpload.jsx
// Upload d'un fichier (PDF, image…) vers le bucket Supabase 'uploads'. Renvoie l'URL publique.
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function FileUpload({ value, onChange, label = 'Joindre un PDF', accept = 'application/pdf', folder = 'documents' }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`
      const { error: upErr } = await supabase.storage.from('uploads')
        .upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName)
      onChange({ url: urlData.publicUrl, nom: file.name })
    } catch (err) {
      setError('Erreur upload : ' + (err.message || 'réessayez'))
    }
    setUploading(false)
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} style={{ display: 'none' }} />
      {value?.url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0F9FB', borderRadius: 8, padding: '8px 12px' }}>
          <a href={value.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 13, color: '#0E7A93', fontWeight: 600, textDecoration: 'none' }}>📄 {value.nom || 'Document'}</a>
          <button type="button" onClick={() => onChange(null)} style={{ background: '#FCEBEB', color: '#C8435A', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          style={{ padding: '8px 14px', background: '#E6F7FA', color: '#0E7A93', border: '1px dashed rgba(14,122,147,.4)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: uploading ? 'wait' : 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
          {uploading ? '⏳ Envoi…' : `📎 ${label}`}
        </button>
      )}
      {error && <div style={{ fontSize: 12, color: '#C8435A', marginTop: 4 }}>{error}</div>}
    </div>
  )
}