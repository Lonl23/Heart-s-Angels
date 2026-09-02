import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Sel, PhoneF, inp, lbl } from '@/components/ui'
import { QUALIFS, ROLES_ASBL, SPECIALISATIONS_INF, qualifsPourType, qualificationsCompatibles } from './ficheSchema'

const vide = {
  date_naissance:'', telephone:'', type_benevole:'',
  qualifications:[], roles_asbl:[],
  permis:{ B:false, C:false, E:false, selection_medicale:false, selection_validite:'' },
  ambulancier:{ visa_atnup:'', badge_112:'' },
  infirmier:{ visa:'', specialisations:[] },
  contacts_urgence:[],
}

export default function FicheVolontaire({ userId, onBack }) {
  const { user, reload, peutGererFiches, accesTotal } = useAuth()
  const uid = userId || user?.id
  const gestionQualif = peutGererFiches()   // type + qualifications
  const gestionRoles = accesTotal()         // rôles ASBL (admin/présidence/resp info)
  const [prof, setProf] = useState(null)
  const [f, setF] = useState(vide)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef()

  async function uploadPhoto(e) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 5 * 1024 * 1024) { setMsg({ t:'Photo trop lourde (max 5 Mo).', ok:false }); return }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${uid}.${ext}`
    const up = await supabase.storage.from('avatars').upload(path, file, { upsert:true, cacheControl:'3600' })
    if (up.error) { setMsg({ t:'Photo : ' + up.error.message, ok:false }); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = data.publicUrl + '?t=' + Date.now()
    const nf = { ...f, photo_url:url }
    setF(nf)
    await supabase.from('profiles').update({ fiche: nf }).eq('id', uid)
    setMsg({ t:'Photo mise à jour.', ok:true }); setTimeout(()=>setMsg(null), 2500)
    if (!userId) reload()
  }

  useEffect(() => { (async () => {
    const { data } = await supabase.from('profiles').select('id,prenom,nom,email,role,fiche').eq('id', uid).single()
    setProf(data)
    setF({ ...vide, ...(data?.fiche || {}),
      permis:{ ...vide.permis, ...((data?.fiche||{}).permis||{}) },
      ambulancier:{ ...vide.ambulancier, ...((data?.fiche||{}).ambulancier||{}) },
      infirmier:{ ...vide.infirmier, ...((data?.fiche||{}).infirmier||{}) },
      qualifications:(data?.fiche||{}).qualifications||[],
      roles_asbl:(data?.fiche||{}).roles_asbl||[],
      contacts_urgence:(data?.fiche||{}).contacts_urgence||[],
    })
  })() }, [uid])

  const set = (k,v) => setF(s => ({ ...s, [k]:v }))
  const setTypeBenevole = (v) => setF(s => ({
    ...s,
    type_benevole: v,
    qualifications: qualificationsCompatibles(v, s.qualifications),
  }))
  const setIn = (grp,k,v) => setF(s => ({ ...s, [grp]:{ ...s[grp], [k]:v } }))
  const toggleArr = (k,val) => setF(s => ({ ...s, [k]: s[k].includes(val) ? s[k].filter(x=>x!==val) : [...s[k], val] }))
  const toggleSpec = (val) => setF(s => ({ ...s, infirmier:{ ...s.infirmier, specialisations: s.infirmier.specialisations.includes(val) ? s.infirmier.specialisations.filter(x=>x!==val) : [...s.infirmier.specialisations, val] } }))

  const estAmbu = f.qualifications.includes('ambulancier')
  const estInfi = f.qualifications.includes('infirmier')

  async function save() {
    if (!prof?.prenom || !prof?.nom) { setMsg({ t:'Prénom et nom requis.', ok:false }); return }
    if (estAmbu && !f.ambulancier.visa_atnup.trim()) { setMsg({ t:'Le visa ATNUP est obligatoire pour un ambulancier.', ok:false }); return }
    setSaving(true)
    const fiche = { ...f, qualifications: qualificationsCompatibles(f.type_benevole, f.qualifications) }
    const { data, error } = await supabase.from('profiles')
      .update({ prenom:prof.prenom, nom:prof.nom, fiche })
      .eq('id', uid)
      .select('id,prenom,nom,email,role,fiche')
    setSaving(false)
    if (error) { setMsg({ t:'Erreur : ' + error.message, ok:false }); return }
    if (!data || data.length === 0) { setMsg({ t:"Rien n'a été enregistré (droits ou champ « fiche » manquant — appliquez 07_fiche_volontaire.sql).", ok:false }); return }
    setProf(data[0])
    setF({ ...vide, ...(data[0].fiche || {}),
      permis:{ ...vide.permis, ...((data[0].fiche||{}).permis||{}) },
      ambulancier:{ ...vide.ambulancier, ...((data[0].fiche||{}).ambulancier||{}) },
      infirmier:{ ...vide.infirmier, ...((data[0].fiche||{}).infirmier||{}) },
      qualifications:(data[0].fiche||{}).qualifications||[],
      roles_asbl:(data[0].fiche||{}).roles_asbl||[],
      contacts_urgence:(data[0].fiche||{}).contacts_urgence||[],
    })
    setMsg({ t:'Fiche enregistrée.', ok:true }); setTimeout(()=>setMsg(null), 3000)
    if (!userId) reload()
  }

  if (!prof) return <Page title="Fiche volontaire"><p style={{ color:'var(--text-muted)' }}>Chargement…</p></Page>

  return (
    <Page title={userId ? `Fiche — ${prof.prenom} ${prof.nom}` : 'Ma fiche volontaire'} action={onBack && <Btn kind="soft" onClick={onBack}>← Retour</Btn>}>
      {msg && <Card style={{ marginBottom:12, padding:'10px 14px', background: msg.ok?'#F0FAF0':'#FEF2F2', border:`1px solid ${msg.ok?'#C3E6C3':'#FCD5D5'}`, color: msg.ok?'#1E5C1E':'#991B1B' }}>{msg.t}</Card>}

      <div style={{ columns:'300px', columnGap:14 }}>
      {/* Identité */}
      <Card style={{ marginBottom:14, breakInside:'avoid', WebkitColumnBreakInside:'avoid' }}>
        <Sec>Identité</Sec>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:12 }}>
          <div style={{ width:76, height:76, borderRadius:99, overflow:'hidden', flexShrink:0, background:'var(--accent)', color:'#fff', display:'grid', placeItems:'center', fontSize:24, fontWeight:700 }}>
            {f.photo_url ? <img src={f.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : `${(prof.prenom||'').charAt(0)}${(prof.nom||'').charAt(0)}`.toUpperCase()}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} style={{ display:'none' }} />
            <Btn kind="soft" onClick={()=>fileRef.current?.click()}>📷 {f.photo_url ? 'Changer la photo' : 'Ajouter une photo'}</Btn>
            <div style={{ fontSize:11.5, color:'var(--text-faint)', marginTop:4 }}>JPG/PNG, max 5 Mo.</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'0 20px' }}>
          <F label="Prénom" value={prof.prenom||''} set={v=>setProf(p=>({...p,prenom:v}))} required />
          <F label="Nom" value={prof.nom||''} set={v=>setProf(p=>({...p,nom:v}))} required />
          <F label="Date de naissance" type="date" value={f.date_naissance} set={v=>set('date_naissance',v)} />
          <PhoneF label="Téléphone" value={f.telephone} set={v=>set('telephone',v)} />
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>E-mail (connexion) : {prof.email}</div>
      </Card>

      {/* Type + qualifications */}
      <Card style={{ marginBottom:14, breakInside:'avoid', WebkitColumnBreakInside:'avoid' }}>
        <Sec>Type de bénévole & qualifications</Sec>
        {gestionQualif ? (
          <>
            <div style={{ maxWidth:280 }}>
              <Sel label="Type de bénévole" value={f.type_benevole} set={setTypeBenevole} options={[{v:'',l:'—'},{v:'medical',l:'Médical'},{v:'non_medical',l:'Non médical'}]} />
            </div>
            <label style={lbl}>Qualifications</label>
            <Chips options={qualifsPourType(f.type_benevole)} selected={f.qualifications} onToggle={v=>toggleArr('qualifications',v)} />
          </>
        ) : (
          <>
            <div style={{ fontSize:13.5, marginBottom:10 }}><span style={{ color:'var(--text-muted)' }}>Type : </span>{f.type_benevole==='medical'?'Médical':f.type_benevole==='non_medical'?'Non médical':'—'}</div>
            <label style={lbl}>Qualifications</label>
            <ReadPills options={QUALIFS} selected={f.qualifications} vide="Aucune qualification attribuée par un coordinateur." />
          </>
        )}
      </Card>

      {/* Ambulancier */}
      {estAmbu && (
        <Card style={{ marginBottom:14, breakInside:'avoid', WebkitColumnBreakInside:'avoid' }}>
          <Sec>Ambulancier</Sec>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'0 20px' }}>
            <F label="N° visa ATNUP (obligatoire)" value={f.ambulancier.visa_atnup} set={v=>setIn('ambulancier','visa_atnup',v)} required />
            <F label="N° badge 112 (optionnel)" value={f.ambulancier.badge_112} set={v=>setIn('ambulancier','badge_112',v)} />
          </div>
        </Card>
      )}

      {/* Infirmier */}
      {estInfi && (
        <Card style={{ marginBottom:14, breakInside:'avoid', WebkitColumnBreakInside:'avoid' }}>
          <Sec>Infirmier(ère)</Sec>
          <div style={{ maxWidth:280 }}>
            <F label="N° visa infirmier" value={f.infirmier.visa} set={v=>setIn('infirmier','visa',v)} />
          </div>
          <label style={lbl}>Spécialisation(s)</label>
          <Chips options={SPECIALISATIONS_INF} selected={f.infirmier.specialisations} onToggle={toggleSpec} />
        </Card>
      )}

      {/* Rôles ASBL */}
      <Card style={{ marginBottom:14, breakInside:'avoid', WebkitColumnBreakInside:'avoid' }}>
        <Sec>Rôles dans l'ASBL</Sec>
        {gestionRoles ? (
          <>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>Plusieurs rôles possibles.</div>
            <Chips options={ROLES_ASBL} selected={f.roles_asbl} onToggle={v=>toggleArr('roles_asbl',v)} />
          </>
        ) : (
          <ReadPills options={ROLES_ASBL} selected={f.roles_asbl} vide="Aucun rôle ASBL attribué." />
        )}
      </Card>

      {/* Permis */}
      <Card style={{ marginBottom:14, breakInside:'avoid', WebkitColumnBreakInside:'avoid' }}>
        <Sec>Permis de conduire</Sec>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:10 }}>
          {['B','C','E'].map(c => <Toggle key={c} label={`Permis ${c}`} on={f.permis[c]} onClick={()=>setIn('permis',c,!f.permis[c])} />)}
          <Toggle label="Sélection médicale" on={f.permis.selection_medicale} onClick={()=>setIn('permis','selection_medicale',!f.permis.selection_medicale)} />
        </div>
        {f.permis.selection_medicale && (
          <div style={{ maxWidth:240 }}>
            <F label="Sélection médicale — valide jusqu'au" type="date" value={f.permis.selection_validite} set={v=>setIn('permis','selection_validite',v)} />
          </div>
        )}
      </Card>

      {/* Contacts d'urgence */}
      <Card style={{ marginBottom:14, breakInside:'avoid', WebkitColumnBreakInside:'avoid' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <Sec noMargin>Contacts en cas d'urgence</Sec>
          <Btn kind="soft" onClick={()=>set('contacts_urgence',[...f.contacts_urgence,{ prenom:'', nom:'', affiliation:'', telephone:'' }])}>+ Ajouter</Btn>
        </div>
        {f.contacts_urgence.length===0 && <div style={{ fontSize:13, color:'var(--text-muted)' }}>Aucun contact.</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {f.contacts_urgence.map((c,i)=>(
            <div key={i} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'0 12px' }}>
                <F label="Prénom" value={c.prenom} set={v=>set('contacts_urgence',f.contacts_urgence.map((x,j)=>j===i?{...x,prenom:v}:x))} />
                <F label="Nom" value={c.nom} set={v=>set('contacts_urgence',f.contacts_urgence.map((x,j)=>j===i?{...x,nom:v}:x))} />
                <F label="Affiliation (lien)" value={c.affiliation} set={v=>set('contacts_urgence',f.contacts_urgence.map((x,j)=>j===i?{...x,affiliation:v}:x))} />
                <PhoneF label="Téléphone" value={c.telephone} set={v=>set('contacts_urgence',f.contacts_urgence.map((x,j)=>j===i?{...x,telephone:v}:x))} />
              </div>
              <Btn kind="danger" onClick={()=>set('contacts_urgence',f.contacts_urgence.filter((_,j)=>j!==i))} style={{ padding:'4px 10px', marginTop:6 }}>Retirer</Btn>
            </div>
          ))}
        </div>
      </Card>

      </div>
      <Btn onClick={save} disabled={saving} style={{ width:'100%', marginTop:14 }}>{saving?'Enregistrement…':'✓ Enregistrer la fiche'}</Btn>
    </Page>
  )
}

function ReadPills({ options, selected, vide }) {
  const sel = (selected||[]).map(v => options.find(o=>o.v===v)?.l || v)
  if (sel.length===0) return <div style={{ fontSize:13, color:'var(--text-muted)' }}>{vide}</div>
  return <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{sel.map((l,i)=><span key={i} style={{ padding:'6px 12px', borderRadius:99, background:'var(--bg-alt)', border:'1px solid var(--border)', fontSize:13, color:'var(--text-2)' }}>{l}</span>)}</div>
}
function Chips({ options, selected, onToggle }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {options.map(o => {
        const on = selected.includes(o.v)
        return (
          <button key={o.v} type="button" onClick={()=>onToggle(o.v)} style={{ padding:'7px 12px', borderRadius:99, border:`1.5px solid ${on?'var(--accent)':'var(--border)'}`, background:on?'var(--accent)':'var(--card)', color:on?'#fff':'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>{on?'✓ ':''}{o.l}</button>
        )
      })}
    </div>
  )
}
function Toggle({ label, on, onClick }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <button type="button" onClick={onClick} style={{ width:42, height:24, borderRadius:99, border:'none', cursor:'pointer', background:on?'#3B6D11':'var(--border)', position:'relative' }}>
        <span style={{ position:'absolute', top:2, left:on?20:2, width:20, height:20, borderRadius:99, background:'#fff', transition:'left .15s' }} />
      </button>
      <span style={{ fontSize:13.5, color:'var(--text)' }}>{label}</span>
    </div>
  )
}
function Sec({ children, noMargin }) { return <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom: noMargin?0:10 }}>{children}</div> }
