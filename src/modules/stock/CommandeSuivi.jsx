import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, F, Sel, TA } from '@/components/ui'

const DOCS = [
  { v: 'bon', l: 'Bon de commande' },
  { v: 'facture', l: 'Facture' },
  { v: 'livraison', l: 'Bon de livraison' },
  { v: 'garantie', l: 'Garantie' },
  { v: 'autre', l: 'Autre document' },
]
const BUCKET = 'stock-commandes'
const MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']

function lblDoc(v) {
  return DOCS.find(d => d.v === v)?.l || 'Document'
}

export default function CommandeSuivi({ cmd, materiel, onOk, onErr }) {
  const [suivi, setSuivi] = useState([])
  const [docs, setDocs] = useState([])
  const [texte, setTexte] = useState('')
  const [typeDoc, setTypeDoc] = useState('bon')
  const [garantie, setGarantie] = useState({
    debut: cmd.garantie_debut || '',
    fin: cmd.garantie_fin || '',
    notes: cmd.garantie_notes || '',
  })
  const [busy, setBusy] = useState(false)

  async function charger() {
    const [s, d] = await Promise.all([
      supabase.from('stock_commande_suivi').select('id,texte,created_at').eq('commande_id', cmd.id).order('created_at'),
      supabase.from('stock_commande_documents').select('*').eq('commande_id', cmd.id).order('ajoute_le'),
    ])
    if (!s.error) setSuivi(s.data || [])
    if (!d.error) setDocs(d.data || [])
  }
  useEffect(() => { charger() }, [cmd.id])

  async function ajouterNote() {
    const t = texte.trim()
    if (!t) return
    const { data: auth } = await supabase.auth.getUser()
    const { error } = await supabase.from('stock_commande_suivi').insert({
      commande_id: cmd.id, texte: t, par: auth?.user?.id || null,
    })
    if (error) { onErr?.(error.message); return }
    setTexte('')
    onOk?.('Suivi ajouté.')
    charger()
  }

  async function sauverGarantie() {
    const { error } = await supabase.from('stock_commandes').update({
      garantie_debut: garantie.debut || null,
      garantie_fin: garantie.fin || null,
      garantie_notes: garantie.notes?.trim() || null,
    }).eq('id', cmd.id)
    if (error) { onErr?.(error.message); return }
    onOk?.('Garantie enregistrée.')
  }

  async function ajouterDoc(file) {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) { onErr?.('Document trop lourd (max 15 Mo).'); return }
    if (file.type && !MIME.includes(file.type)) { onErr?.('Format accepté : PDF, JPG ou PNG.'); return }
    const id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16)
    })
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    setBusy(true)
    const path = `${cmd.id}/${id}.${ext}`
    const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined })
    if (up.error) { setBusy(false); onErr?.(up.error.message); return }
    const { error } = await supabase.from('stock_commande_documents').insert({
      id, commande_id: cmd.id, type: typeDoc, nom: file.name, path, mime: file.type || '', taille: file.size,
    })
    setBusy(false)
    if (error) { onErr?.(error.message); return }
    onOk?.('Document ajouté.')
    charger()
  }

  async function ouvrir(doc) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.path, 3600)
    if (error || !data?.signedUrl) { onErr?.(error?.message || 'Ouverture impossible.'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function retirer(doc) {
    if (!confirm(`Retirer ${doc.nom || 'ce document'} ?`)) return
    await supabase.storage.from(BUCKET).remove([doc.path])
    const { error } = await supabase.from('stock_commande_documents').delete().eq('id', doc.id)
    if (error) { onErr?.(error.message); return }
    charger()
  }

  const types = materiel ? DOCS : DOCS.filter(d => d.v !== 'garantie')

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Suivi</div>
      {suivi.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Aucune note.</div>}
      {suivi.map(s => (
        <div key={s.id} style={{ fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-muted)' }}>{new Date(s.created_at).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })} — </span>
          {s.texte}
        </div>
      ))}
      <TA label="Ajouter une note" value={texte} set={setTexte} rows={2} placeholder="Relance, n° de colis, réception partielle…" />
      <Btn kind="soft" onClick={ajouterNote} style={{ marginBottom: 12 }}>Ajouter au suivi</Btn>

      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Documents</div>
      {docs.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Aucun fichier.</div>}
      {docs.map(d => (
        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => ouvrir(d)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', textAlign: 'left' }}>
            {lblDoc(d.type)} — {d.nom || 'fichier'}
          </button>
          <Btn kind="danger" onClick={() => retirer(d)} disabled={busy} style={{ padding: '4px 10px' }}>Retirer</Btn>
        </div>
      ))}
      <Sel label="Type de document" value={typeDoc} set={setTypeDoc} options={types} />
      <label className="ha-stock-photo-btn">
        {busy ? 'Envoi…' : 'Téléverser'}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf" disabled={busy}
          onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) ajouterDoc(file) }} />
      </label>

      {materiel && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Garantie</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>
            Réservée au matériel. Un consommable n’a pas de garantie ici.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <F label="Début" type="date" value={garantie.debut} set={v => setGarantie(s => ({ ...s, debut: v }))} />
            <F label="Valide jusqu’au" type="date" value={garantie.fin} set={v => setGarantie(s => ({ ...s, fin: v }))} />
          </div>
          <TA label="Notes (n° de série, conditions)" value={garantie.notes} set={v => setGarantie(s => ({ ...s, notes: v }))} rows={2} />
          <Btn kind="soft" onClick={sauverGarantie}>Enregistrer la garantie</Btn>
        </div>
      )}
    </div>
  )
}
