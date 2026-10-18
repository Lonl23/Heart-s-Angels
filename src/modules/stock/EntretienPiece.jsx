import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, F, Sel, TA } from '@/components/ui'
import { TYPES_ENTRETIEN, lblEntretien, ajouterMois } from './stockSchema'
import { fmtDlc } from './lotsStock'

const BUCKET = 'stock-commandes'
const MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']

function nouvelId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16)
  })
}

export default function EntretienPiece({ unite, onOk, onErr, onChange }) {
  const [serie, setSerie] = useState(unite.numero_serie || '')
  const [service, setService] = useState(unite.mise_en_service || '')
  const [lignes, setLignes] = useState([])
  const [dateFait, setDateFait] = useState('')
  const [type, setType] = useState('controle')
  const [prochain, setProchain] = useState('')
  const [auto, setAuto] = useState('')
  const [notes, setNotes] = useState('')
  const [fichier, setFichier] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSerie(unite.numero_serie || '')
    setService(unite.mise_en_service || '')
  }, [unite.id, unite.numero_serie, unite.mise_en_service])

  async function charger() {
    const { data, error } = await supabase.from('stock_unite_entretiens')
      .select('id,date_fait,date_prochain,type,notes,document_nom,document_path,created_at')
      .eq('unite_id', unite.id)
      .order('date_fait', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { onErr?.(error.message); return }
    setLignes(data || [])
  }
  useEffect(() => { charger() }, [unite.id])

  function choisirDate(v) {
    setDateFait(v)
    if (!unite.entretien_mois) return
    if (prochain && prochain !== auto) return
    const n = ajouterMois(v, unite.entretien_mois)
    setProchain(n)
    setAuto(n)
  }

  async function sauverIdentite() {
    const patch = {
      numero_serie: serie.trim() || null,
      mise_en_service: service || null,
    }
    const { error } = await supabase.from('stock_unites').update(patch).eq('id', unite.id)
    if (error) { onErr?.(error.message); return }
    onOk?.('Pièce enregistrée.')
    onChange?.()
  }

  async function ajouter() {
    if (!dateFait) { onErr?.('Indiquez la date de l’entretien.'); return }
    if (fichier && fichier.size > 15 * 1024 * 1024) { onErr?.('Document trop lourd (max 15 Mo).'); return }
    if (fichier?.type && !MIME.includes(fichier.type)) { onErr?.('Format accepté : PDF, JPG ou PNG.'); return }
    const id = nouvelId()
    let path = null
    setBusy(true)
    if (fichier) {
      const ext = (fichier.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
      path = `entretien/${unite.id}/${id}.${ext}`
      const up = await supabase.storage.from(BUCKET).upload(path, fichier, { upsert: false, contentType: fichier.type || undefined })
      if (up.error) { setBusy(false); onErr?.(up.error.message); return }
    }
    const { data: auth } = await supabase.auth.getUser()
    const { error } = await supabase.from('stock_unite_entretiens').insert({
      id,
      unite_id: unite.id,
      date_fait: dateFait,
      date_prochain: prochain || null,
      type,
      notes: notes.trim() || null,
      document_nom: fichier?.name || null,
      document_path: path,
      document_mime: fichier?.type || null,
      par: auth?.user?.id || null,
    })
    if (error) {
      if (path) await supabase.storage.from(BUCKET).remove([path])
      setBusy(false)
      onErr?.(error.message)
      return
    }
    if (type === 'mise_en_service' && !service) {
      await supabase.from('stock_unites').update({ mise_en_service: dateFait }).eq('id', unite.id)
      setService(dateFait)
    }
    setBusy(false)
    setDateFait('')
    setProchain('')
    setAuto('')
    setNotes('')
    setFichier(null)
    setType('controle')
    onOk?.('Entretien enregistré.')
    charger()
    onChange?.()
  }

  async function ouvrir(ligne) {
    if (!ligne.document_path) return
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ligne.document_path, 3600)
    if (error || !data?.signedUrl) { onErr?.(error?.message || 'Ouverture impossible.'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function retirer(ligne) {
    if (!confirm('Retirer cet entretien ?')) return
    if (ligne.document_path) await supabase.storage.from(BUCKET).remove([ligne.document_path])
    const { error } = await supabase.from('stock_unite_entretiens').delete().eq('id', ligne.id)
    if (error) { onErr?.(error.message); return }
    charger()
    onChange?.()
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Entretien de cette pièce</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>
        Pour le matériel seulement, par exemple une batterie de défibrillateur.
        {unite.entretien_mois ? ` Rythme conseillé : tous les ${unite.entretien_mois} mois.` : ''}
      </div>
      <F label="N° de série" value={serie} set={setSerie} placeholder="tel qu’inscrit sur la pièce" />
      <F label="Mise en service" type="date" value={service} set={setService} />
      <Btn kind="soft" onClick={sauverIdentite} style={{ marginBottom: 12 }}>Enregistrer la pièce</Btn>

      {lignes.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Aucun entretien renseigné.</div>
      )}
      {lignes.map(l => {
        const retard = l.date_prochain && l.date_prochain < new Date().toISOString().slice(0, 10)
        return (
          <div key={l.id} style={{ fontSize: 13, marginBottom: 8 }}>
            <div>
              <strong>{lblEntretien(l.type)}</strong>
              {` · fait le ${fmtDlc(l.date_fait)}`}
              {l.date_prochain ? ` · prochain ${fmtDlc(l.date_prochain)}` : ''}
              {retard ? ' · en retard' : ''}
            </div>
            {l.notes && <div style={{ color: 'var(--text-2)' }}>{l.notes}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {l.document_path && (
                <button type="button" onClick={() => ouvrir(l)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {l.document_nom || 'Attestation'}
                </button>
              )}
              <Btn kind="danger" onClick={() => retirer(l)} style={{ padding: '3px 8px' }}>Retirer</Btn>
            </div>
          </div>
        )
      })}

      <div style={{ fontWeight: 700, fontSize: 13, margin: '8px 0 6px' }}>Ajouter un entretien</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <F label="Date réalisée" type="date" value={dateFait} set={choisirDate} />
        <F label="Prochain entretien" type="date" value={prochain} set={v => setProchain(v)} />
      </div>
      <Sel label="Type" value={type} set={setType} options={TYPES_ENTRETIEN} />
      <TA label="Notes" value={notes} set={setNotes} rows={2} placeholder="Résultat, personne, n° de bon…" />
      <label className="ha-stock-photo-btn" style={{ marginBottom: 8 }}>
        {fichier ? fichier.name : 'Joindre une attestation (PDF ou photo)'}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf" disabled={busy}
          onChange={e => { setFichier(e.target.files?.[0] || null); e.target.value = '' }} />
      </label>
      <Btn onClick={ajouter} disabled={busy}>{busy ? '…' : 'Enregistrer l’entretien'}</Btn>
    </div>
  )
}
