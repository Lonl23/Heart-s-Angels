// src/modules/volontaires/FicheVolontaire.jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function FicheVolontaire() {
  const { id } = useParams()
  const [v, setV] = useState(null)
  const [souhaits, setSouhaits] = useState([])
  const [defraiements, setDefraiements] = useState([])
  const [dispos, setDispos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: profil }, { data: sp }, { data: def }, { data: dis }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('souhait_personnel').select('*, souhaits(patient_prenom,patient_nom,statut,date_souhait)').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('defraiements').select('*').eq('user_id', id).order('date_deplacement', { ascending: false }).limit(10),
        supabase.from('disponibilites').select('*').eq('user_id', id).order('date_debut', { ascending: false }).limit(8),
      ])
      setV(profil); setForm(profil||{})
      setSouhaits(sp||[]); setDefraiements(def||[]); setDispos(dis||[])
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSave() {
    setSaving(true)
    await supabase.from('profiles').update({
      prenom: form.prenom, nom: form.nom, telephone: form.telephone,
      role: form.role, actif: form.actif, notes: form.notes,
    }).eq('id', id)
    setV(f => ({...f, ...form}))
    setSaving(false); setEditing(false)
  }

  if (loading) return <div style={{ padding:28, fontFamily:'DM Sans,sans-serif', color:'#7A7470' }}>Chargement…</div>
  if (!v) return <div style={{ padding:28 }}><Link to="/app/volontaires">← Retour</Link><p>Profil introuvable.</p></div>

  const initials = ((v.prenom?.[0]||'')+(v.nom?.[0]||'')).toUpperCase()
  const totalKm  = defraiements.reduce((s,d) => s + (d.km||0), 0)
  const totalIndem = defraiements.reduce((s,d) => s + (d.montant_rembourse||0), 0)

  return (
    <div style={{ padding:'28px 24px', fontFamily:'DM Sans,sans-serif', maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <Link to="/app/volontaires" style={{ fontSize:13, color:'#7A7470', textDecoration:'none' }}>← Volontaires</Link>
        <span style={{ color:'#7A7470' }}>›</span>
        <span style={{ fontSize:13, color:'#1A1514', fontWeight:500 }}>{v.prenom} {v.nom}</span>
      </div>

      {/* Header profil */}
      <div style={{ background:'white', border:'1px solid rgba(200,67,90,.09)', borderRadius:18, padding:'24px', marginBottom:20, boxShadow:'0 2px 14px rgba(200,67,90,.06)', display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#C8435A,#E8697E)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.8rem', fontWeight:600, color:'white', flexShrink:0 }}>{initials}</div>
        <div style={{ flex:1, minWidth:200 }}>
          {editing ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <F label="Prénom" val={form.prenom||''} set={v=>setForm(f=>({...f,prenom:v}))}/>
                <F label="Nom"    val={form.nom||''}    set={v=>setForm(f=>({...f,nom:v}))}/>
              </div>
              <F label="Téléphone" val={form.telephone||''} set={v=>setForm(f=>({...f,telephone:v}))} type="tel"/>
              <div><label style={LBL}>Rôle</label><select value={form.role||''} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}><option value="ambulancier">Ambulancier</option><option value="infirmier">Infirmier</option><option value="medecin">Médecin</option><option value="volontaire_non_medical">Volontaire non-médical</option><option value="coordinateur">Coordinateur</option><option value="tresorier">Trésorier</option><option value="admin">Admin</option></select></div>
              <F label="Notes internes" val={form.notes||''} set={v=>setForm(f=>({...f,notes:v}))}/>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                <input type="checkbox" checked={form.actif!==false} onChange={e=>setForm(f=>({...f,actif:e.target.checked}))} style={{ accentColor:'#C8435A', width:15, height:15 }}/>
                <span style={{ fontSize:13.5, color:'#4A4340' }}>Compte actif</span>
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setEditing(false)} style={{ flex:1, padding:9, background:'none', border:'1px solid rgba(200,67,90,.2)', borderRadius:8, fontSize:13, color:'#7A7470', cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>Annuler</button>
                <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:9, background:'linear-gradient(135deg,#C8435A,#D9566A)', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>{saving?'…':'✓ Enregistrer'}</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize:'1.3rem', fontFamily:"'Cormorant Garamond',Georgia,serif", fontWeight:500, color:'#1A1514', marginBottom:4 }}>{v.prenom} {v.nom}</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                <span style={{ background:'#FBEAF0', color:'#C8435A', padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600 }}>{v.role?.replace(/_/g,' ')}</span>
                <span style={{ background: v.actif!==false ? '#EAF3DE':'#F0EFED', color: v.actif!==false ? '#3B6D11':'#7A7470', padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600 }}>{v.actif!==false ? '✓ Actif':'✗ Inactif'}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {v.email && <div style={{ fontSize:13, color:'#7A7470' }}>✉️ {v.email}</div>}
                {v.telephone && <div style={{ fontSize:13, color:'#7A7470' }}>📞 {v.telephone}</div>}
                {v.notes && <div style={{ marginTop:8, background:'#FAEEDA', borderRadius:8, padding:'8px 10px', fontSize:13, color:'#633806' }}>{v.notes}</div>}
              </div>
            </>
          )}
        </div>
        {!editing && (
          <button onClick={()=>setEditing(true)} style={{ padding:'7px 14px', background:'#FBEAF0', color:'#C8435A', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', flexShrink:0 }}>✏️ Modifier</button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { icon:'❤️', label:'Souhaits', val:souhaits.length, color:'#C8435A', bg:'#FBEAF0' },
          { icon:'📅', label:'Disponibilités', val:dispos.length, color:'#3B6D11', bg:'#EAF3DE' },
          { icon:'🛣️', label:'Km totaux', val:`${totalKm} km`, color:'#BA7517', bg:'#FAEEDA' },
          { icon:'💶', label:'Défraiements', val:`${totalIndem.toFixed(0)} €`, color:'#185FA5', bg:'#E6F1FB' },
        ].map((s,i)=>(
          <div key={i} style={{ background:'white', border:`1px solid ${s.color}22`, borderRadius:12, padding:'14px 12px', textAlign:'center', boxShadow:'0 1px 6px rgba(200,67,90,.04)' }}>
            <div style={{ fontSize:'1.5rem', marginBottom:4 }}>{s.icon}</div>
            <div style={{ fontSize:'1.1rem', fontWeight:700, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:11.5, color:'#7A7470', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Derniers souhaits */}
      {souhaits.length > 0 && (
        <div style={{ background:'white', border:'1px solid rgba(200,67,90,.09)', borderRadius:14, overflow:'hidden', marginBottom:16 }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(200,67,90,.08)', fontSize:13.5, fontWeight:600, color:'#1A1514' }}>❤️ Derniers souhaits</div>
          {souhaits.slice(0,5).map((sp,i)=>(
            <div key={i} style={{ padding:'10px 16px', borderTop:'1px solid rgba(200,67,90,.05)', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, fontSize:13.5, color:'#1A1514' }}>{sp.souhaits?.patient_prenom} {sp.souhaits?.patient_nom}</div>
              {sp.souhaits?.date_souhait && <div style={{ fontSize:12, color:'#7A7470' }}>{new Date(sp.souhaits.date_souhait).toLocaleDateString('fr-BE')}</div>}
              <span style={{ fontSize:11.5, background:'#FBEAF0', color:'#C8435A', padding:'2px 8px', borderRadius:99, fontWeight:600 }}>{sp.souhaits?.statut}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
const LBL = { fontSize:'12.5px', fontWeight:500, color:'#7A7470', display:'block', marginBottom:4 }
function F({ label, val, set, type='text' }) {
  return <div><label style={LBL}>{label}</label><input type={type} value={val} onChange={e=>set(e.target.value)} style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}/></div>
}