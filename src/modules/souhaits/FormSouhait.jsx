import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { STATUTS_SOUHAIT } from '@/lib/souhaitStatuts'
import AddressSearch from '@/components/shared/AddressSearch'
import FileUpload from '@/components/shared/FileUpload'
import ContactMedicalSelect from '@/components/shared/ContactMedicalSelect'
import AffectationEquipages from '@/components/souhaits/AffectationEquipages'
import TraitementsEditor from '@/components/souhaits/TraitementsEditor'

const STEPS = [
  { id:'nouveau',    label:'Nouveau',     icon:'🆕' },
  { id:'rencontre',  label:'Rencontre',   icon:'🤝' },
  { id:'medical',    label:'Médical',     icon:'🏥' },
  { id:'logistique', label:'Logistique',  icon:'🚑' },
  { id:'dates',      label:'Dates',       icon:'📅' },
  { id:'suivi',      label:'Suivi',       icon:'📋' },
]

function todayLocal(){ const x=new Date(); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}` }
const TIMINGS_DEBUT = [
  { id:'rdv_base',            label:'Rendez-vous Base' },
  { id:'depart_base',         label:'Départ Base' },
  { id:'sur_place_pec',       label:'Sur place PEC' },
  { id:'depart_destination',  label:'Départ vers la destination' },
  { id:'arrivee_destination', label:'Arrivé destination' },
]
const TIMINGS_FIN = [
  { id:'retour_pec',     label:'Retour vers PEC' },
  { id:'arrivee_retour', label:'Arrivé retour' },
  { id:'retour_base',    label:'Retour Base' },
  { id:'rentre_base',    label:'Rentré base' },
]
const TIMINGS_INIT = [...TIMINGS_DEBUT, ...TIMINGS_FIN].map(t => ({ id:t.id, label:t.label, heure:'', jour:'' }))

const INITIAL = {
  // Patient
  patient_prenom:'', patient_nom:'', patient_ddn:'', etablissement:'',
  beneficiaire_id:'', accompagnant_id:'',
  medecin_referent:'', telephone_medecin:'',
  contact_urgence_nom:'', contact_urgence_tel:'',
  infirmier_referent_etablissement:'',
  // Contact famille
  contact_prenom:'', contact_nom:'', contact_relation:'', contact_email:'', contact_telephone:'',
  // Souhait
  souhait_description:'', souhait_lieu:'',
  consentement_photo:false, consentement_video:false,
  consentement_publication:false, consentement_signe:false,
  // Médical
  pathologies:'', traitement_actuel:'', allergies_medicaments:'',
  medecin_traitant:'', medecin_garde:'', infirmiers:'', kine:'', deuxieme_ligne:'',
  ne_pas_reanimer:false, details_acharnement:'', antecedents:'', douleurs:'', voie_acces:'', mobilisations:'', communication:'',
  cible_saturation_o2:'', debit_o2:'', apport_o2:'', cible_ta:'', cible_fc:'',
  deglutition:'', alimentation:'', continence_urinaire:'', continence_fecale:'', precisions_continences:'',
  consignes_reanimation:'', cpr_autorise:false,
  niveau_douleur:'stable', position_transport:'assis',
  materiel_medical:'', materiel_specifique:'',
  oxygene_requis:false, debit_oxygene:'',
  mobilite:'', equipement_medical:'',
  // Logistique
  lieu_prise_en_charge:'', adresse_prise_en_charge:'', pec_domicile:false, pec_precisions:'', pec_numero_chambre:'', pec_route:'',
  lieu_destination:'', adresse_destination:'', dest_adresse_particuliere:'', dest_precisions:'',
  lieu_retour:'',
  sur_plusieurs_jours:false, hotels:[], adresse_hotel:'', nb_nuits:0, date_fin:'',
  base_depart:'', planning_particulier:[], timings: TIMINGS_INIT.map(t=>({...t})),
  traitements:[],
  // Admin
  urgence:false, statut:'nouveau', notes:'',
  // Suivi récolteur
  date_premiere_demande:'', date_rencontre_beneficiaire:'', notes_recolteur:'',
}

export default function FormSouhait() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [qp] = useSearchParams()
  const fromDemande = qp.get('from_demande')
  const { profile, can } = useAuth()
  const isEdit = !!id

  const [form, setForm]   = useState(INITIAL)
  const [step, setStep]   = useState(0)
  const [dates, setDates] = useState([]) // dates possibles
  const [dispos, setDispos] = useState([])
  const [profilesList, setProfilesList] = useState([])
  const [vehicules, setVehicules] = useState([])
  const [equipages, setEquipages] = useState([])
  const [suiviEntries, setSuiviEntries] = useState([])
  const [newSuivi, setNewSuivi] = useState({ type_contact:'note', contenu:'' })
  const [saving, setSaving] = useState(false)
  const [error, setError]  = useState('')
  const [loading, setLoading] = useState(isEdit || !!fromDemande)

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  // Annuaire : bénéficiaires + accompagnants (pour relier / créer)
  const [annuBenef, setAnnuBenef] = useState([])
  const [annuAcc, setAnnuAcc] = useState([])
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('annuaire_contacts')
        .select('id,categorie,prenom,nom,date_naissance,beneficiaire_id,lien,email,telephone')
        .in('categorie', ['beneficiaire','accompagnant'])
      setAnnuBenef((data||[]).filter(c => c.categorie==='beneficiaire'))
      setAnnuAcc((data||[]).filter(c => c.categorie==='accompagnant'))
    })()
  }, [])
  const nomAnnu = (c) => c ? `${c.prenom||''} ${c.nom||''}`.trim() || '—' : ''
  function choisirBenef(v) {
    if (!v) { setForm(f=>({ ...f, beneficiaire_id:'', accompagnant_id:'' })); return }
    const b = annuBenef.find(x => x.id === v)
    setForm(f => ({ ...f, beneficiaire_id:v, accompagnant_id:'',
      patient_prenom: b?.prenom||'', patient_nom: b?.nom||'',
      patient_ddn: b?.date_naissance ? String(b.date_naissance).slice(0,10) : '' }))
  }
  function choisirAcc(v) {
    if (!v) { set('accompagnant_id',''); return }
    const a = annuAcc.find(x => x.id === v)
    setForm(f => ({ ...f, accompagnant_id:v,
      contact_prenom: a?.prenom||'', contact_nom: a?.nom||'',
      contact_relation: a?.lien||f.contact_relation,
      contact_email: a?.email||'', contact_telephone: a?.telephone||'' }))
  }
  const accsDuBenef = annuAcc.filter(a => a.beneficiaire_id === form.beneficiaire_id)

  useEffect(() => {
    async function load() {
      if (isEdit) {
        const [{ data: s }, { data: sd }, { data: sv }] = await Promise.all([
          supabase.from('souhaits').select('*').eq('id', id).single(),
          supabase.from('souhait_dates').select('*').eq('souhait_id', id).order('date_proposee'),
          supabase.from('souhait_suivi').select('*, profiles(prenom,nom)').eq('souhait_id', id).order('date_contact', { ascending:false }),
        ])
        if (s) {
          const f = {}
          Object.keys(INITIAL).forEach(k => { f[k] = s[k] ?? INITIAL[k] })
          if (s.patient_ddn) f.patient_ddn = s.patient_ddn.slice(0,10)
          if (s.date_premiere_demande) f.date_premiere_demande = s.date_premiere_demande.slice(0,10)
          if (s.date_rencontre_beneficiaire) f.date_rencontre_beneficiaire = s.date_rencontre_beneficiaire.slice(0,10)
          setForm(f)
          setVehicules(s.vehicules || [])
          setEquipages(s.equipages || [])
        }
        setDates(sd || [])
        setSuiviEntries(sv || [])
      } else if (fromDemande) {
        const { data } = await supabase.from('demandes_souhaits').select('*').eq('id', fromDemande).single()
        if (data) setForm(f=>({ ...f,
          patient_prenom: data.patient_prenom||'', patient_nom: data.patient_nom||'',
          patient_ddn: data.patient_ddn?.slice(0,10)||'', etablissement: data.etablissement||'',
          medecin_referent: data.medecin_referent||'',
          contact_prenom: data.contact_prenom||'', contact_nom: data.contact_nom||'',
          contact_relation: data.contact_relation||'', contact_email: data.contact_email||'',
          contact_telephone: data.contact_telephone||'',
          souhait_description: data.souhait_description||'',
          souhait_lieu: data.souhait_lieu||'',
          mobilite: data.mobilite||'', equipement_medical: data.equipement_medical||'',
          allergies_medicaments: data.allergies||'',
        }))
      }
      setLoading(false)
    }
    if (isEdit || fromDemande) load()
  }, [id, fromDemande, isEdit])

  // ── Dates possibles ─────────────────────────────────────────────────────────
  // Chargement des disponibilités + profils (pour l'indicateur de couverture)
  useEffect(() => {
    (async () => {
      const [{ data: pr }, { data: dp }] = await Promise.all([
        supabase.from('profiles').select('id,role,roles_supplementaires,selection_medicale'),
        supabase.from('disponibilites').select('user_id,date_debut,date_fin'),
      ])
      setProfilesList(pr || [])
      setDispos(dp || [])
    })()
  }, [])

  const hasRole = (p,r) => p.role === r || (p.roles_supplementaires || []).includes(r)
  const estAmbAccredite = (p) => hasRole(p,'ambulancier') && !!p.selection_medicale
  const estInfirmier = (p) => hasRole(p,'infirmier') || hasRole(p,'medecin')

  function joursEntre(d1, d2) {
    const out = []; const a = new Date(d1+'T00:00:00'); const b = new Date((d2||d1)+'T00:00:00')
    const ymd = x => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`
    for (let t = new Date(a); t <= b; t.setDate(t.getDate()+1)) out.push(ymd(t))
    return out
  }
  function userCouvre(userId, jours) {
    const ds = dispos.filter(d => d.user_id === userId).map(d => {
      const dd = d.date_debut ? String(d.date_debut).slice(0,10) : null
      const df = d.date_fin ? String(d.date_fin).slice(0,10) : dd
      return { dd, df: df || dd }
    })
    return jours.every(j => ds.some(({dd,df}) => dd && dd <= j && df >= j))
  }
  // Couverture d'une date possible : ≥1 ambulancier accrédité + ≥1 infirmier dispo sur TOUS les jours
  function couverture(d) {
    if (!d.date_proposee) return { vide:true, ok:false }
    if (d.plusieurs_jours && !d.date_fin_proposee) return { incomplet:true, ok:false }
    const jours = joursEntre(d.date_proposee, d.plusieurs_jours ? d.date_fin_proposee : null)
    let nbAmb = 0, nbInf = 0
    for (const p of profilesList) {
      if (!userCouvre(p.id, jours)) continue
      if (estAmbAccredite(p)) nbAmb++
      if (estInfirmier(p)) nbInf++
    }
    return { ok: nbAmb >= 1 && nbInf >= 1, nbAmb, nbInf, nbJours: jours.length }
  }

  function addDate() {
    setDates(d => [...d, { date_proposee:'', date_fin_proposee:'', plusieurs_jours:false, heure_depart:'', heure_retour_estimee:'', note:'', confirmee:false, _new:true }])
  }
  function updateDate(i, k, v) {
    setDates(d => d.map((dd,idx) => idx===i ? {...dd,[k]:v} : dd))
  }
  function removeDate(i) {
    setDates(d => d.filter((_,idx) => idx!==i))
  }

  // ── Hôtels (souhait multi-jours) ──────────────────────────────────────────────
  function addHotel() {
    setForm(s => ({ ...s, hotels:[...(s.hotels||[]), { id:'h'+Date.now(), nom:'', adresse:'', date_arrivee:'', date_depart:'', nb_nuits:1, confirmation_url:'', confirmation_nom:'' }] }))
  }
  function updateHotel(i, k, v) {
    setForm(s => ({ ...s, hotels:(s.hotels||[]).map((h,idx)=> idx===i ? {...h,[k]:v} : h) }))
  }
  function removeHotel(i) {
    setForm(s => ({ ...s, hotels:(s.hotels||[]).filter((_,idx)=>idx!==i) }))
  }

  // ── Équipages ────────────────────────────────────────────────────────────────
  function addEquipage(type) {
    setEquipages(e => [...e, type === 'logistique'
      ? { id:'eq'+Date.now(), type:'logistique', note:'' }
      : { id:'eq'+Date.now(), type:'ambulance', mode:'normalise', longue_route:false, note:'' }
    ])
  }
  function updateEquipage(i, k, v) {
    setEquipages(es => es.map((e,idx)=> idx===i ? {...e,[k]:v} : e))
  }
  function removeEquipage(i) {
    setEquipages(es => es.filter((_,idx)=>idx!==i))
  }

  // ── Véhicules ────────────────────────────────────────────────────────────────
  function addVehicule() {
    setVehicules(v => [...v, { type:'ambulance', immatriculation:'', conducteur:'', note:'' }])
  }
  function updateVehicule(i, k, v) {
    setVehicules(vs => vs.map((vv,idx) => idx===i ? {...vv,[k]:v} : vv))
  }
  function removeVehicule(i) {
    setVehicules(vs => vs.filter((_,idx) => idx!==i))
  }

  // ── Suivi ────────────────────────────────────────────────────────────────────
  async function addSuiviEntry() {
    if (!newSuivi.contenu.trim()) return
    if (isEdit) {
      await supabase.from('souhait_suivi').insert({
        souhait_id: id, profile_id: profile.id,
        type_contact: newSuivi.type_contact, contenu: newSuivi.contenu,
      })
      const { data } = await supabase.from('souhait_suivi').select('*, profiles(prenom,nom)').eq('souhait_id', id).order('date_contact', { ascending:false })
      setSuiviEntries(data||[])
    } else {
      setSuiviEntries(e => [{ ...newSuivi, profiles:{ prenom:profile.prenom, nom:profile.nom }, date_contact:new Date().toISOString(), _new:true }, ...e])
    }
    setNewSuivi({ type_contact:'note', contenu:'' })
  }

  // ── Sauvegarde ────────────────────────────────────────────────────────────────
  async function save() {
    if (!form.patient_prenom || !form.patient_nom) { setError('Prénom et nom du patient requis.'); return }
    setSaving(true); setError('')

    // Annuaire : relier (ou créer automatiquement) le bénéficiaire et l'accompagnant
    let benefId = form.beneficiaire_id || null
    if (!benefId && (form.patient_prenom || form.patient_nom)) {
      const { data: b } = await supabase.from('annuaire_contacts').insert({
        categorie:'beneficiaire', prenom:form.patient_prenom||null, nom:form.patient_nom||null,
        date_naissance:form.patient_ddn||null, created_by:profile?.id,
      }).select('id').single()
      benefId = b?.id || null
    }
    let accId = form.accompagnant_id || null
    if (!accId && benefId && (form.contact_prenom || form.contact_nom)) {
      const { data: a } = await supabase.from('annuaire_contacts').insert({
        categorie:'accompagnant', beneficiaire_id:benefId,
        prenom:form.contact_prenom||null, nom:form.contact_nom||null, lien:form.contact_relation||null,
        email:form.contact_email||null, telephone:form.contact_telephone||null, created_by:profile?.id,
      }).select('id').single()
      accId = a?.id || null
    }

    // Les champs vides ('') cassent les colonnes DATE/numériques → convertir en null
    const clean = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
    )
    const payload = { ...clean, beneficiaire_id: benefId, accompagnant_id: accId, vehicules, equipages, created_by: profile?.id }

    let souhaitId = id
    if (isEdit) {
      const { error: errUp } = await supabase.from('souhaits').update(payload).eq('id', id)
      if (errUp) { setSaving(false); setError('Enregistrement impossible : ' + errUp.message); return }
    } else {
      const { data, error: errIns } = await supabase.from('souhaits').insert(payload).select().single()
      if (errIns) { setSaving(false); setError('Création impossible : ' + errIns.message); return }
      souhaitId = data?.id
    }

    if (souhaitId) {
      // Sauvegarder les dates possibles
      // Supprimer en base les options de date retirées
      const { data: existDates } = await supabase.from('souhait_dates').select('id').eq('souhait_id', souhaitId)
      const keptIds = new Set(dates.filter(d => d.id && !d._new).map(d => d.id))
      const toDelete = (existDates || []).filter(e => !keptIds.has(e.id)).map(e => e.id)
      if (toDelete.length) await supabase.from('souhait_dates').delete().in('id', toDelete)

      for (const d of dates) {
        if (!d.date_proposee) continue
        const champs = {
          date_proposee: d.date_proposee,
          plusieurs_jours: !!d.plusieurs_jours,
          date_fin_proposee: (d.plusieurs_jours && d.date_fin_proposee) ? d.date_fin_proposee : null,
          heure_depart: d.heure_depart||null,
          heure_retour_estimee: d.heure_retour_estimee||null,
          note: d.note||null,
          confirmee: !!d.confirmee,
        }
        if (d.id && !d._new) {
          await supabase.from('souhait_dates').update(champs).eq('id', d.id)
        } else {
          await supabase.from('souhait_dates').insert({ souhait_id:souhaitId, ...champs })
        }
      }
      // Sauvegarder les entrées suivi nouvelles
      for (const e of suiviEntries.filter(e => e._new)) {
        await supabase.from('souhait_suivi').insert({ souhait_id:souhaitId, profile_id:profile.id, type_contact:e.type_contact, contenu:e.contenu })
      }
    }

    setSaving(false)
    navigate(`/app/souhaits/${souhaitId || ''}`)
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#1BB0CE' }}>Chargement…</div>

  const currentStep = STEPS[step]

  return (
    <div style={{ maxWidth:860, margin:'0 auto', padding:'20px 24px', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <button onClick={()=>navigate('/app/souhaits')} style={{ background:'none', border:'none', color:'#1BB0CE', cursor:'pointer', fontSize:13.5, fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
          ← Retour aux souhaits
        </button>
        <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.8rem', fontWeight:500, color:'#1A1514', margin:0 }}>
          {isEdit ? `Modifier — ${form.patient_prenom} ${form.patient_nom}` : 'Nouveau souhait'}
        </h1>
      </div>

      {/* Stepper */}
      <div style={{ display:'flex', gap:0, marginBottom:28, overflowX:'auto', paddingBottom:4 }}>
        {STEPS.map((s,i)=>(
          <button key={i} onClick={()=>setStep(i)} style={{ flex:1, minWidth:80, display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'10px 6px', border:'none', background:'none', cursor:'pointer', borderBottom:`3px solid ${step===i?'#1BB0CE':'rgba(27,176,206,.15)'}`, transition:'all .12s', fontFamily:"'DM Sans',sans-serif" }}>
            <span style={{ fontSize:18 }}>{s.icon}</span>
            <span style={{ fontSize:11.5, fontWeight:step===i?600:400, color:step===i?'#1BB0CE':'#7A7470', whiteSpace:'nowrap' }}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Contenu */}
      {(() => { const curId = STEPS[step]?.id; return (
      <div style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:16, padding:'24px', boxShadow:'0 2px 12px rgba(27,176,206,.06)' }}>

        {/* ── NOUVEAU : essentiel ── */}
        {curId==='nouveau' && <Section titre="Nouveau souhait — informations essentielles">
          <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.4, marginBottom:4 }}>Bénéficiaire</div>
          <div style={{ marginBottom:8 }}>
            <label style={LBL}>Depuis l'annuaire</label>
            <select value={form.beneficiaire_id||''} onChange={e=>choisirBenef(e.target.value)} style={{ ...TA, minHeight:0, padding:'9px 11px' }}>
              <option value="">➕ Nouveau bénéficiaire (sera ajouté à l'annuaire)</option>
              {annuBenef.map(b=> <option key={b.id} value={b.id}>{nomAnnu(b)}</option>)}
            </select>
          </div>
          <G2><F label="Prénom *" val={form.patient_prenom} set={v=>set('patient_prenom',v)} />
              <F label="Nom *" val={form.patient_nom} set={v=>set('patient_nom',v)} /></G2>
          <G2><F label="Date de naissance" val={form.patient_ddn} set={v=>set('patient_ddn',v)} type="date" />
              <F label="Institution / MRS / Hôpital" val={form.etablissement} set={v=>set('etablissement',v)} /></G2>

          <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.4, margin:'14px 0 4px' }}>Demandeur / Accompagnant</div>
          {form.beneficiaire_id && accsDuBenef.length > 0 && (
            <div style={{ marginBottom:8 }}>
              <label style={LBL}>Accompagnant (annuaire du bénéficiaire)</label>
              <select value={form.accompagnant_id||''} onChange={e=>choisirAcc(e.target.value)} style={{ ...TA, minHeight:0, padding:'9px 11px' }}>
                <option value="">➕ Nouvel accompagnant (sera ajouté à l'annuaire)</option>
                {accsDuBenef.map(a=> <option key={a.id} value={a.id}>{nomAnnu(a)}{a.lien?` (${a.lien})`:''}</option>)}
              </select>
            </div>
          )}
          <G2><F label="Prénom *" val={form.contact_prenom} set={v=>set('contact_prenom',v)} />
              <F label="Nom *" val={form.contact_nom} set={v=>set('contact_nom',v)} /></G2>
          <G2><F label="Date de naissance" val={form.contact_ddn} set={v=>set('contact_ddn',v)} type="date" />
              <Sel label="Lien avec le bénéficiaire" val={form.contact_relation} set={v=>set('contact_relation',v)} opts={['Conjoint(e)','Enfant','Parent','Frère/Sœur','Ami(e)','Soignant(e)','Autre']} /></G2>
          <G2><F label="Email" val={form.contact_email} set={v=>set('contact_email',v)} type="email" />
              <F label="Téléphone" val={form.contact_telephone} set={v=>set('contact_telephone',v)} type="tel" /></G2>

          <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.4, margin:'14px 0 4px' }}>Première idée du souhait</div>
          <div>
            <label style={LBL}>Que voudrait faire le bénéficiaire ? *</label>
            <textarea value={form.souhait_description} onChange={e=>set('souhait_description',e.target.value)} rows={3} placeholder="Première idée du souhait (sera précisée lors de la rencontre)…" style={TA}/>
          </div>
          <G2><F label="Lieu / Destination envisagée" val={form.souhait_lieu} set={v=>set('souhait_lieu',v)} placeholder="Mer, Pairi Daiza, Banneux…" />
              <div style={{ display:'flex', alignItems:'flex-end' }}><CK val={form.urgence} set={v=>set('urgence',v)} label="⚠️ Demande urgente" accent /></div></G2>
        </Section>}

        {/* ── RENCONTRE : compléments recueillis sur place ── */}
        {curId==='rencontre' && <Section titre="Rencontre — informations complémentaires">
          <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.4, marginBottom:4 }}>Référents</div>
          <G2><F label="Médecin traitant" val={form.medecin_referent} set={v=>set('medecin_referent',v)} />
              <F label="Tél. médecin" val={form.telephone_medecin} set={v=>set('telephone_medecin',v)} type="tel" /></G2>
          <F label="Infirmier(ère) référent(e) de l'établissement" val={form.infirmier_referent_etablissement} set={v=>set('infirmier_referent_etablissement',v)} />
          <G2><F label="Contact d'urgence — Nom" val={form.contact_urgence_nom} set={v=>set('contact_urgence_nom',v)} />
              <F label="Contact d'urgence — Tél." val={form.contact_urgence_tel} set={v=>set('contact_urgence_tel',v)} type="tel" /></G2>

          <div style={{ background:'#F0F9FB', border:'1px solid rgba(27,176,206,.15)', borderRadius:12, padding:'14px 16px', marginTop:12 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#0E4A5A', marginBottom:10 }}>Consentements</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:8 }}>
              <CK val={form.consentement_photo}       set={v=>set('consentement_photo',v)}       label="📸 Photos autorisées" />
              <CK val={form.consentement_video}       set={v=>set('consentement_video',v)}       label="🎥 Vidéos autorisées" />
              <CK val={form.consentement_publication} set={v=>set('consentement_publication',v)} label="📢 Publication autorisée" />
              <CK val={form.consentement_signe}       set={v=>set('consentement_signe',v)}       label="✅ Consentement signé" />
            </div>
          </div>
        </Section>}


        {/* ── MÉDICAL ── */}
        {curId==='medical' && <Section titre="Informations médicales">
          {/* Contacts médicaux */}
          <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.4, marginBottom:6 }}>Contacts médicaux</div>
          <G2>
            <ContactMedicalSelect label="Médecin référent" type="medecin" value={form.medecin_referent} onChange={(v)=>set('medecin_referent',v)} placeholder="Dr…" />
            <ContactMedicalSelect label="Médecin traitant" type="medecin" value={form.medecin_traitant}
              onChange={(v,c)=>{ set('medecin_traitant',v); if (c?.telephone) set('telephone_medecin', c.telephone) }} placeholder="Dr…" />
          </G2>
          <G2>
            <ContactMedicalSelect label="Médecin de garde" type="medecin" value={form.medecin_garde} onChange={(v)=>set('medecin_garde',v)} placeholder="Dr…" />
            <ContactMedicalSelect label="Infirmiers" type="infirmier" value={form.infirmiers} onChange={(v)=>set('infirmiers',v)} placeholder="Service / nom…" />
          </G2>
          <G2>
            <ContactMedicalSelect label="Kiné" type="kine" value={form.kine} onChange={(v)=>set('kine',v)} />
            <ContactMedicalSelect label="2ᵉ ligne" type="autre" value={form.deuxieme_ligne} onChange={(v)=>set('deuxieme_ligne',v)} placeholder="Contact 2e ligne…" />
          </G2>

          {/* Informations médicales */}
          <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.4, margin:'16px 0 6px' }}>Informations médicales</div>
          <F label="Allergies" val={form.allergies_medicaments} set={v=>set('allergies_medicaments',v)} placeholder="Aucune connue / Pénicilline…" />
          <div style={{ background:'#FCEBEB', border:'1px solid rgba(200,67,90,.2)', borderRadius:12, padding:'12px 14px', marginTop:8 }}>
            <CK val={form.ne_pas_reanimer} set={v=>set('ne_pas_reanimer',v)} label="⚕️ Ne pas réanimer (NPR)" accent />
            <div style={{ marginTop:8 }}>
              <label style={LBL}>Détails acharnement thérapeutique</label>
              <textarea value={form.details_acharnement} onChange={e=>set('details_acharnement',e.target.value)} rows={2} placeholder="Soins de confort uniquement, morphine autorisée…" style={TA}/>
            </div>
          </div>
          <div style={{ marginTop:10 }}>
            <label style={LBL}>Pathologies</label>
            <textarea value={form.pathologies} onChange={e=>set('pathologies',e.target.value)} rows={3} placeholder="Pathologies, stade, limitations fonctionnelles…" style={TA}/>
          </div>
          <div>
            <label style={LBL}>Antécédents</label>
            <textarea value={form.antecedents} onChange={e=>set('antecedents',e.target.value)} rows={2} style={TA}/>
          </div>
          <F label="Douleurs" val={form.douleurs} set={v=>set('douleurs',v)} placeholder="Diffuses, localisées…" />

          {/* Divers */}
          <G2>
            <F label="Voie d'accès" val={form.voie_acces} set={v=>set('voie_acces',v)} placeholder="Cathéter, PAC…" />
            <F label="Mobilisations" val={form.mobilisations} set={v=>set('mobilisations',v)} placeholder="Tient debout, lève-personne…" />
          </G2>
          <F label="Communication" val={form.communication} set={v=>set('communication',v)} placeholder="Normale, malentendant…" />

          {/* Paramètres */}
          <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.4, margin:'16px 0 6px' }}>Paramètres</div>
          <G2>
            <F label="Cible saturation O2" val={form.cible_saturation_o2} set={v=>set('cible_saturation_o2',v)} placeholder="≥ 92%…" />
            <F label="Débit O2" val={form.debit_o2} set={v=>set('debit_o2',v)} placeholder="2 L/min…" />
          </G2>
          <G2>
            <F label="Apport O2" val={form.apport_o2} set={v=>set('apport_o2',v)} placeholder="Lunettes, masque…" />
            <F label="Cible TA" val={form.cible_ta} set={v=>set('cible_ta',v)} placeholder="Ex. 110-140…" />
          </G2>
          <F label="Cible FC" val={form.cible_fc} set={v=>set('cible_fc',v)} placeholder="Ex. 60-90…" />

          {/* Déglutition / alimentation / continences */}
          <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.4, margin:'16px 0 6px' }}>Déglutition · alimentation · continences</div>
          <G2>
            <F label="Déglutition" val={form.deglutition} set={v=>set('deglutition',v)} placeholder="Normale, troubles…" />
            <F label="Alimentation" val={form.alimentation} set={v=>set('alimentation',v)} placeholder="Découpée, mixée…" />
          </G2>
          <G2>
            <F label="Continence urinaire" val={form.continence_urinaire} set={v=>set('continence_urinaire',v)} placeholder="Cystocath, protection…" />
            <F label="Continence fécale" val={form.continence_fecale} set={v=>set('continence_fecale',v)} placeholder="Protection…" />
          </G2>
          <F label="Précisions continences" val={form.precisions_continences} set={v=>set('precisions_continences',v)} />

          {/* Mobilité & transport (conservé) */}
          <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.4, margin:'16px 0 6px' }}>Mobilité & transport</div>
          <Sel label="Position de transport" val={form.position_transport} set={v=>set('position_transport',v)} opts={['assis','semi_assis','allonge','brancard','fauteuil_roulant']} labels={['Assis','Semi-assis','Allongé','Brancard','Fauteuil roulant']} />
          <div>
            <label style={LBL}>Matériel médical à prévoir</label>
            <textarea value={form.materiel_medical} onChange={e=>set('materiel_medical',e.target.value)} rows={2} placeholder="Pompe à morphine, O2, scope…" style={TA}/>
          </div>

          {/* Plan de traitement */}
          <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.4, margin:'16px 0 6px' }}>💊 Plan de traitement</div>
          <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:8 }}>Médicament, voie, posologie, et heures de prise (d'office) ou condition (si nécessaire). L'administration se cochera ensuite dans la fiche le jour de la mission.</div>
          <TraitementsEditor value={form.traitements} onChange={(l)=>set('traitements',l)} />
        </Section>}

        {/* ── LOGISTIQUE ── */}
        {curId==='logistique' && <Section titre="Logistique & transports">
          <div style={{ background:'#E6F7FA', border:'1px solid rgba(27,176,206,.2)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#0E4A5A', marginBottom:10 }}>📍 Lieu de prise en charge</div>
            <CK val={form.pec_domicile} set={v=>set('pec_domicile',v)} label="🏠 Prise en charge au domicile" />
            <div style={{ marginTop:8 }}>
              <AddressSearch label="Rechercher (nom d'hôpital, établissement, adresse…)"
                value={form.lieu_prise_en_charge}
                onChange={({adresse,nom,lat,lon})=>setForm(s=>({...s,
                  lieu_prise_en_charge: nom || s.lieu_prise_en_charge,
                  adresse_prise_en_charge: adresse,
                  pec_lat:lat, pec_lon:lon }))}
                placeholder="Ex. CHC MontLégia, CHU Liège…" />
            </div>
            <G2>
              <F label="Nom du lieu / Établissement" val={form.lieu_prise_en_charge} set={v=>set('lieu_prise_en_charge',v)} placeholder="CHC Saint-Joseph…" />
              <F label="Adresse complète" val={form.adresse_prise_en_charge} set={v=>set('adresse_prise_en_charge',v)} placeholder="Rue, numéro, code postal, ville" />
            </G2>
            <G2>
              <F label="Route / aile (hôpital)" val={form.pec_route} set={v=>set('pec_route',v)} placeholder="Ex. Route 200, aile B…" />
              <F label="N° de chambre" val={form.pec_numero_chambre} set={v=>set('pec_numero_chambre',v)} placeholder="Ex. 249" />
            </G2>
            <div style={{ marginTop:10 }}>
              <label style={LBL}>Précisions prise en charge</label>
              <textarea value={form.pec_precisions} onChange={e=>set('pec_precisions',e.target.value)} rows={2} style={TA}
                placeholder="Ex. 2e étage, demander à l'accompagnante d'attendre dans le hall…" />
            </div>
          </div>
          <div style={{ background:'#EAF3DE', border:'1px solid rgba(59,109,17,.15)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#3B6D11', marginBottom:10 }}>🎯 Lieu de destination</div>
            <AddressSearch label="Rechercher (lieu, point marquant, parking…)"
              value={form.lieu_destination}
              onChange={({adresse,nom,lat,lon})=>setForm(s=>({...s,
                lieu_destination: nom || s.lieu_destination,
                adresse_destination: adresse,
                dest_lat:lat, dest_lon:lon }))}
              placeholder="Ex. Parking De Haan, Pairi Daiza, digue de mer…" />
            <G2>
              <F label="Nom du lieu / Destination" val={form.lieu_destination} set={v=>set('lieu_destination',v)} placeholder="Mer du Nord — De Haan…" />
              <F label="Adresse complète" val={form.adresse_destination} set={v=>set('adresse_destination',v)} placeholder="Rue, numéro, code postal, ville" />
            </G2>
            <G2>
              <F label="Adresse particulière / repère" val={form.dest_adresse_particuliere} set={v=>set('dest_adresse_particuliere',v)} placeholder="Parking, accès PMR, point de rendez-vous…" />
              <div />
            </G2>
            <div style={{ marginTop:10 }}>
              <label style={LBL}>Précisions destination</label>
              <textarea value={form.dest_precisions} onChange={e=>set('dest_precisions',e.target.value)} rows={2} style={TA}
                placeholder="Indications utiles à l'arrivée…" />
            </div>
          </div>
          <F label="Lieu de retour (si différent de la prise en charge)" val={form.lieu_retour} set={v=>set('lieu_retour',v)} placeholder="Même lieu ou adresse différente…" />

          {/* Souhait sur plusieurs jours + hébergement */}
          <div style={{ background:'#FAEEDA', border:'1px solid rgba(186,117,23,.18)', borderRadius:12, padding:'14px 16px', marginTop:8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', marginBottom: form.sur_plusieurs_jours?12:0 }}>
              <input type="checkbox" checked={!!form.sur_plusieurs_jours} onChange={e=>set('sur_plusieurs_jours',e.target.checked)} style={{ accentColor:'#BA7517', width:16, height:16 }}/>
              <span style={{ fontSize:13.5, fontWeight:600, color:'#BA7517' }}>🏨 Souhait sur plusieurs jours (avec nuitée)</span>
            </label>
            {form.sur_plusieurs_jours && <>
              <F label="Date de fin du séjour" val={form.date_fin} set={v=>set('date_fin',v)} type="date" />

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'14px 0 8px' }}>
                <span style={{ fontSize:12.5, fontWeight:700, color:'#7A5512', textTransform:'uppercase', letterSpacing:.3 }}>Réservations d'hôtel</span>
                <button type="button" onClick={addHotel} style={{ ...BTN_SM, background:'#FAEEDA', color:'#BA7517' }}>+ Hôtel</button>
              </div>
              {(form.hotels||[]).length === 0 && <div style={{ fontSize:12.5, color:'#A8A39D', fontStyle:'italic' }}>Aucune réservation encodée.</div>}
              {(form.hotels||[]).map((h,i)=>(
                <div key={h.id||i} style={{ background:'white', border:'1px solid rgba(186,117,23,.2)', borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <span style={{ fontSize:12.5, fontWeight:700, color:'#7A5512' }}>🏨 Hôtel {i+1}</span>
                    <button type="button" onClick={()=>removeHotel(i)} style={{ ...BTN_SM, background:'#FCEBEB', color:'#C8435A' }}>✕</button>
                  </div>
                  <F label="Nom de l'hôtel" val={h.nom} set={v=>updateHotel(i,'nom',v)} placeholder="Ex. Ibis De Haan" />
                  <AddressSearch label="Adresse" value={h.adresse}
                    onChange={({adresse})=>updateHotel(i,'adresse',adresse)}
                    placeholder="Rechercher l'adresse de l'hôtel…" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginTop:8 }}>
                    <F label="Arrivée" val={h.date_arrivee} set={v=>updateHotel(i,'date_arrivee',v)} type="date" />
                    <F label="Départ" val={h.date_depart} set={v=>updateHotel(i,'date_depart',v)} type="date" />
                    <F label="Nuits" val={h.nb_nuits} set={v=>updateHotel(i,'nb_nuits',v)} type="number" />
                  </div>
                  <div style={{ marginTop:10 }}>
                    <label style={{ ...LBL, marginBottom:4 }}>Confirmation de réservation (PDF)</label>
                    <FileUpload value={h.confirmation_url ? { url:h.confirmation_url, nom:h.confirmation_nom } : null}
                      onChange={(file)=>{ updateHotel(i,'confirmation_url', file?.url||''); updateHotel(i,'confirmation_nom', file?.nom||'') }}
                      label="Joindre la confirmation PDF" folder="hotels" />
                  </div>
                </div>
              ))}
            </>}
          </div>

          {/* Équipages & besoins en personnel */}
          <div style={{ marginTop:16, background:'#F0F9FB', border:'1px solid rgba(27,176,206,.12)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6, flexWrap:'wrap', gap:8 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#0E4A5A' }}>👥 Équipages & besoins en personnel</div>
              <div style={{ display:'flex', gap:6 }}>
                <button type="button" onClick={()=>addEquipage('ambulance')} style={BTN_SM}>+ Ambulance</button>
                <button type="button" onClick={()=>addEquipage('logistique')} style={{ ...BTN_SM, background:'#EAF3DE', color:'#3B6D11' }}>+ Véhicule logistique</button>
              </div>
            </div>
            <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:12 }}>Chaque ambulance nécessite 1 ambulancier accrédité conducteur + 1 équipier. Ajoutez une 2ᵉ ambulance pour un 2ᵉ patient, ou un véhicule logistique (ex. transport d'une chaise roulante).</div>

            {equipages.length === 0 && <div style={{ fontSize:13, color:'#A8A39D', fontStyle:'italic' }}>Aucun équipage défini — ajoutez au moins une ambulance.</div>}

            {equipages.map((eq, i) => (
              <div key={eq.id || i} style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ fontSize:12.5, fontWeight:700, color: eq.type==='logistique' ? '#3B6D11' : '#C8435A' }}>
                    {eq.type === 'logistique' ? `🚐 Véhicule logistique ${i+1}` : `🚑 Ambulance ${i+1}`}
                  </span>
                  <button type="button" onClick={()=>removeEquipage(i)} style={{ ...BTN_SM, background:'#FCEBEB', color:'#C8435A' }}>✕</button>
                </div>

                {eq.type === 'ambulance' ? (
                  <div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:10 }}>
                      <Sel label="Mode" val={eq.mode||'normalise'} set={v=>updateEquipage(i,'mode',v)}
                        opts={['normalise','paramedicalise']} labels={['Normalisé','Paramédicalisé']} />
                      <div style={{ fontSize:11.5, color:'#7A7470', alignSelf:'end', paddingBottom:6, lineHeight:1.4 }}>
                        2 volontaires médicaux obligatoires, dont 1 <strong>accrédité chauffeur</strong>.
                        {eq.mode === 'paramedicalise'
                          ? ' Le 2ᵉ doit être infirmier ou médecin.'
                          : ' Le 2ᵉ est ambulancier.'}
                      </div>
                    </div>
                    <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, fontSize:12.5, color:'#4A4340', cursor:'pointer' }}>
                      <input type="checkbox" checked={!!eq.longue_route} onChange={e=>updateEquipage(i,'longue_route',e.target.checked)} style={{ accentColor:'#1BB0CE', width:15, height:15 }} />
                      Longue route → ajouter un 3ᵉ équipier (2ᵉ ambulancier chauffeur)
                    </label>
                  </div>
                ) : (
                  <div style={{ fontSize:12.5, color:'#3B6D11' }}>Besoin : 1 volontaire (conducteur). Ex. transport de chaise roulante, matériel.</div>
                )}
                <div style={{ marginTop:10 }}>
                  <F label="🚗 Immatriculation du véhicule" val={eq.immatriculation||''} set={v=>updateEquipage(i,'immatriculation',v)} placeholder="1-ABC-234" />
                </div>
                <F label="Note" val={eq.note||''} set={v=>updateEquipage(i,'note',v)} placeholder="Précision éventuelle…" />
              </div>
            ))}

            {/* Affectation du personnel + véhicules (édition d'un souhait existant) */}
            {isEdit ? (
              <AffectationEquipages souhaitId={id} equipages={equipages}
                dateSouhait={form.date_souhait} dateFin={form.date_fin} surPlusieursJours={form.sur_plusieurs_jours}
                onVehicule={(eqId,plate)=>setEquipages(es=>es.map(e=>e.id===eqId?{...e,immatriculation:plate}:e))}
                onChauffeur={(eqId,userId)=>setEquipages(es=>es.map(e=>e.id===eqId?{...e,chauffeur_id:userId}:e))} />
            ) : (
              <div style={{ marginTop:12, fontSize:12, color:'#A8A39D', fontStyle:'italic' }}>Enregistrez d'abord le souhait pour pouvoir affecter le personnel.</div>
            )}
          </div>

          {/* Timing */}
          <div style={{ marginTop:16, background:'#F0F9FB', border:'1px solid rgba(27,176,206,.12)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#0E4A5A', marginBottom:10 }}>🕐 Timing de la mission</div>
            <F label="Base de départ" val={form.base_depart} set={v=>set('base_depart',v)} placeholder="Ex. Solumob Jemeppe/Meuse" />
            <div style={{ fontSize:11.5, color:'#7A7470', margin:'8px 0 6px' }}>Encodez les heures (jour du souhait par défaut). Cochez « jour précis » pour changer la date.</div>
            <TimingsEditor timings={form.timings} onChange={(t)=>set('timings',t)} />
          </div>
        </Section>}

        {/* ── DATES ── */}
        {curId==='dates' && <Section titre="Dates possibles de réalisation">
          <div style={{ background:'#F0F9FB', border:'1px solid rgba(27,176,206,.12)', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#0E4A5A' }}>
            💡 Indiquez une ou plusieurs dates possibles. Le coordinateur confirmera la date définitive en fonction des disponibilités de l'équipe.
          </div>
          {dates.map((d,i)=>{
            const cov = couverture(d)
            const couleur = d.confirmee ? '#3B6D11' : cov.vide ? 'rgba(27,176,206,.12)' : cov.ok ? '#3B6D11' : '#C8435A'
            const fond = d.confirmee || cov.ok ? '#F6FBF1' : cov.vide ? 'white' : '#FDF1F3'
            return (
            <div key={i} style={{ background:fond, border:`1.5px solid ${couleur}`, borderRadius:12, padding:'14px 16px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:600, color: d.confirmee?'#3B6D11':'#1A1514' }}>
                  {d.confirmee ? '✅ Date confirmée' : `Option ${i+1}`}
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {can('souhaits.logistique') && <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, cursor:'pointer' }}>
                    <input type="checkbox" checked={!!d.confirmee} onChange={e=>updateDate(i,'confirmee',e.target.checked)} style={{ accentColor:'#3B6D11' }}/>
                    Confirmer
                  </label>}
                  <button onClick={()=>removeDate(i)} style={{ ...BTN_SM, background:'#FCEBEB', color:'#C8435A', padding:'3px 9px', fontSize:12 }}>✕</button>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10 }}>
                <F label={d.plusieurs_jours ? 'Date de début *' : 'Date *'} val={d.date_proposee} set={v=>updateDate(i,'date_proposee',v)} type="date" />
                {d.plusieurs_jours && <F label="Date de fin *" val={d.date_fin_proposee} set={v=>updateDate(i,'date_fin_proposee',v)} type="date" />}
                <F label="Heure de départ" val={d.heure_depart} set={v=>updateDate(i,'heure_depart',v)} type="time" />
                <F label="Retour estimé" val={d.heure_retour_estimee} set={v=>updateDate(i,'heure_retour_estimee',v)} type="time" />
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:'#BA7517', cursor:'pointer', margin:'8px 0 4px' }}>
                <input type="checkbox" checked={!!d.plusieurs_jours} onChange={e=>updateDate(i,'plusieurs_jours',e.target.checked)} style={{ accentColor:'#BA7517', width:16, height:16 }} />
                Souhait sur plusieurs jours
              </label>
              <F label="Note" val={d.note} set={v=>updateDate(i,'note',v)} placeholder="Remarque pour cette date…" />

              {/* Indicateur de couverture */}
              {cov.vide ? null : cov.incomplet ? (
                <div style={{ marginTop:8, fontSize:12.5, fontWeight:600, color:'#BA7517' }}>⚠️ Indiquez la date de fin pour vérifier les disponibilités.</div>
              ) : (
                <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontSize:12.5, fontWeight:600, color: cov.ok ? '#3B6D11' : '#C8435A' }}>
                  <span>{cov.ok ? '✅ Disponibilités suffisantes' : '🔴 Disponibilités insuffisantes'}</span>
                  <span style={{ color:'#5A6A6E', fontWeight:500 }}>
                    {cov.nbJours > 1 ? `sur les ${cov.nbJours} jours : ` : ''}
                    {cov.nbAmb} ambulancier{cov.nbAmb>1?'s':''} accrédité{cov.nbAmb>1?'s':''}{cov.nbAmb<1?' (manquant)':''} · {cov.nbInf} infirmier/médecin{cov.nbInf>1?'s':''}{cov.nbInf<1?' (manquant)':''}
                  </span>
                </div>
              )}
            </div>
          )})}
          <button onClick={addDate} style={{ ...BTN_SM, width:'100%', justifyContent:'center', padding:'10px' }}>
            + Ajouter une date possible
          </button>
        </Section>}

        {/* ── SUIVI RÉCOLTEUR ── */}
        {curId==='suivi' && <Section titre="Suivi récolteur de souhait">
          <G2>
            <F label="Date de première demande" val={form.date_premiere_demande} set={v=>set('date_premiere_demande',v)} type="date" />
            <F label="Date de rencontre du bénéficiaire" val={form.date_rencontre_beneficiaire} set={v=>set('date_rencontre_beneficiaire',v)} type="date" />
          </G2>
          <div>
            <label style={LBL}>Notes du récolteur</label>
            <textarea value={form.notes_recolteur} onChange={e=>set('notes_recolteur',e.target.value)} rows={3} placeholder="Observations lors de la rencontre, souhaits particuliers exprimés, contraintes…" style={TA}/>
          </div>

          {/* Historique de suivi */}
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1514', marginBottom:12 }}>Journal de suivi</div>
            <div style={{ background:'#F8FCFD', border:'1px solid rgba(27,176,206,.12)', borderRadius:10, padding:'12px', marginBottom:12 }}>
              <Sel label="Type de contact" val={newSuivi.type_contact} set={v=>setNewSuivi(s=>({...s,type_contact:v}))}
                opts={['appel','visite','rencontre_beneficiaire','validation','note','modification']}
                labels={['📞 Appel','🏠 Visite','👤 Rencontre bénéficiaire','✅ Validation','📝 Note','✏️ Modification']} />
              <div style={{ marginTop:8 }}>
                <textarea value={newSuivi.contenu} onChange={e=>setNewSuivi(s=>({...s,contenu:e.target.value}))} rows={3} placeholder="Décrivez le contact, les échanges, les décisions prises…" style={TA}/>
              </div>
              <button onClick={addSuiviEntry} disabled={!newSuivi.contenu.trim()} style={{ ...BTN_SM, marginTop:8, opacity:!newSuivi.contenu.trim()?.5:1 }}>
                + Ajouter au journal
              </button>
            </div>
            {suiviEntries.map((e,i)=>{
              const TYPE_ICONS = { appel:'📞', visite:'🏠', rencontre_beneficiaire:'👤', validation:'✅', note:'📝', modification:'✏️' }
              return (
                <div key={i} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(27,176,206,.07)' }}>
                  <div style={{ fontSize:18, flexShrink:0 }}>{TYPE_ICONS[e.type_contact]||'📋'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:3 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'#1BB0CE' }}>{e.profiles?.prenom} {e.profiles?.nom}</span>
                      <span style={{ fontSize:11.5, color:'#A8A39D' }}>{new Date(e.date_contact).toLocaleDateString('fr-BE',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <div style={{ fontSize:13.5, color:'#1A1514', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{e.contenu}</div>
                  </div>
                </div>
              )
            })}
            {suiviEntries.length === 0 && <div style={{ fontSize:13, color:'#A8A39D', textAlign:'center', padding:'16px 0', fontStyle:'italic' }}>Aucune entrée de suivi pour l'instant.</div>}
          </div>

          {/* Statut général */}
          <div style={{ marginTop:8 }}>
            <Sel label="Statut du souhait" val={form.statut} set={v=>set('statut',v)}
              opts={STATUTS_SOUHAIT.map(s=>s.key)}
              labels={STATUTS_SOUHAIT.map(s=>s.label)} />
          </div>
          <div>
            <label style={LBL}>Notes internes (coordinateur)</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={3} placeholder="Notes internes réservées au coordinateur…" style={TA}/>
          </div>
        </Section>}

        {error && <div style={{ background:'#FEF2F2', border:'1px solid #FCD5D5', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#991B1B', marginTop:14 }}>{error}</div>}

        {/* Navigation */}
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, paddingTop:18, borderTop:'1px solid rgba(27,176,206,.08)' }}>
          <button onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0} style={{ padding:'9px 20px', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, background:'white', color:'#7A7470', cursor:step===0?'not-allowed':'pointer', opacity:step===0?.4:1, fontFamily:"'DM Sans',sans-serif", fontSize:13.5 }}>
            ← Précédent
          </button>
          <div style={{ display:'flex', gap:10 }}>
            {step < STEPS.length-1
              ? <button onClick={()=>setStep(s=>s+1)} style={{ padding:'9px 22px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, cursor:'pointer', fontSize:13.5, fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>
                  Suivant →
                </button>
              : <button onClick={save} disabled={saving} style={{ padding:'9px 22px', background:saving?'rgba(27,176,206,.4)':'#1BB0CE', color:'white', border:'none', borderRadius:9, cursor:saving?'wait':'pointer', fontSize:13.5, fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>
                  {saving ? '⏳ Enregistrement…' : '✓ Enregistrer le souhait'}
                </button>
            }
            <button onClick={save} disabled={saving} style={{ padding:'9px 18px', background:'#EAF3DE', color:'#3B6D11', border:'1px solid rgba(59,109,17,.2)', borderRadius:9, cursor:saving?'wait':'pointer', fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>
              💾 Sauvegarder
            </button>
          </div>
        </div>
      </div>
      ); })()}
    </div>
  )
}

// ── Composants helpers ────────────────────────────────────────────────────────
function Section({ titre, children }) {
  return <div><div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.3rem', fontWeight:500, color:'#1A1514', marginBottom:18 }}>{titre}</div><div style={{ display:'flex', flexDirection:'column', gap:14 }}>{children}</div></div>
}
function TimingsEditor({ timings, onChange }) {
  const list = Array.isArray(timings) ? timings : []
  const milieu = list.filter(t => t.custom)
  const valOf = (id) => list.find(t => t.id === id && !t.custom) || { id, heure:'', jour:'' }
  const debutMap = Object.fromEntries(TIMINGS_DEBUT.map(t => [t.id, valOf(t.id)]))
  const finMap   = Object.fromEntries(TIMINGS_FIN.map(t => [t.id, valOf(t.id)]))

  function emit(dMap, mil, fMap) {
    const debut = TIMINGS_DEBUT.map(t => ({ ...(dMap[t.id]||{}), id:t.id, label:t.label, heure:dMap[t.id]?.heure||'', jour:dMap[t.id]?.jour||'' }))
    const fin   = TIMINGS_FIN.map(t => ({ ...(fMap[t.id]||{}), id:t.id, label:t.label, heure:fMap[t.id]?.heure||'', jour:fMap[t.id]?.jour||'' }))
    onChange([...debut, ...mil, ...fin])
  }
  const setFixed = (bloc, id, k, v) => {
    if (bloc === 'debut') { const m = { ...debutMap, [id]:{ ...debutMap[id], [k]:v } }; emit(m, milieu, finMap) }
    else { const m = { ...finMap, [id]:{ ...finMap[id], [k]:v } }; emit(debutMap, milieu, m) }
  }
  const setMil = (id,k,v) => emit(debutMap, milieu.map(m=>m.id===id?{ ...m, [k]:v }:m), finMap)
  const delMil = (id)     => emit(debutMap, milieu.filter(m=>m.id!==id), finMap)
  function addMil(){ const label = prompt('Libellé de l\'horaire (ex. Pause, Arrivée hôtel…)'); if (label && label.trim()) emit(debutMap, [...milieu, { id:'t'+Date.now(), label:label.trim(), heure:'', jour:'', custom:true }], finMap) }

  const IN = { padding:'7px 9px', border:'1px solid rgba(0,0,0,.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif" }

  const ligneFixe = (bloc, t) => {
    const v = (bloc==='debut'?debutMap:finMap)[t.id]
    return (
      <div key={t.id} style={{ background:'white', border:'1px solid rgba(0,0,0,.08)', borderRadius:9, padding:'9px 11px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ flex:1, minWidth:150, fontSize:13, fontWeight:600, color:'#1A1514' }}>{t.label}</span>
          <input type="time" value={v.heure||''} onChange={e=>setFixed(bloc,t.id,'heure',e.target.value)} style={{ ...IN, width:120 }} />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:11.5, color:'#0E7A93', marginTop:6, cursor:'pointer' }}>
          <input type="checkbox" checked={!!v.jour} onChange={e=>setFixed(bloc,t.id,'jour', e.target.checked ? todayLocal() : '')} style={{ accentColor:'#1BB0CE' }} />
          Jour précis
        </label>
        {v.jour && <input type="date" value={v.jour} onChange={e=>setFixed(bloc,t.id,'jour',e.target.value)} style={{ ...IN, marginTop:5 }} />}
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {TIMINGS_DEBUT.map(t => ligneFixe('debut', t))}

      {/* Milieu libre */}
      <div style={{ borderLeft:'2px dashed rgba(14,122,147,.3)', paddingLeft:10, marginLeft:2, display:'flex', flexDirection:'column', gap:8 }}>
        {milieu.map(m => (
          <div key={m.id} style={{ background:'#F0F9FB', border:'1px solid rgba(27,176,206,.15)', borderRadius:9, padding:'9px 11px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <input value={m.label} onChange={e=>setMil(m.id,'label',e.target.value)} placeholder="Libellé" style={{ ...IN, flex:1, minWidth:140 }} />
              <input type="time" value={m.heure||''} onChange={e=>setMil(m.id,'heure',e.target.value)} style={{ ...IN, width:120 }} />
              <button type="button" onClick={()=>delMil(m.id)} style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'4px 8px', fontSize:12, cursor:'pointer' }}>✕</button>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:11.5, color:'#0E7A93', marginTop:6, cursor:'pointer' }}>
              <input type="checkbox" checked={!!m.jour} onChange={e=>setMil(m.id,'jour', e.target.checked ? todayLocal() : '')} style={{ accentColor:'#1BB0CE' }} />
              Jour précis
            </label>
            {m.jour && <input type="date" value={m.jour} onChange={e=>setMil(m.id,'jour',e.target.value)} style={{ ...IN, marginTop:5 }} />}
          </div>
        ))}
        <button type="button" onClick={addMil} style={{ alignSelf:'flex-start', padding:'7px 13px', background:'#E6F7FA', color:'#0E7A93', border:'1px dashed rgba(14,122,147,.4)', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>+ Ajouter un horaire (entre aller et retour)</button>
      </div>

      {TIMINGS_FIN.map(t => ligneFixe('fin', t))}
    </div>
  )
}

function G2({ children }) { return <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>{children}</div> }
function F({ label, val, set, type='text', placeholder }) {
  return <div><label style={LBL}>{label}</label><input type={type} value={val||''} onChange={e=>set(e.target.value)} placeholder={placeholder} style={INP} onFocus={e=>e.target.style.borderColor='#1BB0CE'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,.1)'}/></div>
}
function Sel({ label, val, set, opts, labels }) {
  return <div><label style={LBL}>{label}</label><select value={val||''} onChange={e=>set(e.target.value)} style={SEL}><option value="">— Sélectionner</option>{opts.map((o,i)=><option key={o} value={o}>{labels?labels[i]:o}</option>)}</select></div>
}
function CK({ val, set, label, accent }) {
  return <label style={{ display:'flex', alignItems:'flex-start', gap:9, cursor:'pointer', padding:'8px 10px', borderRadius:8, background:accent&&val?'#E6F7FA':'transparent', border:`1px solid ${accent?'rgba(27,176,206,.2)':'transparent'}`, transition:'all .12s' }}>
    <input type="checkbox" checked={!!val} onChange={e=>set(e.target.checked)} style={{ width:16, height:16, marginTop:2, accentColor:'#1BB0CE', flexShrink:0 }}/>
    <span style={{ fontSize:13.5, color:'#4A4340', lineHeight:1.5 }}>{label}</span>
  </label>
}

const LBL = { fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }
const INP = { width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", outline:'none', transition:'border-color .12s' }
const SEL = { width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }
const TA  = { width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical', lineHeight:1.6 }
const BTN_SM = { display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', background:'#E6F7FA', color:'#1BB0CE', border:'1px solid rgba(27,176,206,.2)', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }

const CSS = `
@media(max-width:600px){[style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr !important;}[style*="grid-template-columns: 1fr 1fr 1fr"]{grid-template-columns:1fr !important;}[style*="grid-template-columns: 1fr 1fr 1fr auto"]{grid-template-columns:1fr 1fr !important;}}
`