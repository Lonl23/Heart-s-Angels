import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import PhotoUpload from '@/components/shared/PhotoUpload'

const TYPES_QUAL = {
  infirmier:        [{ id:'visa_infirmier', label:'Numéro de visa infirmier',      placeholder:'VI-12345' }],
  medecin:          [{ id:'inami',          label:'Numéro INAMI',                  placeholder:'1-23456-78-901' }],
  ambulancier: [
    { id:'ATNUP', label:'ATNUP — numéro de visa', placeholder:'ATNUP-2024-1234' },
    { id:'AMU',   label:'AMU — numéro de badge',  placeholder:'AMU-12345' },
  ],
  kinesitherapeute: [{ id:'visa_kine',   label:'Numéro de visa kinésithérapeute', placeholder:'VK-12345' }],
  aide_soignant:    [{ id:'brevet_as',   label:'Numéro de brevet aide-soignant',  placeholder:'AS-12345' }],
  psychologue:      [{ id:'numero_psy',  label:"Numéro d'agrément psychologue",   placeholder:'PSY-12345' }],
}
// Aide au calcul de validité (côté affichage)
function calcValidite(q) {
  const now = new Date()
  const oneYearAgo = new Date(now.getFullYear()-1, now.getMonth(), now.getDate())
  const recyclageOk = q.date_dernier_recyclage && new Date(q.date_dernier_recyclage) > oneYearAgo
  if (q.type_qual === 'ATNUP') {
    return { valide: !!recyclageOk, recyclageOk, badgeValide: true,
             msg: recyclageOk ? 'Recyclage annuel à jour' : 'Recyclage annuel à effectuer' }
  }
  if (q.type_qual === 'AMU') {
    const badgeValide = q.date_fin_validite && new Date(q.date_fin_validite) >= now
    return { valide: !!(recyclageOk && badgeValide), recyclageOk, badgeValide,
             msg: !badgeValide ? 'Badge expiré — recyclage quinquennal requis'
                  : !recyclageOk ? 'Recyclage annuel à effectuer (18h + 6h)'
                  : 'Qualification à jour' }
  }
  return { valide: true, recyclageOk: true, badgeValide: true, msg: '' }
}
const EXTRA_QUALS = [
  { id:'formation_palliatif', label:'Formation soins palliatifs' },
  { id:'bls',                 label:'BLS / Premiers secours' },
  { id:'acls',                label:'ACLS' },
  { id:'autre',               label:'Autre qualification' },
]

export default function MonProfil({ onClose }) {
  const { profile, user, retryProfile } = useAuth()
  const [form, setForm]   = useState(null)
  const [quals, setQuals] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [tab, setTab]       = useState('profil')
  const [newQual, setNewQual] = useState({ type_qual:'', numero:'', libelle:'', date_delivrance:'', date_dernier_recyclage:'', document_url:'' })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => {
    if (!profile) return
    setForm({ prenom:profile.prenom||'', nom:profile.nom||'', telephone:profile.telephone||'', email:profile.email||'', photo_url:profile.photo_url||'', adresse:profile.adresse||'', ville:profile.ville||'', iban:profile.iban||'' })
    loadQuals()
  }, [profile])

  async function loadQuals() {
    if (!profile) return
    const { data } = await supabase.from('qualifications').select('*').eq('profile_id', profile.id).eq('actif', true).order('created_at')
    setQuals(data||[])
  }

  async function saveProfil() {
    setSaving(true); setErrMsg('')
    try {
      // upsert (et pas update) pour créer le profil s'il n'existe pas encore
      const { error } = await supabase.from('profiles').upsert({
        id: profile.id,
        prenom: form.prenom, nom: form.nom,
        telephone: form.telephone || null,
        photo_url: form.photo_url || null,
        adresse: form.adresse || null, ville: form.ville || null,
        iban: form.iban || null,
        email: form.email || profile.email,
      })
      if (error) throw error

      if (form.email && form.email !== user?.email) {
        await supabase.auth.updateUser({ email: form.email }).catch(()=>{})
      }

      // Recharger le profil global pour rafraîchir l'avatar et les champs
      if (typeof retryProfile === 'function') await retryProfile()

      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setErrMsg('Erreur : ' + (e.message || 'enregistrement impossible'))
    }
    setSaving(false)
  }

  async function addQual() {
    if (!newQual.type_qual || !newQual.numero.trim()) return
    const payload = {
      profile_id: profile.id,
      type_qual: newQual.type_qual,
      numero: newQual.numero,
      libelle: newQual.libelle || null,
      date_delivrance: newQual.date_delivrance || null,
      date_dernier_recyclage: newQual.date_dernier_recyclage || null,
      document_url: newQual.document_url || null,
    }
    // AMU : badge valable 5 ans après la délivrance
    if (newQual.type_qual === 'AMU' && newQual.date_delivrance) {
      const d = new Date(newQual.date_delivrance)
      d.setFullYear(d.getFullYear() + 5)
      payload.date_fin_validite = d.toISOString().slice(0,10)
    }
    await supabase.from('qualifications').insert(payload)
    setNewQual({ type_qual:'', numero:'', libelle:'', date_delivrance:'', date_dernier_recyclage:'', document_url:'' })
    loadQuals()
  }

  async function deleteQual(id) {
    await supabase.from('qualifications').update({ actif:false }).eq('id', id)
    loadQuals()
  }

  if (!form) return null

  const roleQuals = TYPES_QUAL[profile?.role] || []
  const allQualTypes = [...roleQuals, ...EXTRA_QUALS]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'white', borderRadius:18, width:'100%', maxWidth:500, maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 22px', borderBottom:'1px solid rgba(27,176,206,.1)', position:'sticky', top:0, background:'white', zIndex:1 }}>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {form.photo_url
              ? <img src={form.photo_url} alt="" style={{ width:42, height:42, borderRadius:'50%', objectFit:'cover', border:'2px solid #E6F7FA' }} onError={e=>e.target.style.display='none'}/>
              : <div style={{ width:42, height:42, borderRadius:'50%', background:'linear-gradient(135deg,#1BB0CE,#0E7A93)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'white' }}>
                  {(form.prenom[0]||'')+(form.nom[0]||'')}
                </div>
            }
            <div>
              <div style={{ fontSize:15, fontWeight:600, color:'#1A1514' }}>{form.prenom} {form.nom}</div>
              <div style={{ fontSize:12, color:'#7A7470' }}>{profile?.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#7A7470' }}>✕</button>
        </div>

        <div style={{ display:'flex', borderBottom:'1px solid rgba(27,176,206,.08)' }}>
          {[['profil','👤 Mon profil'],['qualifs','📋 Qualifications']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:'10px', border:'none', borderBottom:`2px solid ${tab===k?'#1BB0CE':'transparent'}`, background:'none', fontSize:13.5, fontWeight:tab===k?600:400, color:tab===k?'#1BB0CE':'#7A7470', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ padding:'20px 22px' }}>
          {tab === 'profil' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {saved && <div style={{ background:'#EAF3DE', border:'1px solid #C3E6C3', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#3B6D11' }}>✓ Profil mis à jour !</div>}
              {errMsg && <div style={{ background:'#FEF2F2', border:'1px solid #FCD5D5', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#991B1B' }}>{errMsg}</div>}
              <div>
                <label style={LBL}>Photo de profil</label>
                <PhotoUpload value={form.photo_url} onChange={v=>set('photo_url',v)} folder="profils" shape="circle" size={80} label="Ajouter une photo" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <F label="Prénom *" val={form.prenom} set={v=>set('prenom',v)} />
                <F label="Nom *"    val={form.nom}    set={v=>set('nom',v)} />
              </div>
              <F label="Téléphone" val={form.telephone} set={v=>set('telephone',v)} type="tel" placeholder="+32 4XX XX XX XX" />
              <F label="Adresse" val={form.adresse} set={v=>set('adresse',v)} />
              <F label="Ville" val={form.ville} set={v=>set('ville',v)} />
              <F label="IBAN (pour les défraiements)" val={form.iban} set={v=>set('iban',v)} placeholder="BE00 0000 0000 0000" />
              <F label="Email" val={form.email} set={v=>set('email',v)} type="email" />

              <button onClick={saveProfil} disabled={saving} style={{ padding:12, background:saving?'rgba(27,176,206,.4)':'#1BB0CE', color:'white', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:saving?'wait':'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                {saving ? '⏳ Enregistrement…' : '✓ Enregistrer'}
              </button>
            </div>
          )}

          {tab === 'qualifs' && (
            <div>
              {quals.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1A1514', marginBottom:10 }}>Mes qualifications</div>
                  {quals.map((q,i)=>{
                    const isAmbu = q.type_qual === 'ATNUP' || q.type_qual === 'AMU'
                    const v = isAmbu ? calcValidite(q) : null
                    return (
                    <div key={i} style={{ padding:'12px 14px', background:'#F0F9FB', border:`1px solid ${v && !v.valide ? 'rgba(200,67,90,.3)' : 'rgba(27,176,206,.12)'}`, borderRadius:10, marginBottom:7 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#0E4A5A' }}>{isAmbu ? `Ambulancier ${q.type_qual}` : (q.libelle || q.type_qual)}</div>
                          <div style={{ fontSize:13, color:'#1BB0CE', fontFamily:'monospace', fontWeight:700 }}>{q.numero}</div>
                          {q.type_qual === 'AMU' && q.date_fin_validite && (
                            <div style={{ fontSize:11.5, color: v.badgeValide ? '#7A7470' : '#C8435A', marginTop:2 }}>
                              Badge valable jusqu'au {new Date(q.date_fin_validite).toLocaleDateString('fr-BE')}
                            </div>
                          )}
                          {q.date_dernier_recyclage && (
                            <div style={{ fontSize:11.5, color:'#7A7470' }}>
                              Dernier recyclage : {new Date(q.date_dernier_recyclage).toLocaleDateString('fr-BE')}
                            </div>
                          )}
                          {q.document_url && (
                            <a href={q.document_url} target="_blank" rel="noreferrer" style={{ fontSize:11.5, color:'#1BB0CE', textDecoration:'underline' }}>📎 Justificatif de recyclage</a>
                          )}
                        </div>
                        <button onClick={()=>deleteQual(q.id)} style={{ background:'#FCEBEB', border:'none', borderRadius:7, padding:'5px 10px', cursor:'pointer', color:'#C8435A', fontSize:13 }}>🗑️</button>
                      </div>
                      {v && (
                        <div style={{ marginTop:8, padding:'6px 10px', borderRadius:7, fontSize:11.5, fontWeight:600,
                          background: v.valide ? '#EAF3DE' : '#FCEBEB', color: v.valide ? '#3B6D11' : '#C8435A' }}>
                          {v.valide ? '✅ ' : '⚠️ '}{v.msg}
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
              {/* Sélection médicale — requis pour conduire l'ambulance */}
              <div style={{ background: profile?.selection_medicale ? '#EAF3DE' : '#FEF2F2', border:`1px solid ${profile?.selection_medicale ? 'rgba(59,109,17,.2)' : 'rgba(200,67,90,.2)'}`, borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                  <div>
                    <div style={{ fontSize:13.5, fontWeight:600, color: profile?.selection_medicale ? '#3B6D11' : '#C8435A', marginBottom:3 }}>
                      🚑 Accréditation conducteur ambulance
                    </div>
                    <div style={{ fontSize:12.5, color:'#7A7470', lineHeight:1.5 }}>
                      Habilitation à conduire l'ambulance avec un patient à bord. Délivrée après examen médical par le coordinateur.
                    </div>
                  </div>
                  <span style={{ background: profile?.selection_medicale ? '#EAF3DE' : '#FCEBEB', color: profile?.selection_medicale ? '#3B6D11' : '#C8435A', padding:'4px 12px', borderRadius:99, fontSize:12.5, fontWeight:700, flexShrink:0 }}>
                    {profile?.selection_medicale ? '✅ Accréditation valide' : '❌ Non accrédité(e)'}
                  </span>
                </div>
                {profile?.date_selection_medicale && (
                  <div style={{ fontSize:12, color:'#7A7470', marginTop:6 }}>
                    📅 Date de validation : {new Date(profile.date_selection_medicale).toLocaleDateString('fr-BE')}
                  </div>
                )}
                <div style={{ fontSize:11.5, color:'#A8A39D', marginTop:6, fontStyle:'italic' }}>
                  La mise à jour de ce statut est réservée aux coordinateurs médicaux.
                </div>
              </div>

              <div style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:12, padding:'16px' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1A1514', marginBottom:12 }}>+ Ajouter une qualification</div>
                <div style={{ marginBottom:10 }}>
                  <label style={LBL}>Type</label>
                  <select value={newQual.type_qual} onChange={e=>setNewQual(q=>({...q,type_qual:e.target.value}))} style={SEL}>
                    <option value="">— Sélectionner</option>
                    {allQualTypes.map(qt=><option key={qt.id} value={qt.id}>{qt.label}</option>)}
                  </select>
                </div>
                {newQual.type_qual && <>
                  <F label="Numéro *" val={newQual.numero} set={v=>setNewQual(q=>({...q,numero:v}))} placeholder={allQualTypes.find(qt=>qt.id===newQual.type_qual)?.placeholder||'Référence'} />

                  {(newQual.type_qual === 'ATNUP' || newQual.type_qual === 'AMU') && <>
                    {newQual.type_qual === 'AMU' && (
                      <F label="Date de délivrance du badge *" val={newQual.date_delivrance} set={v=>setNewQual(q=>({...q,date_delivrance:v}))} type="date" />
                    )}
                    <F label="Date du dernier recyclage annuel" val={newQual.date_dernier_recyclage} set={v=>setNewQual(q=>({...q,date_dernier_recyclage:v}))} type="date" />
                    <div style={{ margin:'4px 0 8px', padding:'8px 10px', background:'#F0F9FB', borderRadius:8, fontSize:11.5, color:'#0E4A5A', lineHeight:1.5 }}>
                      {newQual.type_qual === 'ATNUP'
                        ? 'ℹ️ ATNUP : pas de date de fin, mais recyclage obligatoire chaque année. Joignez le justificatif de présence.'
                        : 'ℹ️ AMU : badge valable 5 ans. Recyclage annuel (18h formation + 6h libres) et recyclage quinquennal où le badge est remis en jeu. Joignez le justificatif.'}
                    </div>
                    <div style={{ marginBottom:8 }}>
                      <label style={LBL}>Justificatif de recyclage (document)</label>
                      <PhotoUpload value={newQual.document_url} onChange={v=>setNewQual(q=>({...q,document_url:v}))} folder="recyclages" shape="square" size={64} label="Joindre le document" />
                    </div>
                  </>}

                  {newQual.type_qual !== 'ATNUP' && newQual.type_qual !== 'AMU' && (
                    <F label="Description" val={newQual.libelle} set={v=>setNewQual(q=>({...q,libelle:v}))} placeholder="Précision éventuelle" />
                  )}

                  <button onClick={addQual} style={{ width:'100%', padding:'10px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", marginTop:8 }}>
                    + Ajouter
                  </button>
                </>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function F({ label, val, set, type='text', placeholder }) {
  return <div><label style={LBL}>{label}</label><input type={type} value={val||''} onChange={e=>set(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", outline:'none' }} onFocus={e=>e.target.style.borderColor='#1BB0CE'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,.1)'}/></div>
}
const LBL = { fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }
const SEL = { width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }