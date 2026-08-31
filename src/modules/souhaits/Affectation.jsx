import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, inp, lbl } from '@/components/ui'

// Affectation de volontaires à un souhait (avec véhicule) — utilisé en édition.
export default function Affectation({ souhaitId }) {
  const [rows, setRows] = useState([])
  const [profils, setProfils] = useState([])
  const [uid, setUid] = useState('')
  const [role, setRole] = useState('')
  const [vehicule, setVehicule] = useState('')

  useEffect(() => { load(); supabase.from('profiles').select('id,prenom,nom,role').neq('role','partenaire').eq('actif',true).order('nom').then(({data})=>setProfils(data||[])) }, [])
  async function load() { const { data } = await supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role)').eq('souhait_id', souhaitId); setRows(data||[]) }
  async function ajouter() {
    if (!uid) return
    const { error } = await supabase.from('souhait_personnel').insert({ souhait_id:souhaitId, user_id:uid, role_mission:role||null, vehicule:vehicule||null })
    if (error) { alert(error.message); return }
    setUid(''); setRole(''); setVehicule(''); load()
  }
  async function toggle(r) { await supabase.from('souhait_personnel').update({ confirme:!r.confirme }).eq('id', r.id); load() }
  async function retirer(r) { await supabase.from('souhait_personnel').delete().eq('id', r.id); load() }

  return (
    <div>
      <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>Les volontaires affectés retrouvent la mission dans « Mes missions » (vue restreinte : prénom, lieu, destination, heures, check véhicule).</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, alignItems:'end', marginBottom:12 }}>
        <div><label style={lbl}>Volontaire</label><select value={uid} onChange={e=>setUid(e.target.value)} style={inp}><option value="">— Choisir —</option>{profils.map(p=><option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.role})</option>)}</select></div>
        <F label="Rôle dans la mission" value={role} set={setRole} placeholder="chauffeur, brancardier…" />
        <F label="Véhicule affecté" value={vehicule} set={setVehicule} placeholder="Ambulance 1…" />
        <Btn onClick={ajouter}>+ Affecter</Btn>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {rows.map(r => (
          <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px' }}>
            <div>
              <div style={{ fontWeight:600, color:'var(--text)' }}>{r.profiles?.prenom} {r.profiles?.nom} <span style={{ fontWeight:400, color:'var(--text-muted)' }}>{r.role_mission?`— ${r.role_mission}`:''}</span></div>
              <div style={{ fontSize:12, color:'var(--text-faint)' }}>{r.profiles?.role}{r.vehicule?` · 🚐 ${r.vehicule}`:''}</div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <Btn kind={r.confirme?'ok':'soft'} onClick={()=>toggle(r)} style={{ padding:'5px 10px' }}>{r.confirme?'✓ Confirmé':'Confirmer'}</Btn>
              <Btn kind="danger" onClick={()=>retirer(r)} style={{ padding:'5px 10px' }}>✕</Btn>
            </div>
          </div>
        ))}
        {rows.length===0 && <div style={{ fontSize:13, color:'var(--text-muted)' }}>Aucun volontaire affecté.</div>}
      </div>
    </div>
  )
}
