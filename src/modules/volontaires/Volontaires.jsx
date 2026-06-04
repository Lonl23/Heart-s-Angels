import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import FicheVolontaire from './FicheVolontaire'
import PhotoUpload from '@/components/shared/PhotoUpload'

export default function Volontaires() {
  return (
    <Routes>
      <Route index element={<ListeVolontaires />} />
      <Route path=":id" element={<FicheVolontaire />} />
    </Routes>
  )
}

const ROLES_LABELS = {
  admin:'Administrateur', president:'Président(e)', vice_president:'Vice-Président(e)',
  coordinateur:'Coordinateur/trice', tresorier:'Trésorier(e)', tresorier_adjoint:'Trésorier(e) adj.',
  secretaire:'Secrétaire', infirmier:'Infirmier(ère)', medecin:'Médecin',
  ambulancier:'Ambulancier',
  kinesitherapeute:'Kinésithérapeute', aide_soignant:'Aide-soignant(e)', psychologue:'Psychologue',
  logistique:'Logistique', logistique_adjoint:'Logistique adj.', communication:'Communication',
  photographe:'Photographe', recolteur_souhaits:'Récolteur de souhaits',
  responsable_benevoles:'Resp. bénévoles', developpement:'Chargé(e) développement',
  informatique:'Informatique', volontaire_medical:'Bénévole médical(e)',
  volontaire_non_medical:'Bénévole non-médical(e)',
}

const CAT_COLORS = {
  direction:{ bg:'#FBEAF0', tc:'#C8435A' },
  medical:  { bg:'#E6F7FA', tc:'#1BB0CE' },
  soutien:  { bg:'#EAF3DE', tc:'#3B6D11' },
  benevole: { bg:'#EEEAF7', tc:'#534AB7' },
  admin:    { bg:'#F0EFED', tc:'#7A7470' },
}

function getRoleCat(role) {
  if (['admin','president','vice_president','coordinateur','tresorier','tresorier_adjoint','secretaire'].includes(role)) return 'direction'
  if (['infirmier','medecin','ambulancier','kinesitherapeute','aide_soignant','psychologue','volontaire_medical'].includes(role)) return 'medical'
  if (['logistique','logistique_adjoint','communication','photographe','recolteur_souhaits','responsable_benevoles','developpement'].includes(role)) return 'soutien'
  if (role === 'informatique') return 'admin'
  return 'benevole'
}

function ListeVolontaires() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab]         = useState('actifs')
  const [items, setItems]     = useState([])
  const [search, setSearch]   = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null) // 'add' | 'invite'
  const [form, setForm]       = useState({ prenom:'', nom:'', email:'', role:'volontaire_non_medical', telephone:'', notes:'' })
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    if (tab === 'actifs') {
      const { data } = await supabase.from('profiles').select('*, qualifications(type_qual,numero)').order('nom')
      setItems(data||[])
    } else if (tab === 'inactifs') {
      const { data } = await supabase.from('profiles').select('*').eq('actif', false).order('nom')
      setItems(data||[])
    } else {
      const { data } = await supabase.from('candidatures_benevoles').select('*').order('created_at', { ascending:false })
      setItems(data||[])
    }
    setLoading(false)
  }

  // Inviter un nouveau membre (crée le profil + envoie un email de reset pour qu'il configure son mdp)
  async function inviteVolontaire() {
    if (!form.email || !form.prenom || !form.nom) { setMsg('Prénom, nom et email requis.'); return }
    setSaving(true); setMsg('')
    try {
      // Créer l'utilisateur via l'API admin Supabase (ou via invite)
      const { data, error } = await supabase.auth.admin?.createUser({
        email: form.email,
        email_confirm: true,
        user_metadata: { prenom: form.prenom, nom: form.nom },
      }) || {}

      if (error || !data?.user) {
        // Fallback : insérer directement dans profiles sans compte auth
        // L'admin devra envoyer un lien séparément
        const { error: pe } = await supabase.from('profiles').insert({
          id: crypto.randomUUID(),
          email: form.email, prenom: form.prenom, nom: form.nom,
          role: form.role, telephone: form.telephone, notes: form.notes, actif: true,
        })
        if (pe) throw pe
        setMsg('✓ Profil créé. La personne devra créer son compte avec cet email.')
      } else {
        // Mettre à jour le profil créé automatiquement
        await supabase.from('profiles').update({
          prenom: form.prenom, nom: form.nom, role: form.role,
          telephone: form.telephone, notes: form.notes,
        }).eq('id', data.user.id)
        // Envoyer l'email de configuration du mot de passe
        await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/new-password`,
        })
        setMsg('✓ Profil créé et email de configuration envoyé.')
      }
    } catch (e) {
      setMsg(`Erreur : ${e.message}`)
    }
    setSaving(false)
    load()
    setTimeout(() => { setMsg(''); setModal(null); setForm({ prenom:'', nom:'', email:'', role:'volontaire_non_medical', telephone:'', notes:'' }) }, 3000)
  }

  // Désactiver / réactiver
  async function toggleActif(id, actuel) {
    await supabase.from('profiles').update({ actif: !actuel }).eq('id', id)
    load()
  }

  // Changer le rôle directement depuis la liste
  async function changeRole(id, newRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    load()
  }

  // Accepter/refuser candidature
  async function traiteCandidature(id, statut) {
    await supabase.from('candidatures_benevoles').update({ statut }).eq('id', id)
    if (statut === 'acceptee') {
      const cand = items.find(i => i.id === id)
      if (cand) {
        await supabase.from('profiles').insert({
          id: crypto.randomUUID(),
          email: cand.email, prenom: cand.prenom, nom: cand.nom,
          role: cand.type?.includes('médical') ? 'volontaire_medical' : 'volontaire_non_medical',
          telephone: cand.telephone, actif: true,
        }).then(()=>{}, ()=>{})
      }
    }
    load()
  }

  const displayed = items.filter(it => {
    const str = `${it.prenom||''} ${it.nom||''} ${it.email||''} ${it.role||''} ${it.type||''}`.toLowerCase()
    if (search && !str.includes(search.toLowerCase())) return false
    if (roleFilter && it.role !== roleFilter && it.type !== roleFilter) return false
    return true
  })

  const stats = {
    total:   items.filter(i=>i.actif!==false).length,
    medical: items.filter(i=>getRoleCat(i.role)==='medical').length,
    direction: items.filter(i=>getRoleCat(i.role)==='direction').length,
    ag: items.filter(i=>i.membre_ag).length,
  }

  return (
    <div style={{ padding:'24px', fontFamily:"'DM Sans',sans-serif", maxWidth:1100 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.9rem', fontWeight:500, color:'#1A1514', marginBottom:4 }}>Volontaires & Membres</h1>
          <p style={{ fontSize:13, color:'#7A7470' }}>Gestion de l'équipe, candidatures et rôles</p>
        </div>
        {can('admin') && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setModal('add')} style={BTN_PRIMARY}>+ Ajouter un membre</button>
            <button onClick={()=>navigate('/app/organigramme')} style={BTN_OUTLINE}>🏛️ Organigramme</button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:22 }}>
        {[
          { label:'Membres actifs', val:stats.total, color:'#1BB0CE' },
          { label:'Équipe médicale', val:stats.medical, color:'#0E7A93' },
          { label:'Direction / CA', val:stats.direction, color:'#C8435A' },
          { label:'Membres AG', val:stats.ag, color:'#534AB7' },
        ].map((s,i)=>(
          <div key={i} style={{ background:'white', border:`1px solid ${s.color}22`, borderRadius:12, padding:'12px 16px', textAlign:'center' }}>
            <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'2rem', fontWeight:600, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:12, color:'#7A7470', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid rgba(27,176,206,.1)', marginBottom:18 }}>
        {[['actifs','👥 Actifs'],['inactifs','🔒 Inactifs'],['candidatures','📋 Candidatures']].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{ padding:'9px 18px', background:'none', border:'none', borderBottom:`2px solid ${tab===v?'#1BB0CE':'transparent'}`, color:tab===v?'#1BB0CE':'#7A7470', fontWeight:tab===v?600:400, fontSize:13.5, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", position:'relative', bottom:-1 }}>
            {l}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Nom, email, rôle…"
          style={{ flex:1, minWidth:200, padding:'8px 12px', border:'1px solid rgba(27,176,206,.15)', borderRadius:9, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}/>
        {tab === 'actifs' && (
          <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}
            style={{ padding:'8px 12px', border:'1px solid rgba(27,176,206,.15)', borderRadius:9, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}>
            <option value="">Tous les rôles</option>
            {Object.entries(ROLES_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        )}
        <div style={{ fontSize:13, color:'#7A7470', marginLeft:'auto' }}>{displayed.length} résultat{displayed.length>1?'s':''}</div>
      </div>

      {/* ── LISTE ACTIFS / INACTIFS ── */}
      {(tab === 'actifs' || tab === 'inactifs') && (
        <div style={{ background:'white', border:'1px solid rgba(27,176,206,.09)', borderRadius:14, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
            <thead>
              <tr style={{ background:'#F0F9FB' }}>
                {['Membre','Rôle','Type','AG','Accréd. conducteur','Actions'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:'#1BB0CE' }}>Chargement…</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:'#7A7470' }}>Aucun membre trouvé.</td></tr>
              ) : displayed.map((m,i) => {
                const cat = getRoleCat(m.role)
                const cc = CAT_COLORS[cat] || CAT_COLORS.benevole
                return (
                  <tr key={i} style={{ borderTop:'1px solid rgba(27,176,206,.05)', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#F8FCFD'}
                    onMouseLeave={e=>e.currentTarget.style.background='white'}>
                    {/* Membre */}
                    <td style={{ padding:'10px 14px' }} onClick={()=>navigate(`/app/volontaires/${m.id}`)}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {m.photo_url
                          ? <img src={m.photo_url} alt="" style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', border:'2px solid #E6F7FA', flexShrink:0 }}/>
                          : <div style={{ width:34, height:34, borderRadius:'50%', background:cc.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:cc.tc, flexShrink:0 }}>{(m.prenom||'?')[0]}{(m.nom||'?')[0]}</div>
                        }
                        <div>
                          <div style={{ fontWeight:600, color:'#1A1514' }}>{m.prenom} {m.nom}</div>
                          <div style={{ fontSize:11.5, color:'#7A7470' }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Rôle — modifiable par admin */}
                    <td style={{ padding:'10px 14px' }}>
                      {can('admin') ? (
                        <select value={m.role||'volontaire_non_medical'} onChange={e=>changeRole(m.id,e.target.value)}
                          onClick={e=>e.stopPropagation()}
                          style={{ background:cc.bg, color:cc.tc, border:`1px solid ${cc.tc}33`, borderRadius:7, padding:'3px 8px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                          {Object.entries(ROLES_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : (
                        <span style={{ background:cc.bg, color:cc.tc, padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600 }}>
                          {ROLES_LABELS[m.role] || m.role}
                        </span>
                      )}
                    </td>
                    {/* Type */}
                    <td style={{ padding:'10px 14px', fontSize:12.5, color:'#4A4340' }}>
                      {cat === 'medical' ? '🏥' : cat === 'direction' ? '⭐' : '🤝'}
                    </td>
                    {/* AG */}
                    <td style={{ padding:'10px 14px', textAlign:'center' }}>
                      {can('admin') ? (
                        <input type="checkbox" checked={!!m.membre_ag} onClick={e=>e.stopPropagation()}
                          onChange={async e=>{ await supabase.from('profiles').update({ membre_ag:e.target.checked }).eq('id',m.id); load() }}
                          style={{ width:15, height:15, accentColor:'#534AB7', cursor:'pointer' }}/>
                      ) : m.membre_ag ? <span style={{ color:'#534AB7' }}>✓</span> : <span style={{ color:'#D0C8C5' }}>—</span>}
                    </td>
                    {/* Sélection médicale */}
                    <td style={{ padding:'10px 14px', textAlign:'center' }}>
                      {can('coordinateur') ? (
                        <input type="checkbox" checked={!!m.selection_medicale} onClick={e=>e.stopPropagation()}
                          onChange={async e=>{ await supabase.from('profiles').update({ selection_medicale:e.target.checked }).eq('id',m.id); load() }}
                          style={{ width:15, height:15, accentColor:'#1BB0CE', cursor:'pointer' }}/>
                      ) : m.selection_medicale ? <span style={{ color:'#3B6D11' }}>✓</span> : <span style={{ color:'#D0C8C5' }}>—</span>}
                    </td>
                    {/* Actions */}
                    <td style={{ padding:'10px 14px' }} onClick={e=>e.stopPropagation()}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>navigate(`/app/volontaires/${m.id}`)} style={BTN_XS}>Fiche</button>
                        {can('admin') && (
                          <button onClick={()=>toggleActif(m.id, m.actif)} style={{ ...BTN_XS, background: m.actif?'#FCEBEB':'#EAF3DE', color: m.actif?'#C8435A':'#3B6D11' }}>
                            {m.actif ? 'Désactiver' : 'Réactiver'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CANDIDATURES ── */}
      {tab === 'candidatures' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {loading ? <div style={{ padding:32, textAlign:'center', color:'#1BB0CE' }}>Chargement…</div>
          : displayed.length === 0 ? <div style={{ padding:32, textAlign:'center', color:'#7A7470' }}>Aucune candidature.</div>
          : displayed.map((c,i) => (
            <div key={i} style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:14, padding:'16px 18px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:14.5, color:'#1A1514', marginBottom:4 }}>{c.prenom} {c.nom}</div>
                  <div style={{ fontSize:13, color:'#7A7470', marginBottom:4 }}>📧 {c.email} {c.telephone && `· 📞 ${c.telephone}`}</div>
                  <div style={{ fontSize:13, color:'#4A4340' }}>Type : <strong>{c.type||'—'}</strong> · Envoyé le {new Date(c.created_at).toLocaleDateString('fr-BE')}</div>
                  {c.motivation && <div style={{ marginTop:8, fontSize:13, color:'#4A4340', background:'#F8F4F0', borderRadius:8, padding:'8px 12px', lineHeight:1.6 }}>"{c.motivation}"</div>}
                </div>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <span style={{ padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600, background: c.statut==='acceptee'?'#EAF3DE':c.statut==='refusee'?'#FCEBEB':'#FAEEDA', color: c.statut==='acceptee'?'#3B6D11':c.statut==='refusee'?'#C8435A':'#BA7517' }}>
                    {c.statut==='acceptee'?'✓ Acceptée':c.statut==='refusee'?'✗ Refusée':'En attente'}
                  </span>
                </div>
              </div>
              {can('admin') && c.statut === 'nouvelle' && (
                <div style={{ display:'flex', gap:8, marginTop:12 }}>
                  <button onClick={()=>traiteCandidature(c.id,'acceptee')} style={{ padding:'7px 16px', background:'#EAF3DE', color:'#3B6D11', border:'1px solid rgba(59,109,17,.2)', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    ✓ Accepter et créer le profil
                  </button>
                  <button onClick={()=>traiteCandidature(c.id,'refusee')} style={{ padding:'7px 16px', background:'#FCEBEB', color:'#C8435A', border:'1px solid rgba(200,67,90,.2)', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    ✗ Refuser
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal === 'add' && <ModalAjout onClose={()=>setModal(null)} onSaved={()=>{ setModal(null); load() }} />}
    </div>
  )
}

function G2({ children }) { return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div> }
function F({ label, val, set, type='text', placeholder }) {
  return <div><label style={LBL}>{label}</label><input type={type} value={val||''} onChange={e=>set(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", outline:'none', transition:'border-color .12s' }} onFocus={e=>e.target.style.borderColor='#1BB0CE'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,.1)'}/></div>
}

const LBL = { fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }
const SEL = { width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }
const BTN_PRIMARY = { display:'inline-flex', alignItems:'center', gap:7, padding:'9px 18px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }
const BTN_OUTLINE = { display:'inline-flex', alignItems:'center', gap:7, padding:'9px 16px', background:'white', color:'#1BB0CE', border:'1px solid rgba(27,176,206,.3)', borderRadius:9, fontSize:13.5, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }
const BTN_XS = { padding:'4px 12px', background:'#E6F7FA', color:'#1BB0CE', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }

// ── Toutes les qualifications médicales possibles ────────────────────────────
// Une personne peut avoir plusieurs qualifications
const TOUTES_QUALS = [
  { id:'atnup',               label:'ATNUP',                      numLabel:'Numéro de visa ATNUP',        placeholder:'ATNUP-2024-1234', cat:'ambulancier' },
  { id:'amu',                 label:'AMU - Ambulancier Medical Urgence', numLabel:'Numéro de badge AMU', placeholder:'AMU-12345', cat:'ambulancier' },
  { id:'visa_infirmier',      label:'Visa infirmier',             numLabel:'Numéro de visa infirmier',    placeholder:'VI-12345', cat:'infirmier' },
  { id:'inami',               label:'INAMI (Médecin)',            numLabel:'Numéro INAMI',                placeholder:'1-23456-78-901', cat:'medecin' },
  { id:'visa_kine',           label:'Visa kinésithérapeute',      numLabel:'Numéro de visa kiné',         placeholder:'VK-12345', cat:'autre' },
  { id:'brevet_as',           label:'Brevet aide-soignant',       numLabel:'Numéro de brevet',            placeholder:'AS-12345', cat:'autre' },
  { id:'agrement_psy',        label:'Agrément psychologue',       numLabel:"Numéro d'agrément",           placeholder:'PSY-12345', cat:'autre' },
]
const QUALS_CATS = {
  ambulancier: { label:'🚑 Ambulancier', color:'#E6F7FA', tc:'#1BB0CE' },
  infirmier:   { label:'🟢 Infirmier(ère)', color:'#EAF3DE', tc:'#3B6D11' },
  medecin:     { label:'🔴 Médecin', color:'#FBEAF0', tc:'#C8435A' },
  autre:       { label:'🟡 Autre paramédical', color:'#FAEEDA', tc:'#BA7517' },
}

// Fonctions/rôles supplémentaires (cases à cocher)
const FONCTIONS = [
  { id:'recolteur_souhaits',   label:'Récolteur(trice) de souhaits', cat:'mission' },
  { id:'responsable_benevoles',label:'Responsable bénévoles',         cat:'gestion' },
  { id:'logistique',           label:'Responsable logistique',        cat:'gestion' },
  { id:'logistique_adjoint',   label:'Logistique adjoint(e)',         cat:'gestion' },
  { id:'communication',        label:'Responsable communication',     cat:'gestion' },
  { id:'photographe',          label:'Photographe officiel(le)',      cat:'gestion' },
  { id:'developpement',        label:'Chargé(e) de développement',    cat:'gestion' },
  { id:'tresorier',            label:'Trésorier(e)',                  cat:'direction' },
  { id:'tresorier_adjoint',    label:'Trésorier(e) adjoint(e)',       cat:'direction' },
  { id:'secretaire',           label:'Secrétaire',                    cat:'direction' },
  { id:'coordinateur',         label:'Coordinateur/trice',            cat:'direction' },
  { id:'informatique',         label:'Responsable informatique',      cat:'direction' },
  { id:'membre_ag',            label:"Membre de l'Assemblée Générale (AG)", cat:'ag' },
]

function ModalAjout({ onClose, onSaved }) {
  const [step, setStep] = useState(1) // 1=identité, 2=type, 3=qualifs, 4=fonctions
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [created, setCreated] = useState(null)
  const [data, setData] = useState({
    prenom:'', nom:'', email:'', telephone:'', adresse:'', ville:'', notes:'', photo_url:'',
    type_benevole:'non_medical', // 'medical' | 'non_medical'
    role_principal:'volontaire_non_medical',
    fonctions:[], membre_ag:false,
    quals:{}, // { id_qual: numero }
  })
  const set = (k,v) => setData(d=>({...d,[k]:v}))

  const rolesMedicaux = ['ambulancier','infirmier','medecin','kinesitherapeute','aide_soignant','psychologue','volontaire_medical']
  const isMedical = data.type_benevole === 'medical'

  async function sauvegarder() {
    if (!data.prenom || !data.nom || !data.email) { setMsg('Prénom, nom et email obligatoires.'); return }
    setSaving(true); setMsg('')
    try {
      const roleFinal = isMedical ? data.role_principal : 'volontaire_non_medical'
      const rolesSupp = data.fonctions.filter(f => f !== 'membre_ag')

      // Appel de l'Edge Function create-user (création immédiate côté serveur)
      const { data: result, error } = await supabase.functions.invoke('create-user', {
        body: {
          prenom: data.prenom, nom: data.nom, email: data.email,
          telephone: data.telephone, adresse: data.adresse, ville: data.ville,
          notes: data.notes, photo_url: data.photo_url,
          role: roleFinal, roles_supplementaires: rolesSupp,
          type_benevole: data.type_benevole,
          membre_ag: data.fonctions.includes('membre_ag'),
          quals: data.quals,
        },
      })

      if (error || result?.error) {
        throw new Error(result?.error || error?.message || 'Erreur lors de la création.')
      }

      // Afficher le login et le mot de passe générés
      setCreated({ login: result.login, password: result.password, email: result.email })
      setMsg('')
    } catch(e) {
      setMsg('Erreur : ' + (e.message || 'inconnue'))
    }
    setSaving(false)
  }

  const STEP_LABELS = ['Identité','Type','Qualifications','Fonctions']

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' }}>
      <div style={{ background:'white', borderRadius:18, width:'100%', maxWidth:560, maxHeight:'92vh', overflow:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 22px', borderBottom:'1px solid rgba(27,176,206,.1)', position:'sticky', top:0, background:'white', zIndex:1 }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:600, color:'#1A1514' }}>Ajouter un membre</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#7A7470' }}>✕</button>
        </div>

        {/* Stepper */}
        <div style={{ display:'flex', padding:'12px 22px 0', gap:0 }}>
          {STEP_LABELS.map((l,i)=>(
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor: i<step?'pointer':'default' }} onClick={()=>i<step&&setStep(i+1)}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:step>i?'#1BB0CE':step===i+1?'#1BB0CE':'#F0EFED', color:step>=i+1?'white':'#A8A39D', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                {step>i+1?'✓':i+1}
              </div>
              <span style={{ fontSize:10.5, color:step===i+1?'#1BB0CE':'#A8A39D', fontWeight:step===i+1?600:400, textAlign:'center' }}>{l}</span>
            </div>
          ))}
        </div>

        {created ? (
          <div style={{ padding:'28px 24px', textAlign:'center' }}>
            <div style={{ fontSize:'3rem', marginBottom:12 }}>✅</div>
            <h3 style={{ fontSize:18, fontWeight:600, color:'#1A1514', marginBottom:6 }}>Compte créé avec succès !</h3>
            <p style={{ fontSize:13.5, color:'#7A7470', marginBottom:20 }}>
              Transmettez ces identifiants à {created.email}<br/>(un email lui a aussi été envoyé).
            </p>
            <div style={{ background:'#F0F9FB', border:'1px solid rgba(27,176,206,.2)', borderRadius:14, padding:'20px', marginBottom:20, textAlign:'left' }}>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11.5, color:'#7A7470', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>Identifiant</div>
                <div style={{ fontSize:20, fontWeight:700, color:'#0E4A5A', fontFamily:'monospace' }}>{created.login}</div>
              </div>
              <div>
                <div style={{ fontSize:11.5, color:'#7A7470', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>Mot de passe temporaire</div>
                <div style={{ fontSize:20, fontWeight:700, color:'#0E4A5A', fontFamily:'monospace' }}>{created.password}</div>
              </div>
            </div>
            <button onClick={()=>{ navigator.clipboard?.writeText(`Login : ${created.login}\nMot de passe : ${created.password}`); }}
              style={{ width:'100%', padding:11, background:'#E6F7FA', color:'#1BB0CE', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", marginBottom:8 }}>
              📋 Copier les identifiants
            </button>
            <button onClick={onSaved}
              style={{ width:'100%', padding:12, background:'#1BB0CE', color:'white', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              ✓ Terminé
            </button>
          </div>
        ) : (
        <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:14 }}>
          {msg && <div style={{ background:msg.startsWith('✓')?'#EAF3DE':'#FEF2F2', border:`1px solid ${msg.startsWith('✓')?'#C3E6C3':'#FCD5D5'}`, borderRadius:8, padding:'9px 12px', fontSize:13, color:msg.startsWith('✓')?'#3B6D11':'#991B1B' }}>{msg}</div>}

          {/* ── Étape 1 : Identité ── */}
          {step===1 && <>
            <div>
              <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>Photo</label>
              <PhotoUpload value={data.photo_url} onChange={v=>set('photo_url',v)} folder="profils" shape="circle" size={72} label="Ajouter" />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <MF label="Prénom *" val={data.prenom} set={v=>set('prenom',v)} />
              <MF label="Nom *" val={data.nom} set={v=>set('nom',v)} />
            </div>
            <MF label="Email *" val={data.email} set={v=>set('email',v)} type="email" />
            <MF label="Téléphone" val={data.telephone} set={v=>set('telephone',v)} type="tel" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <MF label="Adresse" val={data.adresse} set={v=>set('adresse',v)} />
              <MF label="Ville" val={data.ville} set={v=>set('ville',v)} />
            </div>
            <MF label="Notes internes" val={data.notes} set={v=>set('notes',v)} placeholder="Source de recrutement, contexte…" />
          </>}

          {/* ── Étape 2 : Type de bénévole ── */}
          {step===2 && <>
            <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1514', marginBottom:4 }}>Type de bénévolat</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                ['non_medical','🤝','Bénévole non-médical(e)','Logistique, communication, événements, soutien…'],
                ['medical','🏥','Bénévole médical(e)','Ambulancier AMU/ATNUP, infirmier, médecin, kiné…'],
              ].map(([v,icon,title,desc])=>(
                <label key={v} style={{ display:'flex', flexDirection:'column', gap:6, padding:'14px', border:`2px solid ${data.type_benevole===v?'#1BB0CE':'rgba(0,0,0,.1)'}`, borderRadius:12, cursor:'pointer', background:data.type_benevole===v?'#E6F7FA':'white', transition:'all .12s' }}>
                  <input type="radio" name="type_benv" value={v} checked={data.type_benevole===v} onChange={()=>{ set('type_benevole',v); set('role_principal', v==='medical'?'infirmier':'volontaire_non_medical') }} style={{ display:'none' }}/>
                  <span style={{ fontSize:'1.8rem' }}>{icon}</span>
                  <span style={{ fontSize:13.5, fontWeight:600, color:data.type_benevole===v?'#1BB0CE':'#1A1514' }}>{title}</span>
                  <span style={{ fontSize:12, color:'#7A7470', lineHeight:1.5 }}>{desc}</span>
                </label>
              ))}
            </div>

            {/* Rôle principal si médical */}
            {isMedical && <>
              <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1514', marginBottom:4, marginTop:4 }}>Qualification principale</div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {[
                  ['ambulancier','🚑','Ambulancier','Qualification ATNUP ou AMU (à préciser dans le profil)'],
                  ['infirmier','🟢','Infirmier(ère)','Diplôme d\'État'],
                  ['medecin','🔴','Médecin','Numéro INAMI'],
                  ['kinesitherapeute','🟡','Kinésithérapeute','Visa kiné'],
                  ['aide_soignant','🟡','Aide-soignant(e)','Brevet aide-soignant'],
                  ['psychologue','🟣','Psychologue','Agrément'],
                  ['volontaire_medical','🟡','Autre professionnel médical','BLS, soins palliatifs…'],
                ].map(([v,dot,title,sub])=>(
                  <label key={v} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', border:`1.5px solid ${data.role_principal===v?'#1BB0CE':'rgba(0,0,0,.08)'}`, borderRadius:10, cursor:'pointer', background:data.role_principal===v?'#E6F7FA':'white', transition:'all .12s' }}>
                    <input type="radio" name="role_princ" value={v} checked={data.role_principal===v} onChange={()=>set('role_principal',v)} style={{ accentColor:'#1BB0CE', width:16, height:16 }}/>
                    <span style={{ fontSize:16 }}>{dot}</span>
                    <div><div style={{ fontSize:13.5, fontWeight:500, color:data.role_principal===v?'#0E4A5A':'#1A1514' }}>{title}</div><div style={{ fontSize:11.5, color:'#7A7470' }}>{sub}</div></div>
                  </label>
                ))}
              </div>
            </>}
          </>}

          {/* ── Étape 3 : Qualifications ── */}
          {step===3 && <>
            {!isMedical ? (
              <div style={{ background:'#EAF3DE', border:'1px solid rgba(59,109,17,.15)', borderRadius:10, padding:'14px 16px', fontSize:13.5, color:'#3B6D11' }}>
                ✓ Aucune qualification médicale requise pour un bénévole non-médical.
              </div>
            ) : (
              <>
                <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1514', marginBottom:2 }}>Qualifications médicales</div>
                <div style={{ fontSize:12.5, color:'#7A7470', marginBottom:10 }}>Cochez toutes les qualifications de cette personne. Une même personne peut en avoir plusieurs.</div>
                {Object.entries(QUALS_CATS).map(([cat, meta])=>{
                  const items = TOUTES_QUALS.filter(q=>q.cat===cat)
                  return (
                    <div key={cat} style={{ background:meta.color, border:`1px solid ${meta.tc}22`, borderRadius:12, padding:'12px 14px', marginBottom:8 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:meta.tc, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:10 }}>{meta.label}</div>
                      {items.map(q=>(
                        <div key={q.id} style={{ marginBottom: data.quals[q.id]!==undefined ? 10 : 6 }}>
                          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                            <input type="checkbox"
                              checked={data.quals[q.id] !== undefined}
                              onChange={e=>{
                                if (e.target.checked) setData(d=>({...d, quals:{...d.quals,[q.id]:''}}))
                                else setData(d=>{ const qq={...d.quals}; delete qq[q.id]; return {...d,quals:qq} })
                              }}
                              style={{ width:16, height:16, accentColor:meta.tc, flexShrink:0 }}/>
                            <span style={{ fontSize:13.5, fontWeight:500, color:'#1A1514' }}>{q.label}</span>
                          </label>
                          {data.quals[q.id] !== undefined && (
                            <div style={{ marginTop:7, marginLeft:26 }}>
                              <MF label={q.numLabel} val={data.quals[q.id]} set={v=>setData(d=>({...d,quals:{...d.quals,[q.id]:v}}))} placeholder={q.placeholder} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </>
            )}
          </>}

          {/* ── Étape 4 : Fonctions ── */}
          {step===4 && <>
            <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1514', marginBottom:4 }}>
              Fonctions & responsabilités dans l'ASBL
            </div>
            <div style={{ fontSize:12.5, color:'#7A7470', marginBottom:8 }}>Cochez les fonctions supplémentaires de cette personne (en plus de son rôle principal).</div>

            {[
              { cat:'mission',    label:'Missions',      color:'#E6F7FA', tc:'#1BB0CE' },
              { cat:'gestion',    label:'Gestion / Soutien', color:'#EAF3DE', tc:'#3B6D11' },
              { cat:'direction',  label:'Direction / CA',    color:'#FBEAF0', tc:'#C8435A' },
              { cat:'ag',         label:'Assemblée Générale', color:'#EEEAF7', tc:'#534AB7' },
            ].map(grp=>{
              const items = FONCTIONS.filter(f=>f.cat===grp.cat)
              return (
                <div key={grp.cat} style={{ background:grp.color, border:`1px solid ${grp.tc}22`, borderRadius:12, padding:'12px 14px', marginBottom:6 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:grp.tc, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:10 }}>{grp.label}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    {items.map(fn=>(
                      <label key={fn.id} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                        <input type="checkbox"
                          checked={data.fonctions.includes(fn.id) || (fn.id==='membre_ag' && data.membre_ag)}
                          onChange={e=>{
                            if (fn.id==='membre_ag') { set('membre_ag', e.target.checked); return }
                            setData(d=>({ ...d, fonctions: e.target.checked ? [...d.fonctions, fn.id] : d.fonctions.filter(f=>f!==fn.id) }))
                          }}
                          style={{ width:16, height:16, accentColor:grp.tc, flexShrink:0 }}/>
                        <span style={{ fontSize:13.5, color:'#1A1514' }}>{fn.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </>}

          {/* Navigation */}
          <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid rgba(27,176,206,.08)' }}>
            <button onClick={()=>step>1?setStep(s=>s-1):onClose}
              style={{ padding:'9px 20px', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, background:'white', color:'#7A7470', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontSize:13.5 }}>
              {step===1?'Annuler':'← Précédent'}
            </button>
            {step < 4
              ? <button onClick={()=>{
                  if(step===1&&(!data.prenom||!data.nom||!data.email)){setMsg('Prénom, nom et email obligatoires.');return}
                  setMsg(''); setStep(s=>s+1)
                }} style={{ padding:'9px 22px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, cursor:'pointer', fontSize:13.5, fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>
                  Suivant →
                </button>
              : <button onClick={sauvegarder} disabled={saving}
                  style={{ padding:'9px 22px', background:saving?'rgba(27,176,206,.4)':'#1BB0CE', color:'white', border:'none', borderRadius:9, cursor:saving?'wait':'pointer', fontSize:13.5, fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>
                  {saving?'⏳ Création…':'✓ Créer le membre'}
                </button>
            }
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

function MF({ label, val, set, type='text', placeholder }) {
  return <div><label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>{label}</label><input type={type} value={val||''} onChange={e=>set(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", outline:'none' }} onFocus={e=>e.target.style.borderColor='#1BB0CE'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,.1)'}/></div>
}