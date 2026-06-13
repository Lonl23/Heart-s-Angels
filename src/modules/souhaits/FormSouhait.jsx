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

const INITIAL = {
  // Patient
  patient_prenom:'', patient_nom:'', patient_ddn:'', etablissement:'',
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
  base_depart:'', rdv_base:'', depart_base:'', arrivee_pec:'', depart_pec:'', arrivee_destination:'', planning_particulier:[],
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
  const [vehicules, setVehicules] = useState([])
  const [equipages, setEquipages] = useState([])
  const [suiviEntries, setSuiviEntries] = useState([])
  const [newSuivi, setNewSuivi] = useState({ type_contact:'note', contenu:'' })
  const [saving, setSaving] = useState(false)
  const [error, setError]  = useState('')
  const [loading, setLoading] = useState(isEdit || !!fromDemande)

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

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
          ;['rdv_base','depart_base','arrivee_pec','depart_pec','arrivee_destination'].forEach(k=>{ if (s[k]) f[k] = new Date(s[k]).toISOString().slice(0,16) })
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
  function addDate() {
    setDates(d => [...d, { date_proposee:'', heure_depart:'', heure_retour_estimee:'', note:'', confirmee:false, _new:true }])
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

    // Les champs vides ('') cassent les colonnes DATE/numériques → convertir en null
    const clean = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
    )
    const payload = { ...clean, vehicules, equipages, created_by: profile?.id }

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
      for (const d of dates) {
        if (!d.date_proposee) continue
        if (d.id && !d._new) {
          await supabase.from('souhait_dates').update({ date_proposee:d.date_proposee, heure_depart:d.heure_depart||null, heure_retour_estimee:d.heure_retour_estimee||null, note:d.note||null, confirmee:d.confirmee }).eq('id', d.id)
        } else {
          await supabase.from('souhait_dates').insert({ souhait_id:souhaitId, date_proposee:d.date_proposee, heure_depart:d.heure_depart||null, heure_retour_estimee:d.heure_retour_estimee||null, note:d.note||null, confirmee:!!d.confirmee })
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
          <G2><F label="Prénom *" val={form.patient_prenom} set={v=>set('patient_prenom',v)} />
              <F label="Nom *" val={form.patient_nom} set={v=>set('patient_nom',v)} /></G2>
          <G2><F label="Date de naissance" val={form.patient_ddn} set={v=>set('patient_ddn',v)} type="date" />
              <F label="Institution / MRS / Hôpital" val={form.etablissement} set={v=>set('etablissement',v)} /></G2>

          <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.4, margin:'14px 0 4px' }}>Demandeur</div>
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
            <G2>
              <F label="RDV base" val={form.rdv_base} set={v=>set('rdv_base',v)} type="datetime-local" />
              <F label="Départ base" val={form.depart_base} set={v=>set('depart_base',v)} type="datetime-local" />
            </G2>
            <G2>
              <F label="Arrivée lieu PEC" val={form.arrivee_pec} set={v=>set('arrivee_pec',v)} type="datetime-local" />
              <F label="Départ lieu PEC" val={form.depart_pec} set={v=>set('depart_pec',v)} type="datetime-local" />
            </G2>
            <F label="Arrivée destination" val={form.arrivee_destination} set={v=>set('arrivee_destination',v)} type="datetime-local" />
          </div>
        </Section>}

        {/* ── DATES ── */}
        {curId==='dates' && <Section titre="Dates possibles de réalisation">
          <div style={{ background:'#F0F9FB', border:'1px solid rgba(27,176,206,.12)', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#0E4A5A' }}>
            💡 Indiquez une ou plusieurs dates possibles. Le coordinateur confirmera la date définitive en fonction des disponibilités de l'équipe.
          </div>
          {dates.map((d,i)=>(
            <div key={i} style={{ background:'white', border:`1.5px solid ${d.confirmee?'#3B6D11':'rgba(27,176,206,.12)'}`, borderRadius:12, padding:'14px 16px', marginBottom:10 }}>
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
                <F label="Date *" val={d.date_proposee} set={v=>updateDate(i,'date_proposee',v)} type="date" />
                <F label="Heure de départ" val={d.heure_depart} set={v=>updateDate(i,'heure_depart',v)} type="time" />
                <F label="Retour estimé" val={d.heure_retour_estimee} set={v=>updateDate(i,'heure_retour_estimee',v)} type="time" />
              </div>
              <F label="Note" val={d.note} set={v=>updateDate(i,'note',v)} placeholder="Remarque pour cette date…" />
            </div>
          ))}
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