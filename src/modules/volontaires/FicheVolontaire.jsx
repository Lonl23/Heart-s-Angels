// src/modules/volontaires/FicheVolontaire.jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { FONCTIONS_LABELS } from '@/hooks/useAuth'

const QUAL_TYPES = [
  { id:'AMU',                 label:'Ambulancier AMU' },
  { id:'ATNUP',               label:'Ambulancier ATNUP' },
  { id:'visa_infirmier',      label:'Infirmier (INFI)' },
  { id:'inami',               label:'Médecin (INAMI)' },
  { id:'brevet_as',           label:'Aide-soignant' },
  { id:'visa_kine',           label:'Kinésithérapeute' },
  { id:'numero_psy',          label:'Psychologue' },
  { id:'formation_palliatif', label:'Formation soins palliatifs' },
  { id:'bls',                 label:'BLS / Premiers secours' },
  { id:'acls',                label:'ACLS' },
  { id:'autre',               label:'Autre qualification' },
]

export default function FicheVolontaire() {
  const { id } = useParams()
  const [v, setV] = useState(null)
  const [souhaits, setSouhaits] = useState([])
  const [defraiements, setDefraiements] = useState([])
  const [dispos, setDispos] = useState([])
  const [qualifications, setQualifications] = useState([])
  const [postes, setPostes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [newQual, setNewQual] = useState({ type_qual:'', numero:'', libelle:'' })
  const [fonctions, setFonctions] = useState([])
  const [fonctionPrincipale, setFonctionPrincipale] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: profil }, { data: sp }, { data: def }, { data: dis }, { data: quals }, { data: post }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('souhait_personnel').select('*, souhaits(patient_prenom,patient_nom,statut,date_souhait)').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('defraiements').select('*').eq('user_id', id).order('date_deplacement', { ascending: false }).limit(10),
        supabase.from('disponibilites').select('*').eq('user_id', id).order('date_debut', { ascending: false }).limit(8),
        supabase.from('qualifications').select('*').eq('profile_id', id).eq('actif', true).order('created_at'),
        supabase.from('organigramme_postes').select('id,titre,fonction,profile_id'),
      ])
      setV(profil); setForm(profil||{})
      setSouhaits(sp||[]); setDefraiements(def||[]); setDispos(dis||[])
      setQualifications(quals||[])
      setPostes(post||[])
      setFonctions(profil?.fonctions||[])
      setFonctionPrincipale(profil?.fonction_principale||'')
      setLoading(false)
    }
    load()
  }, [id])

  // ── Qualifications ──────────────────────────────────────────────────────────
  async function ajouterQual() {
    if (!newQual.type_qual) return
    const label = QUAL_TYPES.find(q=>q.id===newQual.type_qual)?.label || newQual.type_qual
    const { data } = await supabase.from('qualifications').insert({
      profile_id: id, type_qual: newQual.type_qual, numero: newQual.numero||null,
      libelle: newQual.libelle || label, actif: true,
    }).select().single()
    if (data) setQualifications(q => [...q, data])
    setNewQual({ type_qual:'', numero:'', libelle:'' })
  }
  async function retirerQual(qid) {
    await supabase.from('qualifications').update({ actif:false }).eq('id', qid)
    setQualifications(q => q.filter(x => x.id !== qid))
  }

  // ── Fonctions ───────────────────────────────────────────────────────────────
  function toggleFonction(f) {
    setFonctions(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }
  async function sauverFonctions() {
    const principale = fonctions.includes(fonctionPrincipale) ? fonctionPrincipale : (fonctions[0] || null)
    await supabase.from('profiles').update({ fonctions, fonction_principale: principale }).eq('id', id)
    // Ramener dans l'organigramme : assigner aux postes vacants liés à ces fonctions
    for (const f of fonctions) {
      const poste = postes.find(p => p.fonction === f && !p.profile_id)
      if (poste) {
        await supabase.from('organigramme_postes').update({ profile_id: id }).eq('id', poste.id)
      }
    }
    setV(prev => ({ ...prev, fonctions, fonction_principale: principale }))
    setFonctionPrincipale(principale || '')
    // recharger postes
    const { data: post } = await supabase.from('organigramme_postes').select('id,titre,fonction,profile_id')
    setPostes(post||[])
  }


  async function genererMatricule() {
    if (!form.date_entree) return
    const { data } = await supabase.rpc('generer_matricule', { p_date: form.date_entree })
    if (data) setForm(f => ({ ...f, matricule: data }))
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('profiles').update({
      prenom: form.prenom, nom: form.nom, telephone: form.telephone,
      role: form.role, actif: form.actif, notes: form.notes,
      matricule: form.matricule, date_entree: form.date_entree || null,
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
              <F label="Date d'entrée dans l'ASBL" val={form.date_entree||''} set={v=>setForm(f=>({...f,date_entree:v}))} type="date"/>
              <div>
                <label style={LBL}>Matricule</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={form.matricule||''} onChange={e=>setForm(f=>({...f,matricule:e.target.value}))} style={{ flex:1, padding:'8px 10px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'monospace' }}/>
                  <button type="button" onClick={genererMatricule} disabled={!form.date_entree} style={{ padding:'8px 12px', background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor: form.date_entree?'pointer':'not-allowed', opacity: form.date_entree?1:.5, fontFamily:'DM Sans,sans-serif', whiteSpace:'nowrap' }}>Générer</button>
                </div>
                <div style={{ fontSize:11, color:'#A8A39D', marginTop:3 }}>Format AAAAMMJJ-000 (date d'entrée + compteur)</div>
              </div>
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
                {v.matricule && <span style={{ background:'#E6F7FA', color:'#0E7A93', padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600, fontFamily:'monospace' }}>🆔 {v.matricule}</span>}
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

      {/* Qualifications */}
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:14, padding:'16px 18px', marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:600, color:'#0E4A5A', marginBottom:12 }}>🎓 Qualifications</div>
        {qualifications.length === 0 && <div style={{ fontSize:13, color:'#A8A39D', marginBottom:12 }}>Aucune qualification enregistrée.</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
          {qualifications.map(q => (
            <div key={q.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#F0F9FB', borderRadius:9, padding:'9px 12px' }}>
              <div>
                <span style={{ fontSize:13.5, fontWeight:600, color:'#0E4A5A' }}>{QUAL_TYPES.find(t=>t.id===q.type_qual)?.label || q.libelle || q.type_qual}</span>
                {q.numero && <span style={{ fontSize:12.5, color:'#7A7470', marginLeft:8, fontFamily:'monospace' }}>{q.numero}</span>}
              </div>
              <button onClick={()=>retirerQual(q.id)} style={{ padding:'3px 9px', background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:7, fontSize:12, cursor:'pointer' }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:'1 1 180px' }}>
            <label style={LBL}>Type</label>
            <select value={newQual.type_qual} onChange={e=>setNewQual(q=>({...q,type_qual:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}>
              <option value="">— Sélectionner</option>
              {QUAL_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex:'1 1 140px' }}>
            <label style={LBL}>Numéro / réf.</label>
            <input value={newQual.numero} onChange={e=>setNewQual(q=>({...q,numero:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}/>
          </div>
          <button onClick={ajouterQual} disabled={!newQual.type_qual} style={{ padding:'8px 16px', background:'#1BB0CE', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:newQual.type_qual?'pointer':'not-allowed', opacity:newQual.type_qual?1:.5, fontFamily:'DM Sans,sans-serif' }}>+ Ajouter</button>
        </div>
      </div>

      {/* Fonctions */}
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:14, padding:'16px 18px', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, flexWrap:'wrap', gap:8 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#0E4A5A' }}>🏷️ Fonctions ASBL</div>
          <button onClick={sauverFonctions} style={{ padding:'6px 14px', background:'#1BB0CE', color:'white', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>Enregistrer</button>
        </div>
        <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:12 }}>Cocher une fonction assigne automatiquement la personne au poste correspondant de l'organigramme (s'il existe et est vacant).</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:14 }}>
          {Object.entries(FONCTIONS_LABELS).map(([f,label]) => {
            const actif = fonctions.includes(f)
            return (
              <button key={f} onClick={()=>toggleFonction(f)} style={{ padding:'6px 12px', borderRadius:99, border:'1px solid', borderColor:actif?'#1BB0CE':'rgba(0,0,0,.12)', background:actif?'#1BB0CE':'white', color:actif?'white':'#7A7470', fontSize:12, fontWeight:actif?600:400, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
                {actif?'✓ ':''}{label}
              </button>
            )
          })}
        </div>
        {fonctions.length > 0 && (
          <div>
            <label style={LBL}>Fonction principale (affichée en premier dans l'organigramme)</label>
            <select value={fonctionPrincipale} onChange={e=>setFonctionPrincipale(e.target.value)} style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }}>
              <option value="">— Première fonction cochée</option>
              {fonctions.map(f=><option key={f} value={f}>{FONCTIONS_LABELS[f]||f}</option>)}
            </select>
          </div>
        )}
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