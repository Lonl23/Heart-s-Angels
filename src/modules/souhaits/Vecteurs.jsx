import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, F, Sel, inp, lbl } from '@/components/ui'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'v' + Date.now() + Math.random().toString(16).slice(2))
const TYPES = ['', 'Ambulance', 'VSL', 'Voiture', 'Autre']

// Encodage : véhicules + équipages. Les checklists se cochent dans Mes missions.
export default function Vecteurs({ souhaitId, m, setM }) {
  const vecteurs = m.vecteurs || []
  const [profils, setProfils] = useState([])
  const [equipe, setEquipe] = useState([])

  useEffect(() => {
    supabase.from('profiles').select('id,prenom,nom,role').neq('role','partenaire').eq('actif',true).order('nom').then(({data})=>setProfils(data||[]))
    loadEquipe()
  }, [])
  async function loadEquipe() {
    const { data } = await supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role)').eq('souhait_id', souhaitId)
    setEquipe(data||[])
  }

  function majVecteur(id, patch) { setM(o => ({ ...o, vecteurs: (o.vecteurs||[]).map(v => v.id===id ? { ...v, ...patch } : v) })) }
  function ajouterVecteur() { setM(o => ({ ...o, vecteurs: [...(o.vecteurs||[]), { id:uid(), nom:'', type_transport:'', plaque:'' }] })) }
  function retirerVecteur(id) {
    setM(o => {
      const vc = { ...(o.vecteur_checklists||{}) }
      delete vc[id]
      return { ...o, vecteurs:(o.vecteurs||[]).filter(v=>v.id!==id), vecteur_checklists:vc }
    })
  }

  async function flushMission() { await supabase.from('souhaits').update({ mission: m }).eq('id', souhaitId) }

  async function affecter(vid, userId, role) {
    if (!userId) return
    await flushMission()
    const v = (m.vecteurs||[]).find(x => x.id === vid)
    const { error } = await supabase.from('souhait_personnel')
      .upsert({
        souhait_id: souhaitId,
        user_id: userId,
        vecteur_id: vid,
        vehicule: [v?.nom, v?.plaque].filter(Boolean).join(' · ') || null,
        role_mission: role || null,
      }, { onConflict: 'souhait_id,user_id' })
    if (error) { alert("Impossible d'ajouter cet équipier : " + error.message); return }
    await loadEquipe()
  }
  async function retirerMembre(id) {
    await supabase.from('souhait_personnel').delete().eq('id', id)
    await flushMission()
    loadEquipe()
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, gap:10, flexWrap:'wrap' }}>
        <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Un vecteur = un véhicule et son équipage. Les personnes affectées voient la mission dans Mes missions.</div>
        <Btn onClick={ajouterVecteur}>+ Vecteur</Btn>
      </div>

      {vecteurs.length === 0 && <div style={{ fontSize:13.5, color:'var(--text-muted)' }}>Aucun vecteur. Ajoutez-en un pour constituer l'équipage.</div>}

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {vecteurs.map((v, i) => {
          const membres = equipe.filter(e => e.vecteur_id === v.id)
          return (
            <div key={v.id} style={{ border:'1.5px solid var(--border)', borderRadius:14, padding:'14px 16px', background:'var(--card)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontWeight:700, color:'var(--heading)' }}>🚐 Vecteur {i+1}{v.nom?` — ${v.nom}`:''}</div>
                <Btn kind="danger" onClick={()=>retirerVecteur(v.id)} style={{ padding:'4px 10px' }}>Retirer</Btn>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'0 14px' }}>
                <F label="Nom / identifiant" value={v.nom} set={val=>majVecteur(v.id,{nom:val})} placeholder="Ambulance 1" />
                <Sel label="Type de transport" value={v.type_transport} set={val=>majVecteur(v.id,{type_transport:val})} options={TYPES.map(t=>({v:t,l:t||'—'}))} />
                <F label="Plaque" value={v.plaque} set={val=>majVecteur(v.id,{plaque:val})} />
              </div>

              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>Équipage</div>
                <AjoutMembre profils={profils} onAdd={(u,r)=>affecter(v.id,u,r)} />
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
                  {membres.map(e => (
                    <div key={e.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, fontSize:13.5, background:'var(--bg-alt)', borderRadius:8, padding:'6px 10px' }}>
                      <span>{e.profiles?.prenom} {e.profiles?.nom} {e.role_mission && <span style={{ color:'var(--text-muted)' }}>— {e.role_mission}</span>}</span>
                      <button onClick={()=>retirerMembre(e.id)} style={{ background:'none', border:'none', color:'#C8435A', cursor:'pointer' }}>✕</button>
                    </div>
                  ))}
                  {membres.length===0 && <div style={{ fontSize:12.5, color:'var(--text-faint)' }}>Aucun équipier.</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AjoutMembre({ profils, onAdd }) {
  const [u, setU] = useState(''); const [r, setR] = useState('')
  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
      <div style={{ flex:1, minWidth:150 }}><label style={lbl}>Volontaire</label><select value={u} onChange={e=>setU(e.target.value)} style={inp}><option value="">— Choisir —</option>{profils.map(p=><option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}</select></div>
      <div style={{ minWidth:130 }}><F label="Rôle" value={r} set={setR} placeholder="ambulancier…" /></div>
      <Btn kind="soft" onClick={()=>{ onAdd(u,r); setU(''); setR('') }}>+ Ajouter</Btn>
    </div>
  )
}
