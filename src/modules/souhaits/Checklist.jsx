import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Btn, F, Sel } from '@/components/ui'

const CATS = [
  { v:'materiel',      l:'Matériel' },
  { v:'autorisation',  l:'Autorisations' },
  { v:'logistique',    l:'Logistique' },
  { v:'medical',       l:'Médical' },
  { v:'autre',         l:'Autre' },
]
const catL = v => CATS.find(c => c.v === v)?.l || v

export default function Checklist({ souhaitId }) {
  const { profile, can } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modele, setModele] = useState(false)   // panneau de gestion du modèle
  const [add, setAdd] = useState({ libelle:'', categorie:'materiel' })

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('souhait_checklist').select('*, profiles:coche_par(prenom,nom)').eq('souhait_id', souhaitId).order('categorie').order('ordre')
    setRows(data || []); setLoading(false)
  }

  async function appliquerModele() {
    const { data: mod } = await supabase.from('checklist_modele').select('*').eq('actif', true).order('ordre')
    if (!mod?.length) { alert('Le modèle est vide. Un admin peut le remplir via « Modèle ».'); return }
    const existants = new Set(rows.map(r => r.libelle.toLowerCase()))
    const aInserer = mod.filter(m => !existants.has(m.libelle.toLowerCase()))
      .map(m => ({ souhait_id:souhaitId, libelle:m.libelle, categorie:m.categorie, ordre:m.ordre, source:'modele' }))
    if (!aInserer.length) { alert('Le modèle est déjà appliqué.'); return }
    await supabase.from('souhait_checklist').insert(aInserer); load()
  }
  async function toggle(r) {
    await supabase.from('souhait_checklist').update({
      coche: !r.coche, coche_par: !r.coche ? profile?.id : null, coche_le: !r.coche ? new Date().toISOString() : null,
    }).eq('id', r.id); load()
  }
  async function ajouter() {
    if (!add.libelle.trim()) return
    await supabase.from('souhait_checklist').insert({ souhait_id:souhaitId, libelle:add.libelle, categorie:add.categorie, source:'libre' })
    setAdd({ libelle:'', categorie:'materiel' }); load()
  }
  async function supprimer(r) { await supabase.from('souhait_checklist').delete().eq('id', r.id); load() }

  if (loading) return <p style={{ color:'var(--text-muted)' }}>Chargement…</p>

  const total = rows.length, faits = rows.filter(r => r.coche).length
  const pct = total ? Math.round(faits / total * 100) : 0
  const parCat = CATS.map(c => ({ ...c, items: rows.filter(r => r.categorie === c.v) })).filter(c => c.items.length)

  return (
    <div>
      {/* Barre d'actions + progression */}
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:total?10:0 }}>
          <div style={{ fontWeight:600, color:'var(--heading)' }}>Préparation de la mission</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <Btn kind="soft" onClick={appliquerModele}>↧ Appliquer le modèle</Btn>
            {can('admin') && <Btn kind="soft" onClick={()=>setModele(m=>!m)}>{modele?'Fermer le modèle':'⚙️ Modèle'}</Btn>}
          </div>
        </div>
        {total > 0 && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, color:'var(--text-muted)', marginBottom:4 }}>
              <span>{faits} / {total} prêt{faits>1?'s':''}</span><span>{pct}%</span>
            </div>
            <div style={{ height:8, background:'var(--bg-alt)', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:pct+'%', background: pct===100?'#3B6D11':'var(--accent)', borderRadius:99, transition:'width .2s' }} />
            </div>
            {pct===100 && <div style={{ fontSize:12.5, color:'#3B6D11', fontWeight:600, marginTop:6 }}>✓ Tout est prêt, la mission peut partir.</div>}
          </div>
        )}
      </Card>

      {modele && can('admin') && <ModeleEditor onClose={()=>setModele(false)} />}

      {/* Ajout libre */}
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr auto', gap:8, alignItems:'end' }}>
          <F label="Ajouter un élément" value={add.libelle} set={v=>setAdd(a=>({...a,libelle:v}))} placeholder="Bonbonne d'oxygène, autorisation parentale…" />
          <Sel label="Catégorie" value={add.categorie} set={v=>setAdd(a=>({...a,categorie:v}))} options={CATS} />
          <Btn onClick={ajouter}>+ Ajouter</Btn>
        </div>
      </Card>

      {/* Liste par catégorie */}
      {total === 0 ? <Card>Aucun élément. Appliquez le modèle ou ajoutez des éléments.</Card> : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {parCat.map(c => (
            <Card key={c.v}>
              <div style={{ fontSize:12.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>{c.l}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {c.items.map(r => (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 4px' }}>
                    <input type="checkbox" checked={r.coche} onChange={()=>toggle(r)} style={{ width:18, height:18, accentColor:'#3B6D11', cursor:'pointer' }} />
                    <div style={{ flex:1 }}>
                      <span style={{ fontSize:14, color:'var(--text)', textDecoration: r.coche?'line-through':'none', opacity: r.coche?.6:1 }}>{r.libelle}</span>
                      {r.coche && r.profiles && <span style={{ fontSize:11.5, color:'var(--text-faint)', marginLeft:8 }}>✓ {r.profiles.prenom} {r.profiles.nom}</span>}
                    </div>
                    <button onClick={()=>supprimer(r)} style={{ background:'none', border:'none', color:'var(--text-faint)', cursor:'pointer', fontSize:15 }}>✕</button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// Éditeur du modèle (admin) : les points standards
function ModeleEditor({ onClose }) {
  const [rows, setRows] = useState([])
  const [add, setAdd] = useState({ libelle:'', categorie:'materiel' })
  useEffect(() => { load() }, [])
  async function load() { const { data } = await supabase.from('checklist_modele').select('*').order('categorie').order('ordre'); setRows(data||[]) }
  async function ajouter() { if (!add.libelle.trim()) return; await supabase.from('checklist_modele').insert({ libelle:add.libelle, categorie:add.categorie, ordre:rows.length }); setAdd({ libelle:'', categorie:'materiel' }); load() }
  async function supprimer(r) { await supabase.from('checklist_modele').delete().eq('id', r.id); load() }
  return (
    <Card style={{ marginBottom:14, background:'var(--bg-alt)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontWeight:600, color:'var(--heading)' }}>Modèle de checklist (standard)</div>
        <Btn kind="soft" onClick={onClose}>Fermer</Btn>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr auto', gap:8, alignItems:'end', marginBottom:10 }}>
        <F label="Élément standard" value={add.libelle} set={v=>setAdd(a=>({...a,libelle:v}))} />
        <Sel label="Catégorie" value={add.categorie} set={v=>setAdd(a=>({...a,categorie:v}))} options={CATS} />
        <Btn onClick={ajouter}>+ Ajouter</Btn>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {rows.map(r => (
          <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, fontSize:13.5 }}>
            <span><span style={{ color:'var(--text-muted)', fontSize:11.5 }}>[{catL(r.categorie)}]</span> {r.libelle}</span>
            <button onClick={()=>supprimer(r)} style={{ background:'none', border:'none', color:'#C8435A', cursor:'pointer' }}>✕</button>
          </div>
        ))}
        {rows.length===0 && <div style={{ fontSize:13, color:'var(--text-muted)' }}>Modèle vide.</div>}
      </div>
    </Card>
  )
}
