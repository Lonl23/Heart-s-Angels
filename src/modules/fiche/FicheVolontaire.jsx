import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Sel, PhoneF, Tabs, inp, lbl } from '@/components/ui'
import { QUALIFS, ROLES_COMPTE, SPECIALISATIONS_INF, lblRoleCompte, qualifsPourType, qualificationsAvecSelection, qualificationsCompatibles, EQUIPES_ASBL, aRoleAsblParticulier, equipeAsblOuverteParDefaut, libellesRolesAsblPropres, rangsDeLequipe, rolesAsblPourEnregistrement, rolesAsblSpecifiques } from './ficheSchema'
import { TYPES_NOTIF, prefsDepuisFiche } from '@/lib/notifications'
import { FormPinFiche } from '@/components/PinArchive'
import { ReglageDeuxFacteurs } from '@/components/DeuxFacteurs'

const vide = {
  date_naissance:'', telephone:'', iban:'', type_benevole:'',
  qualifications:[], roles_asbl:[],
  permis:{ B:false, C:false, E:false, selection_medicale:false, selection_validite:'' },
  ambulancier:{ visa_atnup:'', badge_112:'' },
  infirmier:{ visa:'', specialisations:[] },
  contacts_urgence:[],
  notif_prefs: prefsDepuisFiche(null),
}

export default function FicheVolontaire({ userId, onBack }) {
  const { user, role: monRole, reload, peutGererFiches, peutOuvrirArchives, peutReglerNotifications } = useAuth()
  const uid = userId || user?.id
  const gestionQualif = peutGererFiches()   // type + qualifications
  const gestionRoles = peutGererFiches()    // rôles ASBL : accès total ou coord. bénévoles
  const peutChangerRoleCompte = ['admin', 'president'].includes(monRole)
  const maFiche = uid === user?.id
  // Sans accès aux autres fiches : seulement ses coordonnées. Le reste est au staff.
  const seulementCoordonnees = maFiche && !gestionQualif
  const pinEligible = maFiche && peutOuvrirArchives()
  const prefsNotif = maFiche && peutReglerNotifications()
  const [prof, setProf] = useState(null)
  const [f, setF] = useState(vide)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [aPin, setAPin] = useState(false)
  const [pinMsg, setPinMsg] = useState(null)
  const [savingPin, setSavingPin] = useState(false)
  const [roleParticulier, setRoleParticulier] = useState(false)
  const [equipeOuverte, setEquipeOuverte] = useState(null)
  const [onglet, setOnglet] = useState('coordonnees')
  const rolesAvantNon = useRef([])
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
    const permisCharge = { ...vide.permis, ...((data?.fiche||{}).permis||{}) }
    setF({ ...vide, ...(data?.fiche || {}),
      permis: permisCharge,
      ambulancier:{ ...vide.ambulancier, ...((data?.fiche||{}).ambulancier||{}) },
      infirmier:{ ...vide.infirmier, ...((data?.fiche||{}).infirmier||{}) },
      documents: Array.isArray(data?.fiche?.documents) ? data.fiche.documents : [],
      qualifications: qualificationsAvecSelection((data?.fiche||{}).qualifications||[], permisCharge),
      roles_asbl:(data?.fiche||{}).roles_asbl||[],
      contacts_urgence:(data?.fiche||{}).contacts_urgence||[],
      notif_prefs: prefsDepuisFiche(data?.fiche),
    })
    setRoleParticulier(aRoleAsblParticulier((data?.fiche||{}).roles_asbl))
    setEquipeOuverte(equipeAsblOuverteParDefaut((data?.fiche||{}).roles_asbl))
    if (uid === user?.id) {
      const { data: pin } = await supabase.rpc('mon_pin_archive_defini')
      setAPin(!!pin)
    }
  })() }, [uid, user?.id])

  const set = (k,v) => setF(s => ({ ...s, [k]:v }))
  const setTypeBenevole = (v) => setF(s => ({
    ...s,
    type_benevole: v,
    qualifications: qualificationsCompatibles(v, s.qualifications),
  }))
  function setRoleCompte(v) {
    setProf(p => ({ ...p, role: v }))
    if (v === 'volontaire_medical') setTypeBenevole('medical')
    if (v === 'volontaire_non_medical') setTypeBenevole('non_medical')
  }
  const setIn = (grp,k,v) => setF(s => ({ ...s, [grp]:{ ...s[grp], [k]:v } }))
  const toggleArr = (k, val) => setF(s => {
    const has = (s[k] || []).includes(val)
    const next = has ? s[k].filter(x => x !== val) : [...(s[k] || []), val]
    if (k === 'qualifications' && val === 'chauffeur' && has) {
      return { ...s, qualifications: next, permis: { ...s.permis, selection_medicale: false } }
    }
    return { ...s, [k]: next }
  })
  function setSelectionMedicale(on) {
    setF(s => {
      const permis = { ...s.permis, selection_medicale: on }
      return { ...s, permis, qualifications: qualificationsAvecSelection(s.qualifications, permis, true) }
    })
  }
  const toggleSpec = (val) => setF(s => ({ ...s, infirmier:{ ...s.infirmier, specialisations: s.infirmier.specialisations.includes(val) ? s.infirmier.specialisations.filter(x=>x!==val) : [...s.infirmier.specialisations, val] } }))
  function togglePref(cle) {
    setF(s => ({ ...s, notif_prefs: { ...prefsDepuisFiche(s), [cle]: !prefsDepuisFiche(s)[cle] } }))
  }
  function fixerRoleParticulier(oui) {
    if (oui) {
      const spec = rolesAvantNon.current.length ? rolesAvantNon.current : rolesAsblSpecifiques(f.roles_asbl)
      setRoleParticulier(true)
      set('roles_asbl', spec)
      setEquipeOuverte(equipeAsblOuverteParDefaut(spec))
      return
    }
    rolesAvantNon.current = rolesAsblSpecifiques(f.roles_asbl)
    setRoleParticulier(false)
    set('roles_asbl', [])
    setEquipeOuverte(null)
  }
  function toggleRangAsbl(role) {
    const cur = rolesAsblSpecifiques(f.roles_asbl)
    const next = cur.includes(role) ? cur.filter(x => x !== role) : [...cur, role]
    set('roles_asbl', next)
  }

  const estAmbu = f.qualifications.includes('ambulancier')
  const estInfi = f.qualifications.includes('infirmier')

  async function save() {
    if (!prof?.prenom || !prof?.nom) { setMsg({ t:'Prénom et nom requis.', ok:false }); return }
    if (!seulementCoordonnees && estAmbu && !f.ambulancier.visa_atnup.trim() && !f.compte_a_configurer) { setMsg({ t:'Le visa ATNUP est obligatoire pour un ambulancier(ère).', ok:false }); return }
    let rolesAsbl = f.roles_asbl
    if (gestionRoles) {
      rolesAsbl = rolesAsblPourEnregistrement(roleParticulier, f.roles_asbl)
      if (roleParticulier && !rolesAsbl.length) {
        setMsg({ t:'Choisissez un rôle dans une équipe, ou passez le curseur sur Non.', ok:false })
        return
      }
    }
    setSaving(true)
    const qualifications = qualificationsAvecSelection(
      qualificationsCompatibles(f.type_benevole, f.qualifications),
      f.permis,
    )
    const fiche = { ...f, qualifications, roles_asbl: rolesAsbl }
    const patch = { prenom:prof.prenom, nom:prof.nom, fiche }
    if (peutChangerRoleCompte && prof.role && prof.role !== 'partenaire') patch.role = prof.role
    const { data, error } = await supabase.from('profiles')
      .update(patch)
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
      documents: Array.isArray(data[0].fiche?.documents) ? data[0].fiche.documents : [],
      qualifications: qualificationsAvecSelection((data[0].fiche||{}).qualifications||[], (data[0].fiche||{}).permis || {}),
      roles_asbl:(data[0].fiche||{}).roles_asbl||[],
      contacts_urgence:(data[0].fiche||{}).contacts_urgence||[],
      notif_prefs: prefsDepuisFiche(data[0].fiche),
    })
    setRoleParticulier(aRoleAsblParticulier((data[0].fiche||{}).roles_asbl))
    setMsg({ t:'Fiche enregistrée.', ok:true }); setTimeout(()=>setMsg(null), 3000)
    if (!userId) reload()
  }

  async function sauverPin({ pin, ancien }) {
    setSavingPin(true)
    setPinMsg(null)
    const { data, error } = await supabase.rpc('definir_pin_archive', { p_pin: pin, p_ancien: ancien || null })
    setSavingPin(false)
    if (error) { setPinMsg({ t: error.message, ok: false }); return false }
    if (data?.ok === false) { setPinMsg({ t: data.error || 'Impossible d’enregistrer le code.', ok: false }); return false }
    setAPin(true)
    setPinMsg({ t: 'Code enregistré. Il n’est pas affiché ensuite, seul vous le connaissez.', ok: true })
    return true
  }

  if (!prof) return <Page title="Fiche volontaire"><p style={{ color:'var(--text-muted)' }}>Chargement…</p></Page>

  return (
    <Page
      title={userId ? `Fiche — ${prof.prenom} ${prof.nom}` : 'Ma fiche'}
      subtitle={seulementCoordonnees ? 'Complétez vos coordonnées et vos contacts d’urgence. Les qualifications, les rôles et les documents sont encodés par l’équipe.' : undefined}
      action={onBack && <Btn kind="soft" onClick={onBack}>← Retour</Btn>}
    >
      {msg && <Card style={{ marginBottom:12, padding:'10px 14px', background: msg.ok?'#F0FAF0':'#FEF2F2', border:`1px solid ${msg.ok?'#C3E6C3':'#FCD5D5'}`, color: msg.ok?'#1E5C1E':'#991B1B' }}>{msg.t}</Card>}
      {(f.compte_a_configurer || !(prof.email || '').trim()) && (
        <Card style={{ marginBottom:12, padding:'10px 14px', background:'#FAEEDA', border:'1px solid #E8C98A', color:'#7A4E0B' }}>
          Cette personne est dans les volontaires mais n’a pas encore de compte. Dans Volontaires, utilisez « Configurer le compte » pour encoder son e-mail et lui envoyer le lien d’invitation.
        </Card>
      )}

      {!seulementCoordonnees && (
      <Tabs
        items={[
          { v: 'coordonnees', l: 'Coordonnées' },
          { v: 'qualifications', l: 'Qualifications' },
          { v: 'it', l: 'IT' },
          { v: 'documents', l: 'Documents' },
        ]}
        value={onglet}
        onChange={setOnglet}
      />
      )}

      <div>
      {onglet === 'coordonnees' && (
      <Card style={{ marginBottom:14 }}>
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
          <F label="IBAN (défraiements)" value={f.iban||''} set={v=>set('iban', v.toUpperCase())} placeholder="BE00 0000 0000 0000" />
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
          E-mail (connexion) : {(prof.email || '').trim() || 'pas encore de compte'} — l’IBAN sert aux notes de frais forfaitaires.
        </div>
      </Card>
      )}

      {onglet === 'it' && (
      <Card style={{ marginBottom:14 }}>
        <Sec>Rôle de compte</Sec>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>
          Accès à l’application (administrateur, président, volontaire…). Infirmier(ère), médecin, ambulancier(ère) se choisissent dans les qualifications, pas ici.
        </div>
        {peutChangerRoleCompte ? (
          <div style={{ maxWidth:280 }}>
            <Sel label="Rôle de compte" value={prof.role || ''} set={setRoleCompte} options={ROLES_COMPTE} />
          </div>
        ) : (
          <div style={{ fontSize:13.5 }}>{lblRoleCompte(prof.role)}</div>
        )}
      </Card>
      )}

      {onglet === 'qualifications' && (
      <Card style={{ marginBottom:14 }}>
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
      )}

      {/* Ambulancier */}
      {onglet === 'qualifications' && estAmbu && (
        <Card style={{ marginBottom:14 }}>
          <Sec>Ambulancier(ère)</Sec>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'0 20px' }}>
            <F label="N° visa ATNUP (obligatoire)" value={f.ambulancier.visa_atnup} set={v=>setIn('ambulancier','visa_atnup',v)} required />
            <F label="N° badge 112 (optionnel)" value={f.ambulancier.badge_112} set={v=>setIn('ambulancier','badge_112',v)} />
          </div>
        </Card>
      )}

      {/* Infirmier */}
      {onglet === 'qualifications' && estInfi && (
        <Card style={{ marginBottom:14 }}>
          <Sec>Infirmier(ère)</Sec>
          <div style={{ maxWidth:280 }}>
            <F label="N° visa infirmier" value={f.infirmier.visa} set={v=>setIn('infirmier','visa',v)} />
          </div>
          <label style={lbl}>Spécialisation(s)</label>
          <Chips options={SPECIALISATIONS_INF} selected={f.infirmier.specialisations} onToggle={toggleSpec} />
        </Card>
      )}

      {/* Rôles ASBL : éditeur pour coord./accès total ; le simple volontaire ne voit rien. */}
      {onglet === 'it' && gestionRoles ? (
        <Card style={{ marginBottom:14 }}>
          <Sec>Rôle dans l'ASBL</Sec>
          <EditeurRolesAsbl
            particulier={roleParticulier}
            onParticulier={fixerRoleParticulier}
            roles={f.roles_asbl}
            onToggleRang={toggleRangAsbl}
            equipeOuverte={equipeOuverte}
            setEquipeOuverte={setEquipeOuverte}
          />
        </Card>
      ) : onglet === 'it' && aRoleAsblParticulier(f.roles_asbl) ? (
        <Card style={{ marginBottom:14 }}>
          <RolesAsblLecture roles={f.roles_asbl} />
        </Card>
      ) : null}

      {(onglet === 'it' || seulementCoordonnees) && maFiche && <ReglageDeuxFacteurs />}

      {(onglet === 'it' || seulementCoordonnees) && pinEligible && (
        <Card style={{ marginBottom:14 }}>
          <Sec>Code d’ouverture des dossiers verrouillés</Sec>
          <FormPinFiche aPin={aPin} onSauver={sauverPin} saving={savingPin} msg={pinMsg} />
        </Card>
      )}

      {(onglet === 'it' || seulementCoordonnees) && prefsNotif && (
        <Card style={{ marginBottom:14 }}>
          <Sec>Notifications reçues</Sec>
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:10 }}>
            Président et coordinateur informatique : vous recevez toutes les alertes. Décochez celles que vous ne voulez plus.
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {TYPES_NOTIF.map(t => (
              <Toggle
                key={t.v}
                label={`${t.icon} ${t.l}`}
                on={!!(f.notif_prefs || {})[t.v]}
                onClick={() => togglePref(t.v)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Permis */}
      {onglet === 'qualifications' && (
      <Card style={{ marginBottom:14 }}>
        <Sec>Permis de conduire</Sec>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:10 }}>
          {['B','C','E'].map(c => <Toggle key={c} label={`Permis ${c}`} on={f.permis[c]} onClick={()=>setIn('permis',c,!f.permis[c])} />)}
          <Toggle label="Sélection médicale" on={!!f.permis.selection_medicale} onClick={() => setSelectionMedicale(!f.permis.selection_medicale)} />
        </div>
        <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:10 }}>
          Dès que la sélection médicale est cochée, la qualification Chauffeur l’est aussi. La décocher retire Chauffeur.
        </div>
        {f.permis.selection_medicale && (
          <div style={{ maxWidth:240 }}>
            <F label="Sélection médicale — valide jusqu'au" type="date" value={f.permis.selection_validite} set={v=>setIn('permis','selection_validite',v)} />
          </div>
        )}
      </Card>
      )}

      {onglet === 'coordonnees' && (
      <Card style={{ marginBottom:14 }}>
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
      )}

      {onglet === 'documents' && (
        <DocumentsRh
          uid={uid}
          fiche={f}
          peutEcrire={gestionQualif}
          onFiche={nf => setF(nf)}
          onMsg={setMsg}
        />
      )}

      </div>
      {onglet !== 'documents' && (
        <Btn onClick={save} disabled={saving} style={{ width:'100%', marginTop:14 }}>{saving?'Enregistrement…':(seulementCoordonnees ? '✓ Enregistrer mes coordonnées' : '✓ Enregistrer la fiche')}</Btn>
      )}
    </Page>
  )
}

const DOCS_RH = [
  { v: 'carte_identite', l: 'Carte d’identité' },
  { v: 'permis', l: 'Permis de conduire' },
  { v: 'visa_atnup', l: 'Visa ATNUP' },
  { v: 'visa_infirmier', l: 'Visa infirmier' },
  { v: 'autre', l: 'Autre document' },
]
const BUCKET_RH = 'rh-documents'
const MIME_RH = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']

function DocumentsRh({ uid, fiche, peutEcrire, onFiche, onMsg }) {
  const [busy, setBusy] = useState(false)
  const [nomAutre, setNomAutre] = useState('')
  const docs = Array.isArray(fiche.documents) ? fiche.documents : []

  async function persister(liste, texte) {
    const nf = { ...fiche, documents: liste }
    onFiche(nf)
    const { error } = await supabase.from('profiles').update({ fiche: nf }).eq('id', uid)
    if (error) { onMsg({ t: error.message, ok: false }); return false }
    onMsg({ t: texte, ok: true })
    setTimeout(() => onMsg(null), 2500)
    return true
  }

  async function ajouter(type, file) {
    if (!file || !peutEcrire) return
    if (file.size > 15 * 1024 * 1024) { onMsg({ t: 'Document trop lourd (max 15 Mo).', ok: false }); return }
    if (file.type && !MIME_RH.includes(file.type)) { onMsg({ t: 'Format accepté : PDF, JPG ou PNG.', ok: false }); return }
    const nom = type === 'autre' ? (nomAutre.trim() || file.name) : (DOCS_RH.find(d => d.v === type)?.l || file.name)
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    setBusy(true)
    const up = await supabase.storage.from(BUCKET_RH).upload(`${uid}/${id}.${ext}`, file, {
      upsert: false,
      contentType: file.type || undefined,
    })
    if (up.error) { setBusy(false); onMsg({ t: up.error.message, ok: false }); return }
    const doc = { id, type, nom, path: `${uid}/${id}.${ext}`, mime: file.type || '', taille: file.size, ajoute_le: new Date().toISOString() }
    const ok = await persister([...docs, doc], 'Document enregistré.')
    setBusy(false)
    if (ok && type === 'autre') setNomAutre('')
  }

  async function ouvrir(doc) {
    const { data, error } = await supabase.storage.from(BUCKET_RH).createSignedUrl(doc.path, 3600)
    if (error || !data?.signedUrl) { onMsg({ t: error?.message || 'Ouverture impossible.', ok: false }); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function retirer(doc) {
    if (!peutEcrire || !confirm(`Retirer ${doc.nom || 'ce document'} ?`)) return
    setBusy(true)
    await supabase.storage.from(BUCKET_RH).remove([doc.path])
    await persister(docs.filter(d => d.id !== doc.id), 'Document retiré.')
    setBusy(false)
  }

  return (
    <Card style={{ marginBottom: 14 }}>
      <Sec>Documents du volontaire</Sec>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Carte d’identité, permis, visas, et tout autre document. PDF ou photo, 15 Mo maximum. Ces pièces sont encodées par la gestion des fiches.
      </p>
      {!peutEcrire && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Consultation seule.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {DOCS_RH.map(type => {
          const lignes = docs.filter(d => d.type === type.v)
          return (
            <div key={type.v} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--heading)', marginBottom: 8 }}>{type.l}</div>
              {lignes.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Aucun fichier.</div>}
              {lignes.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => ouvrir(d)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', textAlign: 'left' }}>
                    {d.nom || type.l}
                  </button>
                  {peutEcrire && <Btn kind="danger" onClick={() => retirer(d)} disabled={busy} style={{ padding: '4px 10px' }}>Retirer</Btn>}
                </div>
              ))}
              {peutEcrire && type.v === 'autre' && (
                <F label="Nom du document" value={nomAutre} set={setNomAutre} placeholder="Attestation, diplôme…" />
              )}
              {peutEcrire && (
                <label className="ha-stock-photo-btn">
                  {busy ? 'Envoi…' : 'Téléverser'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf" disabled={busy}
                    onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) ajouter(type.v, file) }} />
                </label>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function RolesAsblLecture({ roles }) {
  const labels = libellesRolesAsblPropres(roles)
  if (!labels.length) return null
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {labels.map((l, i) => (
        <span key={i} style={{ padding:'6px 12px', borderRadius:99, background:'var(--bg-alt)', border:'1px solid var(--border)', fontSize:13, color:'var(--text-2)' }}>{l}</span>
      ))}
    </div>
  )
}

function CurseurOuiNon({ on, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
      <span style={{ fontSize:13, fontWeight: on ? 400 : 700, color: on ? 'var(--text-muted)' : 'var(--text)' }}>Non</span>
      <button type="button" role="switch" aria-checked={on} aria-label={on ? 'Oui' : 'Non'} onClick={() => onChange(!on)}
        style={{ width:42, height:24, borderRadius:99, border:'none', cursor:'pointer', background:on?'#3B6D11':'var(--border)', position:'relative' }}>
        <span style={{ position:'absolute', top:2, left:on?20:2, width:20, height:20, borderRadius:99, background:'#fff', transition:'left .15s' }} />
      </button>
      <span style={{ fontSize:13, fontWeight: on ? 700 : 400, color: on ? 'var(--text)' : 'var(--text-muted)' }}>Oui</span>
    </div>
  )
}

function EditeurRolesAsbl({ particulier, onParticulier, roles, onToggleRang, equipeOuverte, setEquipeOuverte }) {
  const selection = rolesAsblSpecifiques(roles)
  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom: particulier ? 14 : 0, flexWrap:'wrap' }}>
        <div style={{ fontSize:13.5, color:'var(--text)', flex:1, minWidth:180 }}>
          Est-ce que le volontaire a un rôle dans l’ASBL ?
        </div>
        <CurseurOuiNon on={particulier} onChange={onParticulier} />
      </div>
      {particulier && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>
            Cliquez une équipe, puis le rang. Plusieurs équipes possibles.
          </div>
          {EQUIPES_ASBL.map(eq => {
            const rangs = rangsDeLequipe(eq)
            const choisis = rangs.filter(r => selection.includes(r.v))
            const ouverte = equipeOuverte === eq.v
            return (
              <div key={eq.v} style={{ border:`1.5px solid ${choisis.length ? 'var(--accent)' : 'var(--border)'}`, borderRadius:10, overflow:'hidden', background:'var(--card)' }}>
                <button type="button" onClick={() => setEquipeOuverte(ouverte ? null : eq.v)}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 12px', border:'none', background: choisis.length ? 'var(--bg-alt)' : 'transparent', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                  <span style={{ fontSize:13.5, fontWeight:700, color:'var(--heading)' }}>{eq.l}</span>
                  <span style={{ fontSize:12, color: choisis.length ? 'var(--accent)' : 'var(--text-faint)', fontWeight:600 }}>
                    {choisis.length ? '✓ ' + choisis.map(r => r.l).join(' · ') : (ouverte ? '▴' : '▾')}
                  </span>
                </button>
                {ouverte && (
                  <div style={{ padding:'10px 12px 12px', borderTop:'1px solid var(--border)', display:'flex', flexWrap:'wrap', gap:8 }}>
                    {rangs.map(r => {
                      const on = selection.includes(r.v)
                      return (
                        <button key={r.v} type="button" onClick={() => onToggleRang(r.v)}
                          style={{ padding:'7px 12px', borderRadius:99, border:`1.5px solid ${on?'var(--accent)':'var(--border)'}`, background:on?'var(--accent)':'var(--card)', color:on?'#fff':'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                          {on ? '✓ ' : ''}{r.l}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
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
