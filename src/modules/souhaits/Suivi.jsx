import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Btn, inp } from '@/components/ui'

export default function Suivi({ souhaitId }) {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [type, setType] = useState('note')
  const [contenu, setContenu] = useState('')
  useEffect(() => { load() }, [souhaitId])
  async function load() { const { data } = await supabase.from('souhait_suivi').select('*, profiles(prenom,nom)').eq('souhait_id', souhaitId).order('date_contact', { ascending:false }); setRows(data||[]) }
  async function ajouter() { if (!contenu.trim()) return; await supabase.from('souhait_suivi').insert({ souhait_id:souhaitId, profile_id:profile?.id, type_contact:type, contenu }); setContenu(''); load() }
  return (
    <div>
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <select value={type} onChange={e=>setType(e.target.value)} style={{ ...inp, width:'auto' }}>{['note','appel','visite','rencontre_beneficiaire','validation'].map(t=><option key={t} value={t}>{t}</option>)}</select>
          <input value={contenu} onChange={e=>setContenu(e.target.value)} placeholder="Ajouter une note…" style={{ ...inp, flex:1, minWidth:160 }} />
          <Btn onClick={ajouter}>Ajouter</Btn>
        </div>
      </Card>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {rows.map(n => (
          <div key={n.id} style={{ borderLeft:'3px solid var(--accent)', padding:'6px 0 6px 12px' }}>
            <div style={{ fontSize:13.5, color:'var(--text)' }}>{n.contenu}</div>
            <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>{n.type_contact} · {n.profiles?`${n.profiles.prenom} ${n.profiles.nom} · `:''}{new Date(n.date_contact).toLocaleString('fr-BE')}</div>
          </div>
        ))}
        {rows.length===0 && <Card>Aucune note de suivi.</Card>}
      </div>
    </div>
  )
}
