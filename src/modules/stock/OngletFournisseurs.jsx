import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, TA, Empty } from '@/components/ui'

export default function OngletFournisseurs({ fournisseurs, cats, onChange, onOk, onErr }) {
  const [edit, setEdit] = useState(null)
  async function supprimer(f) {
    const n = (cats || []).filter(c => c.fournisseur_id === f.id).length
    if (!confirm(n
      ? `Retirer « ${f.nom} » ? ${n} type(s) d’article y restent liés (le lien sera enlevé).`
      : `Supprimer le fournisseur « ${f.nom} » ?`)) return
    const { error } = await supabase.from('stock_fournisseurs').update({ actif: false }).eq('id', f.id)
    if (error) { onErr?.(error.message); return }
    onOk?.('Fournisseur retiré.')
    onChange()
  }
  const liste = (fournisseurs || []).filter(f => f.actif !== false)
  return (
    <div>
      <Btn onClick={() => setEdit({ nom:'', contact:'', telephone:'', email:'', adresse:'', notes:'' })} style={{ marginBottom:12 }}>+ Fournisseur</Btn>
      {edit && <FormFournisseur item={edit} onDone={() => { setEdit(null); onChange() }} onErr={onErr} />}
      {liste.length === 0 ? <Empty title="Aucun fournisseur" hint="Enregistrez les sociétés chez qui vous commandez (gants, O₂, consommables…)." /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {liste.map(f => (
            <Card key={f.id} style={{ padding:'12px 14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontWeight:600 }}>{f.nom}</div>
                  <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                    {[f.contact, f.telephone, f.email].filter(Boolean).join(' · ') || 'Pas de contact'}
                  </div>
                  {f.adresse && <div style={{ fontSize:12.5, color:'var(--text-2)', marginTop:2 }}>{f.adresse}</div>}
                  {f.notes && <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:4 }}>{f.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <Btn kind="soft" onClick={() => setEdit(f)} style={{ padding:'5px 10px' }}>Modifier</Btn>
                  <Btn kind="danger" onClick={() => supprimer(f)} style={{ padding:'5px 10px' }}>Supprimer</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function FormFournisseur({ item, onDone, onErr }) {
  const [f, setF] = useState({ ...item })
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!f.nom?.trim()) { onErr?.('Nom du fournisseur requis.'); return }
    setSaving(true)
    const payload = {
      nom: f.nom.trim(),
      contact: f.contact?.trim() || null,
      telephone: f.telephone?.trim() || null,
      email: f.email?.trim() || null,
      adresse: f.adresse?.trim() || null,
      notes: f.notes?.trim() || null,
      actif: true,
    }
    const q = f.id
      ? await supabase.from('stock_fournisseurs').update(payload).eq('id', f.id)
      : await supabase.from('stock_fournisseurs').insert(payload)
    setSaving(false)
    if (q.error) { onErr?.(q.error.message); return }
    onDone()
  }
  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <strong>{f.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</strong>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      <F label="Nom" value={f.nom} set={v=>setF(s=>({ ...s, nom:v }))} required placeholder="Nom de la société" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="Contact" value={f.contact} set={v=>setF(s=>({ ...s, contact:v }))} />
        <F label="Téléphone" value={f.telephone} set={v=>setF(s=>({ ...s, telephone:v }))} />
      </div>
      <F label="E-mail" value={f.email} set={v=>setF(s=>({ ...s, email:v }))} type="email" />
      <F label="Adresse" value={f.adresse} set={v=>setF(s=>({ ...s, adresse:v }))} />
      <TA label="Notes (délais, conditions, n° client…)" value={f.notes} set={v=>setF(s=>({ ...s, notes:v }))} rows={2} />
      <Btn onClick={save} disabled={saving} style={{ width:'100%' }}>{saving ? '…' : 'Enregistrer'}</Btn>
    </Card>
  )
}
