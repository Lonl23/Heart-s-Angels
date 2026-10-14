import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Flash } from '@/components/ui'
import {
  PAGES_FONDS, BUCKET_FONDS, urlFondPublic, styleFond, compresserFond,
  chargerFondsPages, invaliderFondsPages,
} from '@/lib/fondsPages'

export default function Apparence() {
  const { profile } = useAuth()
  const [images, setImages] = useState([])
  const [pages, setPages] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function load() {
    const etat = await chargerFondsPages()
    setImages(etat.images)
    setPages(etat.pages)
  }
  useEffect(() => { load() }, [])

  function flash(t, ok = true) {
    setMsg({ t, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function ajouter(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { flash('Choisissez une image (JPG, PNG, WebP).', false); return }
    if (file.size > 12 * 1024 * 1024) { flash('Image trop lourde (max 12 Mo).', false); return }
    setBusy(true)
    try {
      let blob
      try { blob = await compresserFond(file) }
      catch { blob = file }
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
      const path = `${id}.jpg`
      const { error: upErr } = await supabase.storage.from(BUCKET_FONDS).upload(path, blob, {
        contentType: 'image/jpeg', upsert: false,
      })
      if (upErr) throw upErr
      const nom = String(file.name || '').replace(/\.[^.]+$/, '').slice(0, 80) || 'Fond'
      const { error } = await supabase.from('app_fonds').insert({
        path, nom, created_by: profile?.id || null,
      })
      if (error) {
        await supabase.storage.from(BUCKET_FONDS).remove([path]).catch(() => {})
        throw error
      }
      invaliderFondsPages()
      await load()
      flash('Image ajoutée. Assignez-la à une page ci-dessous.')
    } catch (err) {
      flash(err.message || 'Envoi impossible.', false)
    }
    setBusy(false)
  }

  async function supprimer(img) {
    if (!confirm(`Retirer « ${img.nom || 'cette image'} » ? Les pages qui l’utilisent reviendront sans fond.`)) return
    setBusy(true)
    await supabase.from('app_fonds_pages').update({ fond_id: null }).eq('fond_id', img.id)
    await supabase.from('app_fonds').delete().eq('id', img.id)
    await supabase.storage.from(BUCKET_FONDS).remove([img.path]).catch(() => {})
    invaliderFondsPages()
    await load()
    setBusy(false)
  }

  async function assigner(page, fondId) {
    const { error } = await supabase.from('app_fonds_pages').update({
      fond_id: fondId || null,
      updated_at: new Date().toISOString(),
    }).eq('page', page)
    if (error) { flash(error.message, false); return }
    invaliderFondsPages()
    await load()
  }

  async function intensite(page, v) {
    const n = Math.max(8, Math.min(80, Number(v)))
    setPages(list => list.map(p => p.page === page ? { ...p, intensite: n } : p))
    const { error } = await supabase.from('app_fonds_pages').update({
      intensite: n,
      updated_at: new Date().toISOString(),
    }).eq('page', page)
    if (error) { flash(error.message, false); return }
    invaliderFondsPages()
  }

  return (
    <div>
      {msg && <Flash kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Flash>}
      <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 16px' }}>
        Ajoutez des photos, puis choisissez sur quelles pages elles s’affichent.
        Un voile de la couleur du thème garde les textes lisibles.
        Les pages chargées (souhaits, missions, stock, annuaire) n’ont pas de fond.
      </p>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: 10 }}>Bibliothèque</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {images.map(img => (
            <div key={img.id} style={{ width: 120 }}>
              <div style={{
                width: 120, height: 80, borderRadius: 10, overflow: 'hidden',
                border: '1px solid var(--border)', background: 'var(--bg-alt)',
              }}>
                <img src={urlFondPublic(img.path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.nom}</div>
              <button type="button" onClick={() => supprimer(img)} disabled={busy}
                style={{ background: 'none', border: 'none', color: '#C8435A', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                Retirer
              </button>
            </div>
          ))}
          {images.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune image pour le moment.</div>
          )}
        </div>
        <label style={{
          display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 9,
          background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
        }}>
          {busy ? 'Envoi…' : '+ Ajouter une image'}
          <input type="file" accept="image/*" onChange={ajouter} disabled={busy} style={{ display: 'none' }} />
        </label>
      </Card>

      {PAGES_FONDS.map(pg => {
        const row = pages.find(p => p.page === pg.k) || { page: pg.k, fond_id: null, intensite: 22 }
        const img = images.find(i => i.id === row.fond_id)
        const url = img ? urlFondPublic(img.path) : ''
        return (
          <Card key={pg.k} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--heading)' }}>{pg.l}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{pg.hint}</div>
              </div>
              <select
                value={row.fond_id || ''}
                onChange={e => assigner(pg.k, e.target.value || null)}
                style={{
                  padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, minWidth: 200,
                }}
              >
                <option value="">Aucun fond</option>
                {images.map(i => <option key={i.id} value={i.id}>{i.nom || 'Image'}</option>)}
              </select>
            </div>
            {url && (
              <>
                <div style={{
                  height: 110, borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden',
                  ...styleFond(url, row.intensite),
                }}>
                  <div style={{ padding: 14 }}>
                    <div style={{
                      display: 'inline-block', background: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--text)', fontWeight: 600,
                    }}>Aperçu</div>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Force de l’image
                  <input type="range" min={8} max={70} value={row.intensite ?? 22}
                    onChange={e => intensite(pg.k, e.target.value)} style={{ flex: 1, accentColor: 'var(--accent)' }} />
                  <span style={{ width: 36, textAlign: 'right' }}>{row.intensite ?? 22} %</span>
                </label>
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}
