import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Sel, Tabs, Empty, Loading } from '@/components/ui'

const DEMI = [
  { v:'journee_complete', l:'Journée complète' },
  { v:'matin',            l:'Matin' },
  { v:'apres_midi',       l:'Après-midi' },
]

export default function Disponibilites() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tous, setTous] = useState(false)   // vue "tout le monde" (personnel)
  const [form, setForm] = useState(null)

  useEffect(() => { load() }, [tous])
  async function load() {
    setLoading(true)
    let q = supabase.from('disponibilites').select('*, profiles(prenom,nom)').order('date_debut', { ascending:true })
    if (!tous) q = q.eq('user_id', profile?.id)
    const { data } = await q
    setItems(data || []); setLoading(false)
  }
  async function supprimer(d) {
    if (!confirm('Supprimer cette disponibilité ?')) return
    await supabase.from('disponibilites').delete().eq('id', d.id); load()
  }

  return (
    <Page title="Disponibilités" subtitle="Indiquez quand vous pouvez partir en mission."
      action={<Btn onClick={()=>setForm({ demi_journee:'journee_complete' })}>+ Ajouter</Btn>}>
      <Tabs value={tous ? 'tous' : 'moi'} onChange={v=>setTous(v==='tous')} items={[
        { v:'moi', l:'Mes disponibilités' },
        { v:'tous', l:'Toute l\'équipe' },
      ]} />

      {form && <FormDispo form={form} setForm={setForm} profile={profile} onDone={()=>{ setForm(null); load() }} />}

      {loading ? <Loading />
        : items.length === 0 ? <Empty title={tous ? "Personne n'a encore indiqué de disponibilité" : 'Vous n\'avez pas encore de créneau'} hint="Ajoutez vos dates pour que la coordination puisse constituer les équipages." action={!form && <Btn onClick={()=>setForm({ demi_journee:'journee_complete' })}>+ Ajouter un créneau</Btn>} />
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {items.map(d => (
              <Card key={d.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontWeight:600, color:'var(--text)' }}>
                    {periode(d)} <span style={{ fontWeight:400, color:'var(--text-muted)' }}>· {DEMI.find(x=>x.v===d.demi_journee)?.l}</span>
                  </div>
                  <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                    {d.qualification}{tous && d.profiles ? ` — ${d.profiles.prenom} ${d.profiles.nom}` : ''}{d.commentaire ? ` · ${d.commentaire}` : ''}
                  </div>
                </div>
                {(!tous || d.user_id === profile?.id) && <Btn kind="danger" onClick={()=>supprimer(d)}>Supprimer</Btn>}
              </Card>
            ))}
          </div>
        )}
    </Page>
  )
}

function periode(d) {
  const a = new Date(d.date_debut).toLocaleDateString('fr-BE')
  const b = new Date(d.date_fin).toLocaleDateString('fr-BE')
  return a === b ? a : `${a} → ${b}`
}

function FormDispo({ form, setForm, profile, onDone }) {
  const set = (k,v) => setForm(s => ({ ...s, [k]:v }))
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!form.date_debut || !form.qualification) { alert('Date de début et qualification requises.'); return }
    setSaving(true)
    await supabase.from('disponibilites').insert({
      user_id: profile?.id,
      date_debut: form.date_debut,
      date_fin: form.date_fin || form.date_debut,
      qualification: form.qualification,
      demi_journee: form.demi_journee || 'journee_complete',
      commentaire: form.commentaire || null,
    })
    setSaving(false); onDone()
  }
  return (
    <Card style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontWeight:600, color:'var(--text)' }}>Nouvelle disponibilité</div>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="Du" type="date" value={form.date_debut} set={v=>set('date_debut',v)} required />
        <F label="Au (optionnel)" type="date" value={form.date_fin} set={v=>set('date_fin',v)} />
      </div>
      <F label="Qualification / rôle" value={form.qualification} set={v=>set('qualification',v)} placeholder="Infirmier, ambulancier, logistique…" required />
      <Sel label="Moment" value={form.demi_journee} set={v=>set('demi_journee',v)} options={DEMI} />
      <F label="Commentaire" value={form.commentaire} set={v=>set('commentaire',v)} />
      <Btn onClick={save} disabled={saving} style={{ width:'100%', marginTop:4 }}>{saving?'Enregistrement…':'Enregistrer'}</Btn>
    </Card>
  )
}
