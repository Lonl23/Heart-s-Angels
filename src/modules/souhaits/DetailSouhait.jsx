// src/modules/souhaits/DetailSouhait.jsx
import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { STATUT_MAP as STATUTS, STATUTS_FLUX, statutInfo } from '@/lib/souhaitStatuts'
import ChecklistForm from './ChecklistForm'

export default function DetailSouhait() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { profile, can, souhaitsAccess } = useAuth()
  const [souhait, setSouhait]   = useState(null)
  const [personnel, setPersonnel] = useState([])
  const [checklists, setChecklists] = useState([])
  const [rapports, setRapports]   = useState([])
  const [volontaires, setVolontaires] = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('info')   // 'info'|'checklist'|'photos'|'rapport'
  const [showCL, setShowCL]     = useState(null)     // 'depart'|'retour'
  const [updatingStatut, setUpdatingStatut] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const [{ data: s }, { data: p }, { data: cl }, { data: rap }, { data: vol }] = await Promise.all([
      supabase.from('souhaits').select('*').eq('id', id).single(),
      supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role,email)').eq('souhait_id', id),
      supabase.from('checklists').select('*, checklist_reponses(*)').eq('souhait_id', id),
      supabase.from('souhait_rapports').select('*').eq('souhait_id', id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,prenom,nom,role').order('nom'),
    ])
    setSouhait(s); setPersonnel(p || []); setChecklists(cl || []); setRapports(rap || []); setVolontaires(vol || [])
    setLoading(false)
  }

  async function affecterVolontaire(userId, equipageId) {
    if (!userId) return
    if (personnel.some(p => p.user_id === userId && (p.equipage_id || null) === (equipageId || null))) return
    const { error } = await supabase.from('souhait_personnel').insert({ souhait_id: id, user_id: userId, equipage_id: equipageId || null })
    if (error) { alert('Affectation impossible : ' + error.message); return }
    load()
  }
  async function retirerVolontaire(spId) {
    await supabase.from('souhait_personnel').delete().eq('id', spId)
    load()
  }
  async function setVehiculeEquipage(equipageId, immatriculation) {
    const eqs = (souhait.equipages || []).map(e => e.id === equipageId ? { ...e, immatriculation } : e)
    await sauverChamps({ equipages: eqs })
  }

  // Sauvegarde générique d'un sous-ensemble de champs du souhait
  async function sauverChamps(champs) {
    const { error } = await supabase.from('souhaits').update(champs).eq('id', id)
    if (error) { alert('Enregistrement impossible : ' + error.message); return false }
    setSouhait(s => ({ ...s, ...champs }))
    return true
  }

  async function changeStatut(statut) {
    setUpdatingStatut(true)
    await supabase.from('souhaits').update({ statut }).eq('id', id)
    setSouhait(s => ({...s, statut}))
    setUpdatingStatut(false)
  }

  if (loading) return <div style={{ padding:28, fontFamily:'DM Sans,sans-serif', color:'#7A7470' }}>Chargement…</div>
  if (!souhait) return <div style={{ padding:28 }}><Link to="/app/souhaits">← Retour</Link><p>Souhait introuvable.</p></div>

  // Verrou d'accès : un volontaire ni récolteur ni affecté ne peut pas consulter
  const acces = souhaitsAccess()
  const suisAffecte = personnel.some(p => p.user_id === profile?.id)
  if (acces === 'none' || (acces === 'affecte' && !suisAffecte)) {
    return (
      <div style={{ padding:'40px 28px', fontFamily:'DM Sans,sans-serif', maxWidth:600 }}>
        <Link to="/app/souhaits" style={{ color:'#7A7470', textDecoration:'none', fontSize:13 }}>← Retour</Link>
        <div style={{ textAlign:'center', padding:'40px 0', color:'#7A7470' }}>
          <div style={{ fontSize:'2rem', marginBottom:10 }}>🔒</div>
          <p style={{ fontSize:14.5 }}>Vous n'êtes pas affecté à ce souhait. Son contenu n'est accessible qu'au personnel affecté et aux récolteurs.</p>
        </div>
      </div>
    )
  }

  const st = statutInfo(souhait.statut)
  const clDepart = checklists.find(c => c.type === 'depart')
  const clRetour = checklists.find(c => c.type === 'retour')
  // Suis-je affecté à ce souhait ? Suis-je infirmier/médecin ?
  const estAffecte = personnel.some(p => p.user_id === profile?.id)
  const estInfMed  = ['infirmier','medecin'].includes(profile?.role) || (profile?.roles_supplementaires||[]).some(r=>['infirmier','medecin'].includes(r))
  const peutRediger = estAffecte || can('coordinateur')
  const rapportManquant = souhait.statut === 'realise' && estAffecte && estInfMed && rapports.length === 0

  return (
    <div style={{ padding:'28px 24px', fontFamily:'DM Sans,sans-serif', maxWidth:1000 }}>
      {/* Breadcrumb */}
      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#7A7470', marginBottom:20 }}>
        <Link to="/app/souhaits" style={{ color:'#7A7470', textDecoration:'none' }}>Souhaits</Link>
        <span>›</span>
        <span style={{ color:'#1A1514' }}>{souhait.patient_prenom} {souhait.patient_nom}</span>
      </div>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:14 }}>
        <div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.9rem', fontWeight:500, color:'#1A1514', marginBottom:6 }}>
            {souhait.patient_prenom} {souhait.patient_nom}
          </h1>
          <span style={{ display:'inline-flex', alignItems:'center', padding:'4px 12px', borderRadius:99, background: st.color + '18', color:st.color, fontSize:12.5, fontWeight:600 }}>
            {st.label}
          </span>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {can('souhaits.create') && (
            <Link to={`/app/souhaits/${id}/edit`} style={{ padding:'8px 16px', background:'#FBEAF0', color:'#C8435A', borderRadius:9, fontSize:13.5, fontWeight:600, textDecoration:'none' }}>
              ✏️ Modifier
            </Link>
          )}
          {can('coordinateur') && souhait.statut !== 'renseignements' && (
            <button onClick={() => changeStatut('renseignements')} disabled={updatingStatut} style={{ padding:'8px 14px', background:'#E6F1FB', color:'#185FA5', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
              ❓ Demande de renseignements
            </button>
          )}
        </div>
      </div>

      {/* Stepper du cycle de vie (cliquable par les coordinateurs) */}
      {can('coordinateur') && (
        <StatutStepper statut={souhait.statut} onChange={changeStatut} disabled={updatingStatut} />
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(200,67,90,.1)', marginBottom:24 }}>
        {[['info','ℹ️ Informations'],['timing','🕐 Timing'],['checklist','📋 Check-listes'],['photos','📸 Photos'],['rapport', rapportManquant ? '📝 Rapport ⚠️' : '📝 Rapport']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} style={{ padding:'9px 18px', background:'none', border:'none', borderBottom:`2px solid ${tab===v ? '#C8435A' : 'transparent'}`, color: tab===v ? '#C8435A':'#7A7470', fontWeight: tab===v?600:400, fontSize:13.5, cursor:'pointer', fontFamily:'DM Sans,sans-serif', position:'relative', bottom:-1 }}>
            {l}
          </button>
        ))}
      </div>

      {/* Tab Informations */}
      {tab === 'info' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Carte patient */}
          <InfoCard title="🏥 Patient">
            <Row label="Nom"         val={`${souhait.patient_prenom} ${souhait.patient_nom}`} />
            {souhait.patient_ddn      && <Row label="Naissance"   val={new Date(souhait.patient_ddn).toLocaleDateString('fr-BE')} />}
            {souhait.etablissement    && <Row label="Établ."      val={souhait.etablissement} />}
            {souhait.medecin_referent && <Row label="Médecin réf."val={souhait.medecin_referent} />}
            {souhait.mobilite         && <Row label="Mobilité"    val={souhait.mobilite} />}
            {souhait.equipement_medical && <Row label="Équipement" val={souhait.equipement_medical} />}
            {souhait.allergies        && <Row label="Allergies"   val={souhait.allergies} isAlert />}
          </InfoCard>

          {/* Carte souhait */}
          <InfoCard title="❤️ Souhait">
            <div style={{ fontSize:14, color:'#1A1514', lineHeight:1.7, marginBottom:12, fontStyle:'italic' }}>
              "{souhait.souhait_description}"
            </div>
            {souhait.date_souhait && <Row label="Date"  val={new Date(souhait.date_souhait).toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })} />}
            {souhait.souhait_lieu && <Row label="Lieu"  val={souhait.souhait_lieu} />}
            {souhait.urgence      && <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#FCEBEB', color:'#A32D2D', padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:700, marginTop:8 }}>⚠️ DEMANDE URGENTE</div>}
          </InfoCard>

          {/* Itinéraire : prise en charge & destination + Waze */}
          {(souhait.adresse_prise_en_charge || souhait.adresse_destination || souhait.lieu_destination) && (
            <InfoCard title="🧭 Itinéraire">
              {(souhait.lieu_prise_en_charge || souhait.adresse_prise_en_charge) && (
                <LieuWaze titre="Prise en charge" lieu={souhait.lieu_prise_en_charge} adresse={souhait.adresse_prise_en_charge} lat={souhait.pec_lat} lon={souhait.pec_lon} />
              )}
              {(souhait.lieu_destination || souhait.adresse_destination) && (
                <LieuWaze titre="Destination" lieu={souhait.lieu_destination} adresse={souhait.adresse_destination} lat={souhait.dest_lat} lon={souhait.dest_lon} />
              )}
            </InfoCard>
          )}
          {souhait.sur_plusieurs_jours && (
            <InfoCard title="🏨 Séjour sur plusieurs jours">
              {souhait.date_fin && <Row label="Fin du séjour" val={new Date(souhait.date_fin).toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })} />}
              {souhait.nb_nuits > 0 && <Row label="Nuits" val={`${souhait.nb_nuits} nuit(s)`} />}
              {souhait.adresse_hotel && <Row label="Hôtel" val={souhait.adresse_hotel} />}
            </InfoCard>
          )}

          {/* Carte contact */}
          <InfoCard title="📞 Contact">
            <Row label="Nom"      val={`${souhait.contact_prenom} ${souhait.contact_nom}`} />
            {souhait.contact_relation  && <Row label="Relation" val={souhait.contact_relation} />}
            <Row label="Email"    val={souhait.contact_email} isLink={`mailto:${souhait.contact_email}`} />
            {souhait.contact_telephone && <Row label="Tél."   val={souhait.contact_telephone} isLink={`tel:${souhait.contact_telephone}`} />}
          </InfoCard>

          {/* Affectation par équipage (véhicule + personnel) */}
          <AffectationEquipages
            equipages={souhait.equipages || []}
            personnel={personnel}
            volontaires={volontaires}
            peutAffecter={can('coordinateur')}
            onAffecter={affecterVolontaire}
            onRetirer={retirerVolontaire}
            onVehicule={setVehiculeEquipage}
          />
          {souhait.notes && (
            <InfoCard title="📝 Notes internes">
              <div style={{ background:'#FAEEDA', border:'1px solid rgba(186,117,23,.2)', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#633806' }}>{souhait.notes}</div>
            </InfoCard>
          )}
        </div>
      )}

      {/* Tab Checklistes */}
      {tab === 'timing' && (
        <TimingTab souhait={souhait} peutEditer={can('coordinateur') || can('souhaits.logistique')} onSave={sauverChamps} />
      )}

      {tab === 'checklist' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {[['depart','🚀 Départ',clDepart],['retour','🏠 Retour',clRetour]].map(([type,label,cl]) => (
            <div key={type} style={{ background:'white', border:'1px solid rgba(200,67,90,.09)', borderRadius:14, padding:'20px', boxShadow:'0 1px 8px rgba(200,67,90,.05)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <h3 style={{ fontSize:15, fontWeight:600, color:'#1A1514', margin:0 }}>{label}</h3>
                {!cl
                  ? <button onClick={() => setShowCL(type)} style={{ padding:'6px 14px', background:'linear-gradient(135deg,#C8435A,#D9566A)', color:'white', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>Remplir</button>
                  : <span style={{ fontSize:12, color:'#3B6D11', fontWeight:600 }}>✓ Complétée</span>
                }
              </div>
              {cl ? (
                <div style={{ fontSize:13, color:'#4A4340' }}>
                  <div>Complétée le {new Date(cl.created_at).toLocaleDateString('fr-BE')}</div>
                  <div style={{ marginTop:6 }}>{cl.checklist_reponses?.length || 0} éléments vérifiés</div>
                  {cl.km_aller && <div style={{ marginTop:6 }}>Km aller : {cl.km_aller} km</div>}
                  {cl.km_retour && <div>Km retour : {cl.km_retour} km</div>}
                </div>
              ) : (
                <p style={{ fontSize:13, color:'#7A7470', fontStyle:'italic' }}>Check-liste non encore remplie.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab Photos */}
      {tab === 'photos' && (
        <PhotosTab souhaitId={id} />
      )}

      {tab === 'rapport' && (
        <RapportTab souhaitId={id} rapports={rapports} peutRediger={peutRediger} profile={profile} onSaved={load} rappel={rapportManquant} />
      )}

      {/* Modal checklist */}
      {showCL && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, overflow:'auto', padding:'20px' }}>
          <div style={{ background:'white', borderRadius:18, maxWidth:700, margin:'0 auto', padding:'24px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:600 }}>Check-liste {showCL === 'depart' ? 'Départ 🚀' : 'Retour 🏠'}</h3>
              <button onClick={() => setShowCL(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#7A7470' }}>✕</button>
            </div>
            <ChecklistForm souhaitId={id} type={showCL} onComplete={() => { setShowCL(null); load() }} />
          </div>
        </div>
      )}

      <style>{`@media(max-width:800px){ [style*='grid-template-columns: 1fr 1fr']{grid-template-columns:1fr !important;} }`}</style>
    </div>
  )
}

function RapportTab({ souhaitId, rapports, peutRediger, profile, onSaved, rappel }) {
  const [form, setForm] = useState({ deroulement:'', etat_patient:'', incidents:'', observations:'' })
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  async function enregistrer() {
    if (!form.deroulement.trim()) return
    setSaving(true)
    await supabase.from('souhait_rapports').insert({
      souhait_id: souhaitId,
      profile_id: profile?.id,
      auteur_nom: `${profile?.prenom||''} ${profile?.nom||''}`.trim(),
      role_auteur: profile?.role || null,
      deroulement: form.deroulement,
      etat_patient: form.etat_patient || null,
      incidents: form.incidents || null,
      observations: form.observations || null,
    })
    setSaving(false); setOpen(false)
    setForm({ deroulement:'', etat_patient:'', incidents:'', observations:'' })
    onSaved && onSaved()
  }

  const TA = { width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.12)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif', resize:'vertical', marginBottom:10 }
  const L = { fontSize:12.5, fontWeight:600, color:'#0E4A5A', display:'block', marginBottom:4 }

  return (
    <div style={{ maxWidth:760 }}>
      {rappel && (
        <div style={{ background:'#FCEBEB', border:'1px solid #F0C9C9', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13.5, color:'#A32D2D' }}>
          ⚠️ Ce souhait est réalisé : un rapport de réalisation est attendu de votre part (infirmier/médecin).
        </div>
      )}

      {/* Rapports existants */}
      {rapports.length === 0 ? (
        <div style={{ fontSize:13.5, color:'#A8A39D', marginBottom:16 }}>Aucun rapport pour le moment.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:18 }}>
          {rapports.map(r => (
            <div key={r.id} style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:13.5, fontWeight:600, color:'#0E4A5A' }}>{r.auteur_nom} {r.role_auteur ? `· ${r.role_auteur.replace(/_/g,' ')}` : ''}</span>
                <span style={{ fontSize:12, color:'#A8A39D' }}>{new Date(r.created_at).toLocaleString('fr-BE')}</span>
              </div>
              {r.deroulement  && <RapLigne label="Déroulement"   val={r.deroulement} />}
              {r.etat_patient && <RapLigne label="État du patient" val={r.etat_patient} />}
              {r.incidents    && <RapLigne label="Incidents"      val={r.incidents} alert />}
              {r.observations && <RapLigne label="Observations"   val={r.observations} />}
            </div>
          ))}
        </div>
      )}

      {/* Formulaire (uniquement personnel affecté ou coordinateur) */}
      {peutRediger && (
        open ? (
          <div style={{ background:'white', border:'1px solid rgba(27,176,206,.15)', borderRadius:12, padding:'16px 18px' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'#0E4A5A', marginBottom:12 }}>Nouveau rapport</div>
            <label style={L}>Déroulement de la sortie *</label>
            <textarea rows={4} value={form.deroulement} onChange={e=>setForm(f=>({...f,deroulement:e.target.value}))} style={TA} placeholder="Résumé du déroulement de la réalisation du souhait…" />
            <label style={L}>État du patient</label>
            <textarea rows={2} value={form.etat_patient} onChange={e=>setForm(f=>({...f,etat_patient:e.target.value}))} style={TA} placeholder="État général, évolution durant la sortie…" />
            <label style={L}>Incidents éventuels</label>
            <textarea rows={2} value={form.incidents} onChange={e=>setForm(f=>({...f,incidents:e.target.value}))} style={TA} placeholder="Incidents médicaux ou techniques (laisser vide si aucun)…" />
            <label style={L}>Observations / recommandations</label>
            <textarea rows={2} value={form.observations} onChange={e=>setForm(f=>({...f,observations:e.target.value}))} style={TA} />
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setOpen(false)} style={{ padding:'8px 16px', background:'none', border:'1px solid rgba(0,0,0,.15)', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>Annuler</button>
              <button onClick={enregistrer} disabled={saving||!form.deroulement.trim()} style={{ padding:'8px 18px', background:'#1BB0CE', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: form.deroulement.trim()?'pointer':'not-allowed', opacity: form.deroulement.trim()?1:.5, fontFamily:'DM Sans,sans-serif' }}>{saving?'…':'✓ Enregistrer le rapport'}</button>
            </div>
          </div>
        ) : (
          <button onClick={()=>setOpen(true)} style={{ padding:'10px 18px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>📝 Rédiger un rapport</button>
        )
      )}
    </div>
  )
}

function RapLigne({ label, val, alert }) {
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ fontSize:11.5, fontWeight:600, color: alert ? '#A32D2D' : '#7A7470', textTransform:'uppercase', letterSpacing:.3 }}>{label}</div>
      <div style={{ fontSize:13.5, color: alert ? '#A32D2D' : '#1A1514', whiteSpace:'pre-wrap', lineHeight:1.5 }}>{val}</div>
    </div>
  )
}

function TimingTab({ souhait, peutEditer, onSave }) {
  const toLocal = (v) => v ? new Date(v).toISOString().slice(0,16) : ''
  const [edit, setEdit] = useState(false)
  const [f, setF] = useState({
    base_depart: souhait.base_depart || '',
    rdv_base: toLocal(souhait.rdv_base),
    depart_base: toLocal(souhait.depart_base),
    arrivee_pec: toLocal(souhait.arrivee_pec),
    depart_pec: toLocal(souhait.depart_pec),
    arrivee_destination: toLocal(souhait.arrivee_destination),
  })
  const [planning, setPlanning] = useState(souhait.planning_particulier || [])
  const [saving, setSaving] = useState(false)

  async function sauver() {
    setSaving(true)
    const champs = {
      base_depart: f.base_depart || null,
      rdv_base: f.rdv_base || null,
      depart_base: f.depart_base || null,
      arrivee_pec: f.arrivee_pec || null,
      depart_pec: f.depart_pec || null,
      arrivee_destination: f.arrivee_destination || null,
      planning_particulier: planning,
    }
    const ok = await onSave(champs)
    setSaving(false)
    if (ok) setEdit(false)
  }

  const fmt = (v) => v ? new Date(v).toLocaleString('fr-BE', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'
  const L = { fontSize:12.5, fontWeight:600, color:'#0E4A5A', display:'block', marginBottom:4 }
  const IN = { width:'100%', padding:'8px 10px', border:'1px solid rgba(0,0,0,.12)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif' }

  if (!edit) {
    return (
      <div style={{ maxWidth:820 }}>
        {peutEditer && (
          <div style={{ textAlign:'right', marginBottom:12 }}>
            <button onClick={()=>setEdit(true)} style={{ padding:'7px 14px', background:'#FBEAF0', color:'#C8435A', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>✏️ Modifier le timing</button>
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <InfoCard title="🏁 Base de départ">
            <Row label="Base départ"  val={souhait.base_depart || '—'} />
            <Row label="RDV base"      val={fmt(souhait.rdv_base)} />
            <Row label="Départ base"   val={fmt(souhait.depart_base)} />
          </InfoCard>
          <InfoCard title="🚑 Prise en charge & destination">
            <Row label="Arrivée lieu PEC"    val={fmt(souhait.arrivee_pec)} />
            <Row label="Départ lieu PEC"      val={fmt(souhait.depart_pec)} />
            <Row label="Arrivée destination"  val={fmt(souhait.arrivee_destination)} />
          </InfoCard>
        </div>
        {(planning && planning.length > 0) && (
          <div style={{ marginTop:18 }}>
            <InfoCard title="📋 Planning particulier">
              {planning.map((p,i)=>(
                <div key={i} style={{ display:'flex', gap:12, padding:'6px 0', borderBottom:'1px solid rgba(0,0,0,.05)' }}>
                  <span style={{ fontWeight:600, color:'#0E7A93', minWidth:60 }}>{p.heure||''}</span>
                  <span style={{ color:'#1A1514' }}>{p.libelle||''}</span>
                </div>
              ))}
            </InfoCard>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth:820 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
        <div style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:12, padding:'16px 18px' }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:'#0E4A5A', marginBottom:12 }}>🏁 Base de départ</div>
          <label style={L}>Base de départ</label>
          <input style={{ ...IN, marginBottom:10 }} value={f.base_depart} onChange={e=>setF(x=>({...x,base_depart:e.target.value}))} placeholder="Ex. Solumob Jemeppe/Meuse" />
          <label style={L}>RDV base</label>
          <input type="datetime-local" style={{ ...IN, marginBottom:10 }} value={f.rdv_base} onChange={e=>setF(x=>({...x,rdv_base:e.target.value}))} />
          <label style={L}>Départ base</label>
          <input type="datetime-local" style={IN} value={f.depart_base} onChange={e=>setF(x=>({...x,depart_base:e.target.value}))} />
        </div>
        <div style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:12, padding:'16px 18px' }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:'#0E4A5A', marginBottom:12 }}>🚑 PEC & destination</div>
          <label style={L}>Arrivée lieu PEC</label>
          <input type="datetime-local" style={{ ...IN, marginBottom:10 }} value={f.arrivee_pec} onChange={e=>setF(x=>({...x,arrivee_pec:e.target.value}))} />
          <label style={L}>Départ lieu PEC</label>
          <input type="datetime-local" style={{ ...IN, marginBottom:10 }} value={f.depart_pec} onChange={e=>setF(x=>({...x,depart_pec:e.target.value}))} />
          <label style={L}>Arrivée destination</label>
          <input type="datetime-local" style={IN} value={f.arrivee_destination} onChange={e=>setF(x=>({...x,arrivee_destination:e.target.value}))} />
        </div>
      </div>

      {/* Planning particulier */}
      <div style={{ marginTop:18, background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:12, padding:'16px 18px' }}>
        <div style={{ fontSize:13.5, fontWeight:600, color:'#0E4A5A', marginBottom:12 }}>📋 Planning particulier</div>
        {planning.map((p,i)=>(
          <div key={i} style={{ display:'flex', gap:8, marginBottom:8 }}>
            <input style={{ ...IN, maxWidth:110 }} value={p.heure||''} onChange={e=>setPlanning(pl=>pl.map((x,j)=>j===i?{...x,heure:e.target.value}:x))} placeholder="10h30" />
            <input style={IN} value={p.libelle||''} onChange={e=>setPlanning(pl=>pl.map((x,j)=>j===i?{...x,libelle:e.target.value}:x))} placeholder="Activité…" />
            <button onClick={()=>setPlanning(pl=>pl.filter((_,j)=>j!==i))} style={{ padding:'6px 9px', background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:7, cursor:'pointer' }}>✕</button>
          </div>
        ))}
        <button onClick={()=>setPlanning(pl=>[...pl,{heure:'',libelle:''}])} style={{ padding:'6px 12px', background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>+ Ajouter une ligne</button>
      </div>

      <div style={{ display:'flex', gap:8, marginTop:16 }}>
        <button onClick={()=>setEdit(false)} style={{ padding:'8px 16px', background:'none', border:'1px solid rgba(0,0,0,.15)', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>Annuler</button>
        <button onClick={sauver} disabled={saving} style={{ padding:'8px 18px', background:'#1BB0CE', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>{saving?'…':'✓ Enregistrer'}</button>
      </div>
    </div>
  )
}

function StatutStepper({ statut, onChange, disabled }) {
  const idxCourant = STATUTS_FLUX.findIndex(s => s.key === statut)
  const renseignements = statut === 'renseignements'
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
        {STATUTS_FLUX.map((s, i) => {
          const atteint = idxCourant >= 0 && i <= idxCourant
          const courant = s.key === statut
          return (
            <button key={s.key} onClick={() => !disabled && onChange(s.key)} disabled={disabled}
              title={s.desc}
              style={{
                position:'relative', padding:'7px 14px 7px 16px',
                background: courant ? s.color : atteint ? s.color+'22' : '#F4F3F1',
                color: courant ? 'white' : atteint ? s.color : '#A8A39D',
                border:'none', fontSize:12, fontWeight: courant?700:600, cursor: disabled?'default':'pointer',
                fontFamily:'DM Sans,sans-serif',
                clipPath:'polygon(0 0, calc(100% - 9px) 0, 100% 50%, calc(100% - 9px) 100%, 0 100%, 9px 50%)',
                marginLeft: i===0 ? 0 : -2,
              }}>
              {i+1}. {s.court}
            </button>
          )
        })}
      </div>
      {renseignements && (
        <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:8, background:'#E6F1FB', color:'#185FA5', padding:'6px 12px', borderRadius:8, fontSize:12.5, fontWeight:600 }}>
          ❓ En demande de renseignements
          <button onClick={() => onChange('attente_rencontre')} style={{ background:'white', border:'none', borderRadius:6, padding:'2px 8px', fontSize:11.5, color:'#185FA5', cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>Reprendre le flux</button>
        </div>
      )}
    </div>
  )
}

function LieuWaze({ titre, lieu, adresse, lat, lon }) {
  const wazeUrl = (lat && lon)
    ? `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(adresse || lieu || '')}&navigate=yes`
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, padding:'8px 0', borderBottom:'1px solid rgba(0,0,0,.04)' }}>
      <div>
        <div style={{ fontSize:11.5, fontWeight:600, color:'#7A7470', textTransform:'uppercase', letterSpacing:.3 }}>{titre}</div>
        {lieu && <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1514' }}>{lieu}</div>}
        {adresse && <div style={{ fontSize:12.5, color:'#4A4340' }}>{adresse}</div>}
      </div>
      <a href={wazeUrl} target="_blank" rel="noreferrer"
        style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 13px', background:'#33CCFF', color:'#062B45', borderRadius:9, fontSize:12.5, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap', flexShrink:0 }}>
        ▸ Waze
      </a>
    </div>
  )
}

// ── Affectation par équipage : véhicule + personnel ───────────────────────────
function AffectationEquipages({ equipages, personnel, volontaires, peutAffecter, onAffecter, onRetirer, onVehicule }) {
  // Besoins par équipage
  function besoin(eq) {
    if (eq.type === 'logistique') return { min: 1, txt: '1 conducteur' }
    const base = 2 + (eq.longue_route ? 1 : 0)
    return { min: base, txt: `${base} médicaux dont 1 chauffeur` + (eq.longue_route ? ' (+1 longue route)' : '') }
  }
  const sansEquipage = personnel.filter(p => !p.equipage_id)

  return (
    <InfoCard title="🚑 Affectation des équipages">
      {equipages.length === 0 && (
        <p style={{ fontSize:13, color:'#A8A39D', fontStyle:'italic', marginBottom:10 }}>
          Aucun équipage défini. Définissez les équipages dans le formulaire du souhait (étape Logistique) pour affecter véhicules et personnel.
        </p>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {equipages.map((eq, i) => {
          const b = besoin(eq)
          const membres = personnel.filter(p => p.equipage_id === eq.id)
          const complet = membres.length >= b.min
          const titre = eq.type === 'logistique' ? `🚐 Véhicule logistique ${i+1}` : `🚑 Ambulance ${i+1}${eq.mode==='paramedicalise'?' — paramédicalisé':' — normalisé'}`
          return (
            <EquipageCard key={eq.id} eq={eq} titre={titre} besoin={b} complet={complet}
              membres={membres} volontaires={volontaires} personnel={personnel}
              peutAffecter={peutAffecter} onAffecter={onAffecter} onRetirer={onRetirer} onVehicule={onVehicule} />
          )
        })}
      </div>

      {/* Personnel affecté sans équipage (compat / cas simples) */}
      {sansEquipage.length > 0 && (
        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#7A7470', marginBottom:6 }}>Autres affectés</div>
          {sansEquipage.map(p => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div style={{ flex:1, fontSize:13.5, color:'#1A1514' }}>{p.profiles?.prenom} {p.profiles?.nom} <span style={{ color:'#7A7470', fontSize:12 }}>· {p.profiles?.role?.replace(/_/g,' ')}</span></div>
              {peutAffecter && <button onClick={()=>onRetirer(p.id)} style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:7, padding:'3px 8px', fontSize:12, cursor:'pointer' }}>✕</button>}
            </div>
          ))}
        </div>
      )}
    </InfoCard>
  )
}

function EquipageCard({ eq, titre, besoin, complet, membres, volontaires, personnel, peutAffecter, onAffecter, onRetirer, onVehicule }) {
  const [sel, setSel] = useState('')
  const [plaque, setPlaque] = useState(eq.immatriculation || '')
  useEffect(() => { setPlaque(eq.immatriculation || '') }, [eq.immatriculation])

  const dispo = volontaires.filter(v => !personnel.some(p => p.user_id === v.id))

  return (
    <div style={{ border:`1px solid ${complet ? 'rgba(59,109,17,.25)' : 'rgba(200,67,90,.2)'}`, borderRadius:12, padding:'13px 15px', background: complet ? '#F6FBF1' : '#FFF8F9' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:13.5, fontWeight:700, color:'#1A1514' }}>{titre}</span>
        <span style={{ fontSize:11.5, fontWeight:600, padding:'2px 9px', borderRadius:99, background: complet ? '#EAF3DE' : '#FCEBEB', color: complet ? '#3B6D11' : '#A32D2D' }}>
          {membres.length}/{besoin.min} · {complet ? 'complet' : 'incomplet'}
        </span>
      </div>
      <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:10 }}>Besoin : {besoin.txt}</div>

      {/* Véhicule */}
      <div style={{ marginBottom:10 }}>
        <label style={{ fontSize:11.5, fontWeight:600, color:'#7A7470', display:'block', marginBottom:3 }}>Véhicule (immatriculation)</label>
        <input value={plaque} disabled={!peutAffecter}
          onChange={e=>setPlaque(e.target.value)} onBlur={()=>plaque!==(eq.immatriculation||'') && onVehicule(eq.id, plaque)}
          placeholder="1-ABC-234" style={{ width:'100%', padding:'7px 10px', border:'1px solid rgba(0,0,0,.12)', borderRadius:7, fontSize:13, fontFamily:'monospace' }} />
      </div>

      {/* Membres */}
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom: peutAffecter ? 10 : 0 }}>
        {membres.length === 0 && <span style={{ fontSize:12.5, color:'#A8A39D', fontStyle:'italic' }}>Aucun volontaire affecté.</span>}
        {membres.map(p => (
          <div key={p.id} style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#FBEAF0,#F7C1C1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#C8435A', flexShrink:0 }}>
              {(p.profiles?.prenom?.[0]||'')+(p.profiles?.nom?.[0]||'')}
            </div>
            <div style={{ flex:1, fontSize:13, color:'#1A1514' }}>{p.profiles?.prenom} {p.profiles?.nom} <span style={{ color:'#7A7470', fontSize:11.5 }}>· {p.profiles?.role?.replace(/_/g,' ')}</span></div>
            {peutAffecter && <button onClick={()=>onRetirer(p.id)} style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'2px 7px', fontSize:11.5, cursor:'pointer' }}>✕</button>}
          </div>
        ))}
      </div>

      {/* Ajouter */}
      {peutAffecter && (
        <div style={{ display:'flex', gap:7 }}>
          <select value={sel} onChange={e=>setSel(e.target.value)} style={{ flex:1, padding:'7px 9px', border:'1px solid rgba(0,0,0,.12)', borderRadius:7, fontSize:12.5, fontFamily:'DM Sans,sans-serif' }}>
            <option value="">+ Affecter un volontaire…</option>
            {dispo.map(v => <option key={v.id} value={v.id}>{v.prenom} {v.nom}{v.role?` — ${v.role.replace(/_/g,' ')}`:''}</option>)}
          </select>
          <button onClick={()=>{ onAffecter(sel, eq.id); setSel('') }} disabled={!sel} style={{ padding:'7px 12px', background:'#C8435A', color:'white', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:sel?'pointer':'not-allowed', opacity:sel?1:.5, fontFamily:'DM Sans,sans-serif' }}>Affecter</button>
        </div>
      )}
    </div>
  )
}

function InfoCard({ title, children }) {
  return (
    <div style={{ background:'white', border:'1px solid rgba(200,67,90,.09)', borderRadius:14, padding:'20px', boxShadow:'0 1px 8px rgba(200,67,90,.05)' }}>
      <h3 style={{ fontSize:14, fontWeight:600, color:'#1A1514', marginBottom:14, paddingBottom:10, borderBottom:'1px solid rgba(200,67,90,.08)' }}>{title}</h3>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{children}</div>
    </div>
  )
}
function Row({ label, val, isLink, isAlert }) {
  return (
    <div style={{ display:'flex', gap:8, fontSize:13.5 }}>
      <span style={{ color:'#7A7470', minWidth:90, flexShrink:0 }}>{label}</span>
      {isLink
        ? <a href={isLink} style={{ color:'#C8435A', fontWeight:500, textDecoration:'none' }}>{val}</a>
        : <span style={{ color: isAlert ? '#A32D2D' : '#1A1514', fontWeight: isAlert ? 600 : 400 }}>{val}</span>
      }
    </div>
  )
}

function PhotosTab({ souhaitId }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('checklist_photos').select('*').eq('souhait_id', souhaitId)
      .then(({ data }) => { setPhotos(data || []); setLoading(false) })
  }, [souhaitId])
  if (loading) return <p style={{ color:'#7A7470', fontSize:14 }}>Chargement…</p>
  if (!photos.length) return <p style={{ color:'#7A7470', fontSize:14, fontStyle:'italic' }}>Aucune photo enregistrée pour ce souhait.</p>
  return (
    <div style={{ columns:'3 200px', gap:12 }}>
      {photos.map((p, i) => (
        <div key={i} style={{ marginBottom:12, borderRadius:10, overflow:'hidden', lineHeight:0 }}>
          <img src={p.url} alt="" style={{ width:'100%', display:'block', objectFit:'cover' }} />
        </div>
      ))}
    </div>
  )
}