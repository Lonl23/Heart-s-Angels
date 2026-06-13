// src/modules/souhaits/DetailSouhait.jsx
import { useState, useEffect, useRef } from 'react'
import Tesseract from 'tesseract.js'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { STATUT_MAP as STATUTS, STATUTS_FLUX, statutInfo } from '@/lib/souhaitStatuts'

export default function DetailSouhait() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { profile, can, souhaitsAccess } = useAuth()
  const [souhait, setSouhait]   = useState(null)
  const [personnel, setPersonnel] = useState([])
  const [checklists, setChecklists] = useState([])
  const [rapports, setRapports]   = useState([])
  const [volontaires, setVolontaires] = useState([])
  const [dispos, setDispos]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('info')   // 'info'|'checklist'|'photos'|'rapport'
  const [updatingStatut, setUpdatingStatut] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const [{ data: s }, { data: p }, { data: cl }, { data: rap }, { data: vol }, { data: disp }] = await Promise.all([
      supabase.from('souhaits').select('*').eq('id', id).single(),
      supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role,email,selection_medicale)').eq('souhait_id', id),
      supabase.from('checklists').select('*, checklist_reponses(*)').eq('souhait_id', id),
      supabase.from('souhait_rapports').select('*').eq('souhait_id', id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,prenom,nom,role,selection_medicale').order('nom'),
      supabase.from('disponibilites').select('user_id,date_debut,date_fin'),
    ])
    setSouhait(s); setPersonnel(p || []); setChecklists(cl || []); setRapports(rap || []); setVolontaires(vol || [])
    setDispos(disp || [])
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

  // Verrou d'accès
  const acces = souhaitsAccess()
  const suisAffecte = personnel.some(p => p.user_id === profile?.id)
  // « Prêt à réaliser » ou après dans le pipeline
  const idxPret = STATUTS_FLUX.findIndex(s => s.key === 'pret')
  const idxCourant = STATUTS_FLUX.findIndex(s => s.key === souhait.statut)
  const estPret = idxCourant >= 0 && idxPret >= 0 && idxCourant >= idxPret

  const Bloc = ({ children }) => (
    <div style={{ padding:'40px 28px', fontFamily:'DM Sans,sans-serif', maxWidth:600 }}>
      <Link to="/app/souhaits" style={{ color:'#7A7470', textDecoration:'none', fontSize:13 }}>← Retour</Link>
      <div style={{ textAlign:'center', padding:'40px 0', color:'#7A7470' }}>
        <div style={{ fontSize:'2rem', marginBottom:10 }}>🔒</div>
        <p style={{ fontSize:14.5 }}>{children}</p>
      </div>
    </div>
  )

  // Ni récolteur/coordinateur, ni affecté → pas d'accès
  if (acces === 'none' || (acces === 'affecte' && !suisAffecte)) {
    return <Bloc>Vous n'êtes pas affecté à ce souhait. Son contenu n'est accessible qu'à l'équipage affecté et aux coordinateurs.</Bloc>
  }
  // Équipage affecté : la fiche n'est consultable qu'à partir de « Prêt à réaliser »
  if (acces === 'affecte' && suisAffecte && !estPret) {
    return <Bloc>Les détails de ce souhait seront disponibles dès qu'il sera <strong>prêt à être réalisé</strong>. Il est encore en préparation par les coordinateurs.</Bloc>
  }

  const st = statutInfo(souhait.statut)
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
        {[['info','ℹ️ Informations'],['timing','🕐 Timing'],['medical','🏥 Médical'],['logistique','🧰 Logistique'],['checklist','📋 Check-listes'],['photos','📸 Photos'],['rapport', rapportManquant ? '📝 Rapport ⚠️' : '📝 Rapport']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} style={{ padding:'9px 18px', background:'none', border:'none', borderBottom:`2px solid ${tab===v ? '#C8435A' : 'transparent'}`, color: tab===v ? '#C8435A':'#7A7470', fontWeight: tab===v?600:400, fontSize:13.5, cursor:'pointer', fontFamily:'DM Sans,sans-serif', position:'relative', bottom:-1 }}>
            {l}
          </button>
        ))}
      </div>

      {/* Tab Informations */}
      {tab === 'info' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
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
          {(souhait.adresse_prise_en_charge || souhait.adresse_destination || souhait.lieu_destination || souhait.lieu_prise_en_charge) && (
            <InfoCard title="🧭 Itinéraire">
              {(souhait.lieu_prise_en_charge || souhait.adresse_prise_en_charge) && (
                <LieuWaze titre={souhait.pec_domicile ? 'Prise en charge — Domicile' : 'Prise en charge'} lieu={souhait.lieu_prise_en_charge} adresse={souhait.adresse_prise_en_charge} precisions={souhait.pec_precisions} route={souhait.pec_route} chambre={souhait.pec_numero_chambre} lat={souhait.pec_lat} lon={souhait.pec_lon} />
              )}
              {(souhait.lieu_destination || souhait.adresse_destination) && (
                <LieuWaze titre="Destination" lieu={souhait.lieu_destination} adresse={souhait.adresse_destination} precisions={souhait.dest_precisions} repere={souhait.dest_adresse_particuliere} lat={souhait.dest_lat} lon={souhait.dest_lon} />
              )}
            </InfoCard>
          )}
          {souhait.sur_plusieurs_jours && (
            <InfoCard title="🏨 Séjour sur plusieurs jours">
              {souhait.date_fin && <Row label="Fin du séjour" val={new Date(souhait.date_fin).toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })} />}
              {(souhait.hotels||[]).map((h,i)=>(
                <div key={h.id||i} style={{ background:'#FFFBF3', border:'1px solid rgba(186,117,23,.18)', borderRadius:9, padding:'10px 12px', marginTop:8 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1514' }}>🏨 {h.nom || `Hôtel ${i+1}`}</div>
                  {h.adresse && <div style={{ fontSize:12.5, color:'#4A4340', marginTop:2 }}>{h.adresse}</div>}
                  <div style={{ fontSize:12, color:'#7A7470', marginTop:3 }}>
                    {h.date_arrivee && `Du ${new Date(h.date_arrivee).toLocaleDateString('fr-BE')}`}
                    {h.date_depart && ` au ${new Date(h.date_depart).toLocaleDateString('fr-BE')}`}
                    {h.nb_nuits ? ` · ${h.nb_nuits} nuit(s)` : ''}
                  </div>
                  {h.confirmation_url && <a href={h.confirmation_url} target="_blank" rel="noreferrer" style={{ display:'inline-block', marginTop:6, fontSize:12.5, color:'#0E7A93', fontWeight:600, textDecoration:'none' }}>📄 {h.confirmation_nom || 'Confirmation PDF'}</a>}
                </div>
              ))}
              {/* Compat ancien format */}
              {(!souhait.hotels || souhait.hotels.length === 0) && souhait.adresse_hotel && <Row label="Hôtel" val={souhait.adresse_hotel} />}
            </InfoCard>
          )}

          {/* Carte contact */}
          <InfoCard title="📞 Contact">
            <Row label="Nom"      val={`${souhait.contact_prenom} ${souhait.contact_nom}`} />
            {souhait.contact_relation  && <Row label="Relation" val={souhait.contact_relation} />}
            <Row label="Email"    val={souhait.contact_email} isLink={`mailto:${souhait.contact_email}`} />
            {souhait.contact_telephone && <Row label="Tél."   val={souhait.contact_telephone} isLink={`tel:${souhait.contact_telephone}`} />}
          </InfoCard>

          {/* Affectation par équipage — lecture seule (modification dans le formulaire) */}
          {souhait.notes && (
            <InfoCard title="📝 Notes internes">
              <div style={{ background:'#FAEEDA', border:'1px solid rgba(186,117,23,.2)', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#633806' }}>{souhait.notes}</div>
            </InfoCard>
          )}
        </div>
      )}

      {/* Tab Checklistes */}
      {tab === 'timing' && (
        <TimingTab souhait={souhait} peutEditer={false} onSave={sauverChamps} />
      )}

      {tab === 'medical' && <MedicalTab souhait={souhait} peutEditer={can('coordinateur') || personnel.some(p=>p.user_id===profile?.id)} peutPlan={false} onSave={sauverChamps} />}

      {tab === 'logistique' && (
        <div style={{ maxWidth:920 }}>
          <EquipagesReadOnly equipages={souhait.equipages || []} personnel={personnel} />
        </div>
      )}

      {tab === 'checklist' && (
        <RapportLogistiqueTab souhait={souhait} peutEditer={can('coordinateur') || personnel.some(p=>p.user_id===profile?.id)} onSave={sauverChamps} />
      )}

      {/* Tab Photos */}
      {tab === 'photos' && (
        <PhotosTab souhaitId={id} />
      )}

      {tab === 'rapport' && (
        <RapportTab souhaitId={id} rapports={rapports} peutRediger={peutRediger} profile={profile} onSaved={load} rappel={rapportManquant} />
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

function MedicalTab({ souhait, peutEditer, peutPlan, onSave }) {
  const s = souhait
  const has = (...keys) => keys.some(k => s[k])
  const [sub, setSub] = useState('contacts')

  const SOUS = [
    ['contacts', '👨‍⚕️ Contacts'],
    ['infos', '🩺 Infos médicales'],
    ['traitements', '💊 Traitements'],
    ['rapport', '📝 Rapport médical'],
  ]

  return (
    <div style={{ maxWidth:920 }}>
      {/* Sous-onglets */}
      <div style={{ display:'flex', gap:4, marginBottom:18, flexWrap:'wrap' }}>
        {SOUS.map(([k,l]) => (
          <button key={k} onClick={()=>setSub(k)}
            style={{ padding:'7px 14px', borderRadius:99, border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
              background: sub===k ? '#0E4A5A' : '#F0F4F5', color: sub===k ? 'white' : '#5A6A6E', fontWeight: sub===k?600:500, fontSize:12.5 }}>
            {l}
          </button>
        ))}
      </div>

      {sub === 'contacts' && (
        <InfoCard title="👨‍⚕️ Contacts médicaux">
          {s.medecin_referent && <Row label="Médecin référent" val={s.medecin_referent} />}
          {s.medecin_traitant && <Row label="Médecin traitant" val={s.medecin_traitant} />}
          {s.telephone_medecin && <Row label="Tél. médecin" val={s.telephone_medecin} isLink={`tel:${s.telephone_medecin}`} />}
          {s.medecin_garde && <Row label="Médecin de garde" val={s.medecin_garde} />}
          {(s.infirmiers || s.infirmier_referent_etablissement) && <Row label="Infirmiers" val={s.infirmiers || s.infirmier_referent_etablissement} />}
          {s.kine && <Row label="Kiné" val={s.kine} />}
          {s.deuxieme_ligne && <Row label="2ᵉ ligne" val={s.deuxieme_ligne} />}
          {!has('medecin_referent','medecin_traitant','medecin_garde','infirmiers','kine','deuxieme_ligne','telephone_medecin','infirmier_referent_etablissement') && <Vide />}
        </InfoCard>
      )}

      {sub === 'infos' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
          <InfoCard title="🩺 Informations médicales">
            {s.ne_pas_reanimer && <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#FCEBEB', color:'#A32D2D', padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:700, marginBottom:8 }}>⚕️ NE PAS RÉANIMER</div>}
            {s.details_acharnement && <Row label="Acharnement" val={s.details_acharnement} />}
            {s.allergies_medicaments && <Row label="Allergies" val={s.allergies_medicaments} />}
            {s.pathologies && <Row label="Pathologies" val={s.pathologies} />}
            {s.antecedents && <Row label="Antécédents" val={s.antecedents} />}
            {s.douleurs && <Row label="Douleurs" val={s.douleurs} />}
            {s.voie_acces && <Row label="Voie d'accès" val={s.voie_acces} />}
            {s.mobilisations && <Row label="Mobilisations" val={s.mobilisations} />}
            {s.communication && <Row label="Communication" val={s.communication} />}
            {!has('ne_pas_reanimer','details_acharnement','allergies_medicaments','pathologies','antecedents','douleurs','voie_acces','mobilisations','communication') && <Vide />}
          </InfoCard>

          <InfoCard title="📊 Paramètres">
            {s.cible_saturation_o2 && <Row label="Cible saturation O2" val={s.cible_saturation_o2} />}
            {s.debit_o2 && <Row label="Débit O2" val={s.debit_o2} />}
            {s.apport_o2 && <Row label="Apport O2" val={s.apport_o2} />}
            {s.cible_ta && <Row label="Cible TA" val={s.cible_ta} />}
            {s.cible_fc && <Row label="Cible FC" val={s.cible_fc} />}
            {!has('cible_saturation_o2','debit_o2','apport_o2','cible_ta','cible_fc') && <Vide />}
          </InfoCard>

          <InfoCard title="🍽️ Déglutition · alimentation · continences">
            {s.deglutition && <Row label="Déglutition" val={s.deglutition} />}
            {s.alimentation && <Row label="Alimentation" val={s.alimentation} />}
            {s.continence_urinaire && <Row label="Continence urinaire" val={s.continence_urinaire} />}
            {s.continence_fecale && <Row label="Continence fécale" val={s.continence_fecale} />}
            {s.precisions_continences && <Row label="Précisions" val={s.precisions_continences} />}
            {!has('deglutition','alimentation','continence_urinaire','continence_fecale','precisions_continences') && <Vide />}
          </InfoCard>
        </div>
      )}

      {sub === 'traitements' && (
        <InfoCard title="💊 Feuille de traitement">
          <TraitementsSection souhait={s} peutPlan={peutPlan} peutCocher={peutEditer} onSave={onSave} />
        </InfoCard>
      )}

      {sub === 'rapport' && (
        <InfoCard title="📝 Rapport médical">
          <LignesEditor lignes={s.rapport_medical||[]} peutEditer={peutEditer}
            onSave={(l)=>onSave({ rapport_medical:l })} placeholder="Observation, horaire, soin administré…" accent="#C8435A" bg="#FBEAF0" />
        </InfoCard>
      )}
    </div>
  )
}

// Éditeur de lignes de texte (liste ordonnée, ajout/édition/suppression)
function LignesEditor({ lignes, onSave, peutEditer, placeholder, accent='#0E7A93', bg='#F0F9FB' }) {
  const [items, setItems] = useState(lignes)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setItems(lignes); setDirty(false) }, [lignes])

  function maj(i, v) { setItems(it => it.map((x,j)=>j===i?v:x)); setDirty(true) }
  function ajouter() { setItems(it => [...it, '']); setDirty(true) }
  function retirer(i) { setItems(it => it.filter((_,j)=>j!==i)); setDirty(true) }

  async function enregistrer() {
    setSaving(true)
    await onSave(items.filter(x => (x||'').trim() !== ''))
    setSaving(false); setDirty(false)
  }

  if (!peutEditer) {
    return items.length === 0 ? <Vide /> : (
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {items.map((x,i)=>(
          <div key={i} style={{ display:'flex', gap:9, fontSize:13.5, color:'#1A1514', lineHeight:1.5 }}>
            <span style={{ color:accent, fontWeight:700 }}>•</span><span>{x}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {items.map((x,i)=>(
          <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
            <textarea value={x} onChange={e=>maj(i,e.target.value)} rows={1} placeholder={placeholder}
              style={{ flex:1, padding:'8px 11px', border:'1px solid rgba(0,0,0,.12)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical', background:bg }} />
            <button onClick={()=>retirer(i)} style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:7, padding:'6px 9px', fontSize:12.5, cursor:'pointer', flexShrink:0 }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:10 }}>
        <button onClick={ajouter} style={{ padding:'7px 13px', background:bg, color:accent, border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>+ Ajouter une ligne</button>
        {dirty && <button onClick={enregistrer} disabled={saving} style={{ padding:'7px 16px', background:'#1BB0CE', color:'white', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>{saving?'…':'✓ Enregistrer'}</button>}
      </div>
    </div>
  )
}

// ── Feuille de traitement (façon hôpital) ─────────────────────────────────────
const VOIES = [
  ['PO','PO (per os)'], ['SL','Sublingual'], ['IV','IV'], ['SC','SC'], ['IM','IM'],
  ['inhalation','Inhalation'], ['patch','Patch'], ['locale','Voie locale'], ['autre','Autre'],
]
const VOIE_LABEL = Object.fromEntries(VOIES.map(([k,l])=>[k,l]))

function joursSouhait(s) {
  const debut = s.date_souhait ? String(s.date_souhait).slice(0,10) : null
  if (!debut) return []
  const fin = (s.sur_plusieurs_jours && s.date_fin) ? String(s.date_fin).slice(0,10) : debut
  const out = []; const d = new Date(debut); const end = new Date(fin)
  let guard = 0
  while (d <= end && guard < 60) { out.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); guard++ }
  return out
}
// Normalise un traitement (compat ancien format string)
function normTrait(t, i) {
  if (typeof t === 'string') return { id:'t'+i, nom:t, posologie:'', voie:'PO', type:'office', horaires:[], condition:'' }
  return { id:t.id||('t'+i), nom:t.nom||'', posologie:t.posologie||'', voie:t.voie||'PO', type:t.type||'office', horaires:t.horaires||[], condition:t.condition||'' }
}

function TraitementsSection({ souhait, peutPlan, peutCocher, onSave }) {
  const [mode, setMode] = useState('chart')  // 'chart' | 'edit'
  const traitements = (souhait.traitements||[]).map(normTrait)
  const jours = joursSouhait(souhait)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:11.5, color:'#7A7470', maxWidth:520, lineHeight:1.4 }}>
          ⚠️ Cette feuille ne dispense pas l'infirmier de récupérer la liste papier des médicaments lors de la prise en charge.
        </div>
        {peutPlan && (
          <div style={{ display:'flex', gap:4, background:'#F4F1EC', borderRadius:99, padding:3 }}>
            <button onClick={()=>setMode('chart')} style={pillStyle(mode==='chart')}>Feuille</button>
            <button onClick={()=>setMode('edit')} style={pillStyle(mode==='edit')}>Modifier le plan</button>
          </div>
        )}
      </div>

      {mode === 'edit' && peutPlan
        ? <TraitementsEditor traitements={traitements} onSave={(l)=>{ onSave({ traitements:l }); setMode('chart') }} />
        : <TraitementsChart traitements={traitements} jours={jours} administres={souhait.traitements_administres||{}} peutCocher={peutCocher} onSave={onSave} />
      }
    </div>
  )
}

function pillStyle(on){ return { padding:'5px 13px', borderRadius:99, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif", background:on?'#1A1514':'transparent', color:on?'white':'#7A7470' } }

function TraitementsEditor({ traitements, onSave }) {
  const [items, setItems] = useState(traitements.length ? traitements : [])
  const [saving, setSaving] = useState(false)
  const maj = (i,k,v) => setItems(it => it.map((x,j)=>j===i?{...x,[k]:v}:x))
  const add = () => setItems(it => [...it, { id:'t'+Date.now(), nom:'', posologie:'', voie:'PO', type:'office', horaires:[], condition:'' }])
  const del = (i) => setItems(it => it.filter((_,j)=>j!==i))
  function addHoraire(i){ const h = prompt('Heure (HH:MM)', '08:00'); if (h) maj(i,'horaires',[...(items[i].horaires||[]), h].sort()) }
  function delHoraire(i,h){ maj(i,'horaires',(items[i].horaires||[]).filter(x=>x!==h)) }
  async function save(){ setSaving(true); await onSave(items.filter(t=>t.nom?.trim())); setSaving(false) }

  const IN = { padding:'7px 9px', border:'1px solid rgba(0,0,0,.12)', borderRadius:7, fontSize:12.5, fontFamily:"'DM Sans',sans-serif" }
  return (
    <div>
      {items.map((t,i)=>(
        <div key={t.id} style={{ border:'1px solid rgba(0,0,0,.1)', borderRadius:10, padding:'12px 14px', marginBottom:10, background:'#FAFAF8' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#7A7470' }}>Médicament {i+1}</span>
            <button onClick={()=>del(i)} style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'3px 8px', fontSize:12, cursor:'pointer' }}>✕</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:8, marginBottom:8 }}>
            <input style={IN} placeholder="Nom du médicament" value={t.nom} onChange={e=>maj(i,'nom',e.target.value)} />
            <select style={IN} value={t.voie} onChange={e=>maj(i,'voie',e.target.value)}>
              {VOIES.map(([k,l])=><option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <input style={{ ...IN, width:'100%', marginBottom:8 }} placeholder="Posologie (ex. 1 gélule, 10 mg…)" value={t.posologie} onChange={e=>maj(i,'posologie',e.target.value)} />
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, cursor:'pointer' }}>
              <input type="radio" checked={t.type==='office'} onChange={()=>maj(i,'type','office')} /> D'office
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, cursor:'pointer' }}>
              <input type="radio" checked={t.type==='si_necessaire'} onChange={()=>maj(i,'type','si_necessaire')} /> Si nécessaire
            </label>
          </div>
          {t.type === 'office' ? (
            <div>
              <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:4 }}>Horaires de prise</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {(t.horaires||[]).map(h=>(
                  <span key={h} style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#E6F7FA', color:'#0E7A93', borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:600 }}>
                    {h} <button onClick={()=>delHoraire(i,h)} style={{ background:'none', border:'none', color:'#0E7A93', cursor:'pointer', padding:0 }}>×</button>
                  </span>
                ))}
                <button onClick={()=>addHoraire(i)} style={{ background:'#F0F9FB', color:'#0E7A93', border:'1px dashed rgba(14,122,147,.4)', borderRadius:99, padding:'3px 10px', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>+ heure</button>
              </div>
            </div>
          ) : (
            <input style={{ ...IN, width:'100%' }} placeholder="Condition (ex. si douleur, si T° > 38,5°C…)" value={t.condition} onChange={e=>maj(i,'condition',e.target.value)} />
          )}
        </div>
      ))}
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={add} style={{ padding:'8px 14px', background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>+ Ajouter un médicament</button>
        <button onClick={save} disabled={saving} style={{ padding:'8px 18px', background:'#1BB0CE', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>{saving?'…':'✓ Enregistrer le plan'}</button>
      </div>
    </div>
  )
}

function TraitementsChart({ traitements, jours, administres, peutCocher, onSave }) {
  const [jour, setJour] = useState(jours[0] || null)
  const [adm, setAdm] = useState(administres || {})
  useEffect(()=>{ setAdm(administres||{}) }, [administres])

  if (traitements.length === 0) return <Vide />

  const office = traitements.filter(t=>t.type==='office')
  const sn = traitements.filter(t=>t.type==='si_necessaire')
  const parVoie = {}
  office.forEach(t=>{ (parVoie[t.voie]=parVoie[t.voie]||[]).push(t) })
  // Colonnes d'heures = union triée des horaires des traitements d'office
  const heures = [...new Set(office.flatMap(t=>t.horaires||[]))].sort()

  async function toggle(medId, h) {
    if (!peutCocher || !jour) return
    const key = `${jour}|${medId}|${h}`
    const next = { ...adm, [key]: !adm[key] }
    if (!next[key]) delete next[key]
    setAdm(next)
    await onSave({ traitements_administres: next })
  }

  const TH = { padding:'6px 8px', fontSize:11, fontWeight:700, color:'#0E4A5A', textAlign:'center', borderBottom:'1px solid rgba(0,0,0,.1)' }
  const TD = { padding:'7px 8px', fontSize:12.5, borderBottom:'1px solid rgba(0,0,0,.05)', textAlign:'center' }

  return (
    <div>
      {jours.length > 1 && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12 }}>
          {jours.map(j=>(
            <button key={j} onClick={()=>setJour(j)} style={{ padding:'5px 11px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif", background: j===jour?'#0E7A93':'#F0F9FB', color: j===jour?'white':'#0E7A93' }}>
              {new Date(j).toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'})}
            </button>
          ))}
        </div>
      )}
      {jour && peutCocher && <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:8 }}>Cochez les prises administrées le {new Date(jour).toLocaleDateString('fr-BE')}.</div>}

      {/* Traitements d'office : grille par voie × heures */}
      {Object.keys(parVoie).map(voie=>(
        <div key={voie} style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#0E4A5A', marginBottom:6 }}>{VOIE_LABEL[voie]||voie}</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'collapse', width:'100%', minWidth:420 }}>
              <thead><tr>
                <th style={{ ...TH, textAlign:'left' }}>Médicament</th>
                {heures.map(h=><th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {parVoie[voie].map(t=>(
                  <tr key={t.id}>
                    <td style={{ ...TD, textAlign:'left', fontWeight:600, color:'#1A1514' }}>{t.nom}</td>
                    {heures.map(h=>{
                      const prevu = (t.horaires||[]).includes(h)
                      const key = `${jour}|${t.id}|${h}`
                      const coche = !!adm[key]
                      return (
                        <td key={h} style={{ ...TD, padding:'4px' }}>
                          {prevu ? (
                            <button onClick={()=>toggle(t.id,h)} disabled={!peutCocher||!jour} title={coche?'Administré — cliquer pour décocher':'Cliquer pour marquer comme administré'}
                              style={{ width:'100%', minWidth:60, minHeight:38, borderRadius:7, cursor:peutCocher&&jour?'pointer':'default',
                                border:`1.5px solid ${coche?'#3B6D11':'#C8C3BD'}`, background:coche?'#EAF3DE':'white',
                                color:coche?'#3B6D11':'#4A4340', fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif",
                                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, lineHeight:1.15, padding:'4px 5px' }}>
                              <span>{t.posologie || '—'}</span>
                              {coche && <span style={{ fontSize:11 }}>✓ donné</span>}
                            </button>
                          ) : <span style={{ color:'#D8D3CD' }}>·</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Si nécessaire */}
      {sn.length > 0 && (
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#BA7517', marginBottom:6 }}>⚡ Si nécessaire</div>
          {sn.map(t=>(
            <div key={t.id} style={{ display:'flex', justifyContent:'space-between', gap:10, padding:'7px 10px', background:'#FAEEDA', borderRadius:8, marginBottom:6, fontSize:12.5 }}>
              <span style={{ fontWeight:600, color:'#1A1514' }}>{t.nom} <span style={{ color:'#7A7470', fontWeight:400 }}>· {t.posologie} · {VOIE_LABEL[t.voie]||t.voie}</span></span>
              <span style={{ color:'#7A5512', fontStyle:'italic' }}>{t.condition}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helpers du rapport logistique (au niveau module → pas de perte de focus) ──
// Champ qui garde son propre état pendant la frappe et ne remonte la valeur
// qu'à la sortie du champ (onBlur) → aucun recalcul/re-render pendant la saisie.
function FieldInput({ value, onCommit, peutEditer, inputMode='decimal', placeholder, style }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <input type="text" inputMode={inputMode} disabled={!peutEditer} placeholder={placeholder}
      value={v} onChange={e=>setV(e.target.value)} onBlur={()=>onCommit(v)} style={style} />
  )
}
function FieldArea({ value, onCommit, peutEditer, rows=2, style }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <textarea disabled={!peutEditer} rows={rows}
      value={v} onChange={e=>setV(e.target.value)} onBlur={()=>onCommit(v)} style={style} />
  )
}
function RLCard({ titre, children }) {
  return (
    <div style={{ background:'white', border:'1px solid rgba(0,0,0,.08)', borderRadius:12, padding:'14px 16px' }}>
      <div style={{ fontSize:12.5, fontWeight:700, color:'#0E4A5A', textTransform:'uppercase', letterSpacing:.3, marginBottom:8 }}>{titre}</div>
      {children}
    </div>
  )
}
function RLChk({ label, checked, onChange, peutEditer }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:9, padding:'5px 0', fontSize:13, color:'#1A1514', cursor:peutEditer?'pointer':'default' }}>
      <input type="checkbox" disabled={!peutEditer} checked={!!checked} onChange={e=>onChange(e.target.checked)} style={{ accentColor:'#3B6D11', width:16, height:16 }} />
      {label}
    </label>
  )
}

// Jauge de carburant : 0 (gauche) → 1 (plein, droite), repères 1/4 1/2 3/4, % à côté
function JaugeCarburant({ value, onChange, peutEditer }) {
  // value : pourcentage 0..100
  const pct = Math.max(0, Math.min(100, parseFloat(value) || 0))
  const trackRef = useRef(null)

  function fromEvent(e) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left
    return Math.round(Math.max(0, Math.min(1, x / rect.width)) * 100)
  }
  function handlePointer(e) {
    if (!peutEditer) return
    const v = fromEvent(e); if (v != null) onChange(v)
  }
  function onDown(e) {
    if (!peutEditer) return
    handlePointer(e)
    const move = (ev) => { ev.preventDefault(); handlePointer(ev) }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  const fraction = (label, p) => (
    <div style={{ position:'absolute', left:`${p}%`, top:0, transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center' }}>
      <div style={{ width:1.5, height:14, background:'rgba(0,0,0,.25)' }} />
      <span style={{ fontSize:10, color:'#7A7470', marginTop:2 }}>{label}</span>
    </div>
  )

  return (
    <div style={{ padding:'6px 0 2px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:13, color:'#4A4340' }}>⛽ Jauge carburant</span>
        <span style={{ fontSize:15, fontWeight:700, color: pct < 25 ? '#C8435A' : pct < 50 ? '#BA7517' : '#3B6D11' }}>{pct}%</span>
      </div>
      <div ref={trackRef} onPointerDown={onDown} onClick={handlePointer}
        style={{ position:'relative', height:26, borderRadius:8, background:'linear-gradient(90deg,#FCEBEB,#FAEEDA,#EAF3DE)', border:'1px solid rgba(0,0,0,.12)', cursor:peutEditer?'pointer':'default', touchAction:'none' }}>
        {/* remplissage */}
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${pct}%`, background:'linear-gradient(90deg,#1BB0CE,#0E7A93)', opacity:.35, borderRadius:'8px 0 0 8px' }} />
        {/* curseur */}
        <div style={{ position:'absolute', left:`${pct}%`, top:-3, bottom:-3, width:3, transform:'translateX(-50%)', background:'#0E4A5A', borderRadius:2 }} />
      </div>
      {/* repères */}
      <div style={{ position:'relative', height:26, marginTop:2 }}>
        {fraction('0', 0)}
        {fraction('¼', 25)}
        {fraction('½', 50)}
        {fraction('¾', 75)}
        {fraction('1', 100)}
      </div>
      {peutEditer && <div style={{ fontSize:11, color:'#A8A39D', marginTop:2 }}>Touchez/glissez sur la jauge pour indiquer le niveau.</div>}
    </div>
  )
}
function RLNum({ label, unit, value, onChange, peutEditer }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0' }}>
      <span style={{ fontSize:13, color:'#4A4340', minWidth:130 }}>{label}</span>
      <FieldInput value={value} onCommit={onChange} peutEditer={peutEditer}
        style={{ width:100, padding:'5px 8px', border:'1px solid rgba(0,0,0,.12)', borderRadius:6, fontSize:13 }} />
      {unit && <span style={{ fontSize:12, color:'#7A7470' }}>{unit}</span>}
    </div>
  )
}
function RLTxt({ label, value, onChange, peutEditer }) {
  return (
    <div style={{ padding:'5px 0' }}>
      <label style={{ fontSize:12.5, color:'#4A4340', display:'block', marginBottom:3 }}>{label}</label>
      <FieldArea value={value} onCommit={onChange} peutEditer={peutEditer}
        style={{ width:'100%', padding:'7px 10px', border:'1px solid rgba(0,0,0,.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif", boxSizing:'border-box' }} />
    </div>
  )
}

function RapportLogistiqueTab({ souhait, peutEditer, onSave }) {
  const [r, setR] = useState(normRapport(souhait.rapport_logistique))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(()=>{ setR(normRapport(souhait.rapport_logistique)); setDirty(false) }, [souhait.rapport_logistique])

  const set = (sec,k,v) => { setR(x=>({ ...x, [sec]:{ ...x[sec], [k]:v } })); setDirty(true) }
  const setSection = (sec,val) => { setR(x=>({ ...x, [sec]:val })); setDirty(true) }
  async function save(){ setSaving(true); await onSave({ rapport_logistique:r }); setSaving(false); setDirty(false) }

  // Distance auto
  const kd = parseFloat(r.base.kms_depart), kr = parseFloat(r.retour_base.kms_retour)
  const distance = (isFinite(kd) && isFinite(kr) && kr >= kd) ? (kr - kd) : null

  return (
    <div style={{ maxWidth:920 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
        <RLCard titre="Checklist Base">
          <RLNum label="KMs départ" value={r.base.kms_depart} onChange={v=>set('base','kms_depart',v)} peutEditer={peutEditer} unit="km" />
          <RLChk label="GPS" checked={r.base.gps} onChange={v=>set('base','gps',v)} peutEditer={peutEditer} />
          <RLChk label="Sac d'intervention" checked={r.base.sac_intervention} onChange={v=>set('base','sac_intervention',v)} peutEditer={peutEditer} />
          <RLChk label="Sac à dos" checked={r.base.sac_dos} onChange={v=>set('base','sac_dos',v)} peutEditer={peutEditer} />
          <RLChk label="Sac confort" checked={r.base.sac_confort} onChange={v=>set('base','sac_confort',v)} peutEditer={peutEditer} />
          <RLChk label="O2" checked={r.base.o2} onChange={v=>set('base','o2',v)} peutEditer={peutEditer} />
          <RLChk label="Carte VISA + Essence" checked={r.base.visa_essence} onChange={v=>set('base','visa_essence',v)} peutEditer={peutEditer} />
          <JaugeCarburant value={r.base.essence_pct} onChange={v=>set('base','essence_pct',v)} peutEditer={peutEditer} />
          <RLChk label="Matériel « si nécessaire » (SN) requis" checked={r.base.sn_requis} onChange={v=>set('base','sn_requis',v)} peutEditer={peutEditer} />
          <RLTxt label="Dégâts véhicule ou pannes" value={r.base.degats} onChange={v=>set('base','degats',v)} peutEditer={peutEditer} />
        </RLCard>

        <RLCard titre="Checklist PEC">
          <RLChk label="Consentement" checked={r.pec.consentement} onChange={v=>set('pec','consentement',v)} peutEditer={peutEditer} />
          <RLChk label="Autorisation photos" checked={r.pec.autorisation_photos} onChange={v=>set('pec','autorisation_photos',v)} peutEditer={peutEditer} />
          <RLChk label="Feuille de traitements" checked={r.pec.feuille_traitements} onChange={v=>set('pec','feuille_traitements',v)} peutEditer={peutEditer} />
          <RLChk label="Traitements avec surplus sécurité" checked={r.pec.traitements_surplus} onChange={v=>set('pec','traitements_surplus',v)} peutEditer={peutEditer} />
          <RLChk label="Protections, sondes et sachet à diurèse (SN)" checked={r.pec.protections_sondes} onChange={v=>set('pec','protections_sondes',v)} peutEditer={peutEditer} />
          <RLTxt label="Divers requis" value={r.pec.divers_requis} onChange={v=>set('pec','divers_requis',v)} peutEditer={peutEditer} />
        </RLCard>

        <RLCard titre="Checklist Retour PEC">
          <RLChk label="Traitements en surplus rendu" checked={r.retour_pec.traitements_surplus_rendu} onChange={v=>set('retour_pec','traitements_surplus_rendu',v)} peutEditer={peutEditer} />
          <RLChk label="Divers patients rendu" checked={r.retour_pec.divers_rendu} onChange={v=>set('retour_pec','divers_rendu',v)} peutEditer={peutEditer} />
          <RLChk label="Si institution, échange draps, matériel utilisé" checked={r.retour_pec.echange_draps} onChange={v=>set('retour_pec','echange_draps',v)} peutEditer={peutEditer} />
          <RLChk label="Reprise matériels et sacs" checked={r.retour_pec.reprise_materiels} onChange={v=>set('retour_pec','reprise_materiels',v)} peutEditer={peutEditer} />
        </RLCard>

        <RLCard titre="Checklist Retour Base">
          <RLNum label="KMs retour" unit="km" value={r.retour_base.kms_retour} onChange={v=>set('retour_base','kms_retour',v)} peutEditer={peutEditer} />
          {distance != null && <div style={{ fontSize:12.5, fontWeight:600, color:'#0E7A93', padding:'3px 0 6px' }}>🛣️ Distance parcourue : {distance} km</div>}
          <RLChk label="Plein du véhicule" checked={r.retour_base.plein} onChange={v=>set('retour_base','plein',v)} peutEditer={peutEditer} />
          <RLChk label="Rangement matériel (cfr Checklist Base)" checked={r.retour_base.rangement} onChange={v=>set('retour_base','rangement',v)} peutEditer={peutEditer} />
          <RLChk label="Remplacement matériel pris dans le véhicule" checked={r.retour_base.remplacement_materiel} onChange={v=>set('retour_base','remplacement_materiel',v)} peutEditer={peutEditer} />
          <RLChk label="Remise en ordre et nettoyage véhicule" checked={r.retour_base.remise_ordre} onChange={v=>set('retour_base','remise_ordre',v)} peutEditer={peutEditer} />
          <RLChk label="Linge sale dans sac de linge" checked={r.retour_base.linge_sale} onChange={v=>set('retour_base','linge_sale',v)} peutEditer={peutEditer} />
          <RLChk label="Remise des clés et papiers" checked={r.retour_base.remise_cles} onChange={v=>set('retour_base','remise_cles',v)} peutEditer={peutEditer} />
          <RLTxt label="Dégâts ou pannes durant la mission" value={r.retour_base.degats_mission} onChange={v=>set('retour_base','degats_mission',v)} peutEditer={peutEditer} />
          <RLTxt label="Matériels utilisés" value={r.retour_base.materiels_utilises} onChange={v=>set('retour_base','materiels_utilises',v)} peutEditer={peutEditer} />
        </RLCard>
      </div>

      <div style={{ marginTop:16 }}>
        <RLCard titre="🫁 Oxygène — bouteilles emportées">
          <O2Section value={r.o2} peutEditer={peutEditer} onChange={(o2)=>{ setR(x=>({ ...x, o2 })); setDirty(true) }} />
        </RLCard>
      </div>

      <div style={{ marginTop:16 }}>
        <RLCard titre="⛽ Tickets carburant">
          <TicketsCarburant souhaitId={souhait.id} tickets={r.tickets_carburant} peutEditer={peutEditer}
            onChange={(t)=>setSection('tickets_carburant', t)} />
        </RLCard>
      </div>

      {peutEditer && dirty && (
        <div style={{ marginTop:16 }}>
          <button onClick={save} disabled={saving} style={{ padding:'9px 20px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>{saving?'…':'✓ Enregistrer le rapport logistique'}</button>
        </div>
      )}
      {!peutEditer && <div style={{ fontSize:11.5, color:'#A8A39D', marginTop:12 }}>Lecture seule — seul l'équipage affecté remplit ce rapport.</div>}
    </div>
  )
}

function normRapport(init) {
  const i = init || {}
  return {
    base: i.base||{}, pec: i.pec||{}, retour_pec: i.retour_pec||{},
    retour_base: i.retour_base||{}, o2: i.o2||{},
    tickets_carburant: Array.isArray(i.tickets_carburant) ? i.tickets_carburant : [],
  }
}

// ── Tickets carburant : photo, reconnaissance auto (OCR), totaux ──────────────
async function uploadTicketPhoto(file, souhaitId) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `tickets/${souhaitId || 'divers'}/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`
  const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert:true, contentType:file.type })
  if (error) throw error
  return supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl
}
async function ocrTicket(file) {
  try {
    const { data } = await Tesseract.recognize(file, 'fra')
    return parseTicket(data?.text || '')
  } catch { return null }
}

// Extraction heuristique depuis le texte OCR brut
function parseTicket(text) {
  if (!text) return null
  const raw = text
  const low = text.toLowerCase()
  const n = (s) => parseFloat(String(s).replace(',', '.'))
  const amounts = [...raw.matchAll(/(\d{1,4}[.,]\d{2})/g)].map(m => n(m[1])).filter(x => isFinite(x))

  // Prix : près de "total", sinon montant suivi de € , sinon le plus grand
  let prix = null
  const t = low.match(/total[^0-9]{0,12}(\d{1,4}[.,]\d{2})/)
  const e = raw.match(/(\d{1,4}[.,]\d{2})\s*(?:€|eur)/i)
  if (t) prix = n(t[1])
  else if (e) prix = n(e[1])
  else if (amounts.length) prix = Math.max(...amounts)

  // Litres : nombre suivi de L/litre, ou près de "volume"
  let litres = null
  const l = raw.match(/(\d{1,3}[.,]\d{1,3})\s*(?:l\b|litres?\b)/i) || low.match(/(?:volume|litres?)[^0-9]{0,10}(\d{1,3}[.,]\d{1,3})/)
  if (l) litres = n(l[1])

  // Station : marque connue
  const brands = ['totalenergies','total','q8','esso','shell','texaco','lukoil','dats 24','dats','gabriels','octa+','octa','aral','gulf','avia','makro','colruyt','maes','bp']
  let station = null
  for (const b of brands) { if (low.includes(b)) { station = b.toUpperCase(); break } }

  // Carte / paiement
  const paiements = [['bancontact','Bancontact'],['maestro','Maestro'],['visa','Visa'],['mastercard','Mastercard'],['american express','American Express'],['amex','Amex'],['dkv','DKV'],['espèces','Espèces'],['especes','Espèces'],['cash','Espèces'],['carburant','Carte carburant']]
  let carte = null
  for (const [k,lab] of paiements) { if (low.includes(k)) { carte = lab; break } }

  return { prix: prix ?? '', litres: litres ?? '', station: station ?? '', carte: carte ?? '' }
}

function TicketsCarburant({ souhaitId, tickets, peutEditer, onChange }) {
  const list = Array.isArray(tickets) ? tickets : []
  const [busy, setBusy] = useState(false)
  const maj = (id,k,v) => onChange(list.map(t => t.id===id ? { ...t, [k]:v } : t))
  const del = (id) => onChange(list.filter(t => t.id!==id))

  async function ajouter(file) {
    if (!file) return
    setBusy(true)
    const id = 'tk'+Date.now()
    const base = { id, url:'', prix:'', litres:'', station:'', carte:'', date:new Date().toISOString().slice(0,10) }
    try {
      const url = await uploadTicketPhoto(file, souhaitId)
      const withUrl = [...list, { ...base, url }]
      onChange(withUrl)                       // affiche tout de suite la photo
      const reco = await ocrTicket(file)        // reconnaissance auto (locale)
      if (reco) {
        onChange(withUrl.map(x => x.id===id
          ? { ...x, prix: reco.prix ?? '', litres: reco.litres ?? '', station: reco.station ?? '', carte: reco.carte ?? '' }
          : x))
      }
    } catch (e) {
      alert('Upload impossible : ' + (e.message||e))
    }
    setBusy(false)
  }

  const totalPrix = list.reduce((s,t)=> s + (parseFloat(t.prix)||0), 0)
  const totalLitres = list.reduce((s,t)=> s + (parseFloat(t.litres)||0), 0)
  const IN = { padding:'6px 8px', border:'1px solid rgba(0,0,0,.12)', borderRadius:6, fontSize:12.5, fontFamily:"'DM Sans',sans-serif" }

  return (
    <div>
      <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:10 }}>Ajoutez un ticket à tout moment : la photo est analysée automatiquement (prix, litres, station, carte). Vous pouvez corriger les valeurs.</div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {list.map(t => (
          <div key={t.id} style={{ display:'flex', gap:12, border:'1px solid rgba(0,0,0,.08)', borderRadius:10, padding:'10px 12px', background:'#FAFAF8', flexWrap:'wrap' }}>
            {t.url
              ? <a href={t.url} target="_blank" rel="noreferrer"><img src={t.url} alt="ticket" style={{ width:64, height:64, objectFit:'cover', borderRadius:8, border:'1px solid rgba(0,0,0,.1)' }} /></a>
              : <div style={{ width:64, height:64, borderRadius:8, background:'#EEE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>⛽</div>}
            <div style={{ flex:1, minWidth:200, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:8 }}>
              <label style={{ fontSize:11, color:'#7A7470' }}>Prix (€)<FieldInput value={t.prix} onCommit={v=>maj(t.id,'prix',v)} peutEditer={peutEditer} style={{ ...IN, width:'100%', marginTop:2 }} /></label>
              <label style={{ fontSize:11, color:'#7A7470' }}>Litres<FieldInput value={t.litres} onCommit={v=>maj(t.id,'litres',v)} peutEditer={peutEditer} style={{ ...IN, width:'100%', marginTop:2 }} /></label>
              <label style={{ fontSize:11, color:'#7A7470' }}>Station<FieldInput value={t.station} onCommit={v=>maj(t.id,'station',v)} peutEditer={peutEditer} inputMode="text" style={{ ...IN, width:'100%', marginTop:2 }} /></label>
              <label style={{ fontSize:11, color:'#7A7470' }}>Carte<FieldInput value={t.carte} onCommit={v=>maj(t.id,'carte',v)} peutEditer={peutEditer} inputMode="text" style={{ ...IN, width:'100%', marginTop:2 }} /></label>
              <label style={{ fontSize:11, color:'#7A7470' }}>Date<input type="date" disabled={!peutEditer} value={t.date||''} onChange={e=>maj(t.id,'date',e.target.value)} style={{ ...IN, width:'100%', marginTop:2 }} /></label>
            </div>
            {peutEditer && <button type="button" onClick={()=>del(t.id)} style={{ alignSelf:'flex-start', background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'3px 8px', fontSize:12, cursor:'pointer' }}>✕</button>}
          </div>
        ))}
      </div>

      {peutEditer && (
        <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:12, padding:'8px 14px', background:'#FAEEDA', color:'#BA7517', borderRadius:8, fontSize:13, fontWeight:600, cursor:busy?'wait':'pointer' }}>
          {busy ? 'Analyse…' : '+ Ajouter un ticket (photo)'}
          <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={e=>{ const f=e.target.files?.[0]; e.target.value=''; ajouter(f) }} style={{ display:'none' }} />
        </label>
      )}

      {list.length > 0 && (
        <div style={{ marginTop:14, display:'flex', gap:20, flexWrap:'wrap', borderTop:'1px solid rgba(0,0,0,.08)', paddingTop:12 }}>
          <div style={{ fontSize:14 }}>💶 Total dépensé : <strong style={{ color:'#C8435A' }}>{totalPrix.toFixed(2)} €</strong></div>
          <div style={{ fontSize:14 }}>⛽ Total carburant : <strong style={{ color:'#0E7A93' }}>{totalLitres.toFixed(2)} L</strong></div>
          <div style={{ fontSize:13, color:'#7A7470', alignSelf:'center' }}>{list.length} ticket{list.length>1?'s':''}</div>
        </div>
      )}
    </div>
  )
}

// ── Oxygène : bouteilles, litres restants, autonomie, consommation ────────────
const O2_TYPES = [
  { type:'B10', volume:10, perte:0.10 },
  { type:'B5',  volume:5,  perte:0.10 },
  { type:'B2',  volume:2,  perte:0.15 },
]
const O2_DEBITS = [4, 7, 10, 15]   // L/min

function fmtMin(min) {
  if (!isFinite(min) || min <= 0) return '—'
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m/60), r = m%60
  return r ? `${h} h ${r} min` : `${h} h`
}

function O2Section({ value, peutEditer, onChange }) {
  // Normalisation : { B10:[{d,r},...], B5:[...], B2:[...] }
  const o2 = { B10: Array.isArray(value?.B10)?value.B10:[], B5: Array.isArray(value?.B5)?value.B5:[], B2: Array.isArray(value?.B2)?value.B2:[] }

  function setCount(type, n) {
    const arr = [...o2[type]]
    n = Math.max(0, Math.min(20, parseInt(n)||0))
    while (arr.length < n) arr.push({ d:'', r:'' })
    arr.length = n
    onChange({ ...o2, [type]: arr })
  }
  function setVal(type, i, k, v) {
    const arr = o2[type].map((b,j)=>j===i?{ ...b, [k]:v }:b)
    onChange({ ...o2, [type]: arr })
  }

  const IN = { width:74, padding:'6px 8px', border:'1px solid rgba(0,0,0,.12)', borderRadius:6, fontSize:13 }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {O2_TYPES.map(({ type, volume, perte }) => {
        const facteur = 1 - perte
        return (
          <div key={type}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#0E4A5A' }}>{type} <span style={{ color:'#7A7470', fontWeight:400 }}>({volume} L · −{Math.round(perte*100)}%)</span></span>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, color:'#4A4340' }}>
                Nombre :
                <FieldInput value={o2[type].length || 0} onCommit={v=>setCount(type, v)} peutEditer={peutEditer} inputMode="numeric"
                  style={{ ...IN, width:60 }} />
              </label>
            </div>

            {o2[type].length === 0 && <div style={{ fontSize:12, color:'#A8A39D', fontStyle:'italic' }}>Aucune bouteille {type}.</div>}

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {o2[type].map((b, i) => {
                const d = parseFloat(b.d), r = parseFloat(b.r)
                const litresDep = isFinite(d) ? volume * d : null
                const consommes = (isFinite(d) && isFinite(r)) ? volume * (d - r) : null
                return (
                  <div key={i} style={{ border:'1px solid rgba(0,0,0,.08)', borderRadius:10, padding:'10px 12px', background:'#FAFAF8' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#7A7470', minWidth:80 }}>Bouteille {i+1}</span>
                      <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5 }}>
                        Départ
                        <FieldInput value={b.d} onCommit={v=>setVal(type, i, 'd', v)} peutEditer={peutEditer} style={IN} /> bar
                      </label>
                      {litresDep != null && <span style={{ fontSize:12.5, fontWeight:600, color:'#0E7A93' }}>= {Math.round(litresDep)} L</span>}
                      <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5 }}>
                        Retour
                        <FieldInput value={b.r} onCommit={v=>setVal(type, i, 'r', v)} peutEditer={peutEditer} style={IN} /> bar
                      </label>
                      {consommes != null && (
                        <span style={{ fontSize:12.5, fontWeight:600, color: consommes >= 0 ? '#C8435A' : '#A32D2D' }}>
                          consommé {Math.round(Math.max(0, consommes))} L
                        </span>
                      )}
                    </div>
                    {litresDep != null && (
                      <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
                        <span style={{ fontSize:11, color:'#7A7470', alignSelf:'center' }}>Autonomie (départ) :</span>
                        {O2_DEBITS.map(deb => (
                          <span key={deb} style={{ fontSize:11.5, background:'#E6F7FA', color:'#0E4A5A', borderRadius:99, padding:'2px 9px' }}>
                            {deb} L/min : <strong>{fmtMin((litresDep / deb) * facteur)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      <div style={{ fontSize:11, color:'#A8A39D' }}>Litres restants = volume × pression. Autonomie = (volume × pression ÷ débit) − {O2_TYPES[0] && '10% (B10/B5), 15% (B2)'}. Bouteille neuve ≈ 200 bar.</div>
    </div>
  )
}

function Vide() {
  return <p style={{ fontSize:13, color:'#A8A39D', fontStyle:'italic', margin:0 }}>Non renseigné.</p>
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
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:18 }}>
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

// ── Affectation par équipage : LECTURE SEULE (modification dans le formulaire) ──
function EquipagesReadOnly({ equipages, personnel }) {
  function besoinMin(eq){ return eq.type==='logistique' ? 1 : 2 + (eq.longue_route?1:0) }
  return (
    <InfoCard title="🚑 Équipages & personnel">
      {equipages.length === 0 && <p style={{ fontSize:13, color:'#A8A39D', fontStyle:'italic' }}>Aucun équipage défini.</p>}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {equipages.map((eq,i)=>{
          const membres = personnel.filter(p => p.equipage_id === eq.id)
          const accredites = membres.filter(m => m.profiles?.selection_medicale)
          const chauffeurId = eq.chauffeur_id || (accredites.length === 1 ? accredites[0].user_id : null)
          const min = besoinMin(eq)
          const complet = membres.length >= min
          const titre = eq.type==='logistique' ? `🚐 Véhicule logistique ${i+1}` : `🚑 Ambulance ${i+1}${eq.mode==='paramedicalise'?' — paramédicalisé':' — normalisé'}`
          return (
            <div key={eq.id} style={{ border:`1px solid ${complet?'rgba(59,109,17,.25)':'rgba(200,67,90,.2)'}`, borderRadius:11, padding:'12px 14px', background: complet?'#F6FBF1':'#FFF8F9' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:13.5, fontWeight:700, color:'#1A1514' }}>{titre}</span>
                <span style={{ fontSize:11.5, fontWeight:600, padding:'2px 9px', borderRadius:99, background: complet?'#EAF3DE':'#FCEBEB', color: complet?'#3B6D11':'#A32D2D' }}>{membres.length}/{min} · {complet?'complet':'incomplet'}</span>
              </div>
              {eq.immatriculation && <div style={{ fontSize:12.5, color:'#0E7A93', fontWeight:600, marginBottom:6 }}>🚗 {eq.immatriculation}</div>}
              {membres.length === 0 ? <span style={{ fontSize:12.5, color:'#A8A39D', fontStyle:'italic' }}>Aucun volontaire affecté.</span> : (
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {membres.map(p=>(
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#1A1514' }}>
                      <span>• {p.profiles?.prenom} {p.profiles?.nom}</span>
                      <span style={{ color:'#7A7470', fontSize:11.5 }}>· {p.profiles?.role?.replace(/_/g,' ')}</span>
                      {p.user_id === chauffeurId && <span title="Chauffeur" style={{ fontSize:10.5, fontWeight:700, color:'#0E7A93', background:'#E6F7FA', borderRadius:99, padding:'1px 7px' }}>🚗 chauffeur</span>}
                    </div>
                  ))}
                </div>
              )}
              {membres.length > 0 && accredites.length === 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:8, background:'#FCEBEB', color:'#A32D2D', border:'1px solid rgba(163,45,45,.2)', borderRadius:8, padding:'6px 10px', fontSize:12, fontWeight:600 }}>
                  ⚠️ Aucun chauffeur accrédité dans cet équipage.
                </div>
              )}
              {membres.length > 0 && accredites.length > 1 && !chauffeurId && (
                <div style={{ marginTop:8, color:'#A32D2D', fontSize:11.5 }}>⚠️ Chauffeur non désigné (plusieurs accrédités).</div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ fontSize:11, color:'#A8A39D', marginTop:10 }}>L'affectation se modifie dans le formulaire (✏️ Modifier → étape Logistique).</div>
    </InfoCard>
  )
}

function LieuWaze({ titre, lieu, adresse, precisions, repere, route, chambre, lat, lon }) {
  const wazeUrl = (lat && lon)
    ? `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(adresse || lieu || '')}&navigate=yes`
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, padding:'8px 0', borderBottom:'1px solid rgba(0,0,0,.04)' }}>
      <div>
        <div style={{ fontSize:11.5, fontWeight:600, color:'#7A7470', textTransform:'uppercase', letterSpacing:.3 }}>{titre}</div>
        {lieu && <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1514' }}>{lieu}</div>}
        {adresse && <div style={{ fontSize:12.5, color:'#4A4340' }}>{adresse}</div>}
        {(route || chambre) && (
          <div style={{ fontSize:12.5, color:'#0E7A93', fontWeight:600, marginTop:2 }}>
            {route && `🏥 ${route}`}{route && chambre && ' · '}{chambre && `Chambre ${chambre}`}
          </div>
        )}
        {repere && <div style={{ fontSize:12.5, color:'#4A4340' }}>📌 {repere}</div>}
        {precisions && <div style={{ fontSize:12.5, color:'#7A7470', fontStyle:'italic', marginTop:2 }}>{precisions}</div>}
      </div>
      <a href={wazeUrl} target="_blank" rel="noreferrer"
        style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 13px', background:'#33CCFF', color:'#062B45', borderRadius:9, fontSize:12.5, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap', flexShrink:0 }}>
        ▸ Waze
      </a>
    </div>
  )
}

// ── Affectation par équipage : véhicule + personnel ───────────────────────────
function AffectationEquipages({ equipages, personnel, volontaires, dispoIds, aDate, multiJours, peutAffecter, onAffecter, onRetirer, onVehicule }) {
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
              dispoIds={dispoIds} aDate={aDate} multiJours={multiJours}
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

function EquipageCard({ eq, titre, besoin, complet, membres, volontaires, personnel, dispoIds, aDate, multiJours, peutAffecter, onAffecter, onRetirer, onVehicule }) {
  const [sel, setSel] = useState('')
  const [plaque, setPlaque] = useState(eq.immatriculation || '')
  const [dispoOnly, setDispoOnly] = useState(aDate)   // par défaut, on ne montre que les disponibles si le souhait a une date
  useEffect(() => { setPlaque(eq.immatriculation || '') }, [eq.immatriculation])

  const libres = volontaires.filter(v => !personnel.some(p => p.user_id === v.id))
  const dispo = (aDate && dispoOnly) ? libres.filter(v => dispoIds.has(v.id)) : libres
  const nbDispo = libres.filter(v => dispoIds.has(v.id)).length

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
        <label style={{ fontSize:11.5, fontWeight:600, color:'#7A7470', display:'block', marginBottom:3 }}>🚗 Véhicule (immatriculation)</label>
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
        <div>
          {aDate && (
            <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:11.5, color:'#0E7A93', marginBottom:6, cursor:'pointer' }}>
              <input type="checkbox" checked={dispoOnly} onChange={e=>setDispoOnly(e.target.checked)} style={{ accentColor:'#1BB0CE' }} />
              Seulement le personnel disponible {multiJours ? 'sur toute la durée' : 'ce jour-là'} ({nbDispo})
            </label>
          )}
          <div style={{ display:'flex', gap:7 }}>
            <select value={sel} onChange={e=>setSel(e.target.value)} style={{ flex:1, padding:'7px 9px', border:'1px solid rgba(0,0,0,.12)', borderRadius:7, fontSize:12.5, fontFamily:'DM Sans,sans-serif' }}>
              <option value="">+ Affecter un volontaire…</option>
              {dispo.map(v => <option key={v.id} value={v.id}>{v.prenom} {v.nom}{v.role?` — ${v.role.replace(/_/g,' ')}`:''}{dispoIds.has(v.id)?' ✓':''}</option>)}
            </select>
            <button onClick={()=>{ onAffecter(sel, eq.id); setSel('') }} disabled={!sel} style={{ padding:'7px 12px', background:'#C8435A', color:'white', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:sel?'pointer':'not-allowed', opacity:sel?1:.5, fontFamily:'DM Sans,sans-serif' }}>Affecter</button>
          </div>
          {aDate && dispoOnly && dispo.length === 0 && <div style={{ fontSize:11.5, color:'#A32D2D', marginTop:5 }}>Aucun volontaire n'a encodé de disponibilité couvrant {multiJours ? 'toute la durée' : 'ce jour'}.</div>}
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