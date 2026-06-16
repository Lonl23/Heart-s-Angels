// src/modules/souhaits/DetailSouhait.jsx
import { useState, useEffect, useRef } from 'react'
import Tesseract from 'tesseract.js'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { notifRapportFinalSouhait } from '@/lib/notifications'
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
  const [souhaitDates, setSouhaitDates] = useState([])
  const [annu, setAnnu] = useState({})
  const [dispos, setDispos]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('info')   // 'info'|'checklist'|'photos'|'rapport'
  const [updatingStatut, setUpdatingStatut] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const [{ data: s }, { data: p }, { data: cl }, { data: rap }, { data: vol }, { data: disp }, { data: sd }] = await Promise.all([
      supabase.from('souhaits').select('*').eq('id', id).single(),
      supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role,email,selection_medicale)').eq('souhait_id', id),
      supabase.from('checklists').select('*, checklist_reponses(*)').eq('souhait_id', id),
      supabase.from('souhait_rapports').select('*').eq('souhait_id', id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,prenom,nom,role,selection_medicale').order('nom'),
      supabase.from('disponibilites').select('user_id,date_debut,date_fin'),
      supabase.from('souhait_dates').select('*').eq('souhait_id', id).order('date_proposee'),
    ])
    setSouhait(s); setPersonnel(p || []); setChecklists(cl || []); setRapports(rap || []); setVolontaires(vol || [])
    setDispos(disp || []); setSouhaitDates(sd || [])
    setLoading(false)

    // Fiches annuaire liées (bénéficiaire + accompagnant + référents)
    try {
      const ids = [s?.beneficiaire_id, s?.accompagnant_id].filter(Boolean)
      let benef = null, acc = null, med = null, inf = null, inst = null
      if (ids.length) {
        const { data: cs } = await supabase.from('annuaire_contacts').select('*').in('id', ids)
        benef = cs?.find(c => c.id === s.beneficiaire_id) || null
        acc   = cs?.find(c => c.id === s.accompagnant_id) || null
      }
      const ids2 = [benef?.medecin_id, benef?.infirmier_id].filter(Boolean)
      if (ids2.length) {
        const { data: ds } = await supabase.from('annuaire_contacts').select('id,prenom,nom,specialite,telephone,email,inami').in('id', ids2)
        med = ds?.find(x => x.id === benef.medecin_id) || null
        inf = ds?.find(x => x.id === benef.infirmier_id) || null
      }
      if (benef?.institution_id) {
        const { data: it } = await supabase.from('annuaire_institutions').select('*').eq('id', benef.institution_id).single()
        inst = it || null
      }
      setAnnu({ benef, acc, med, inf, inst })
    } catch (e) { /* annuaire indisponible : on ignore */ }
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
    const etaitRealise = souhait.statut === 'realise'
    await supabase.from('souhaits').update({ statut }).eq('id', id)
    setSouhait(s => ({...s, statut}))
    setUpdatingStatut(false)
    // Auto : à la bascule en « réalisé », notifier les coordinateurs transport & médical
    if (statut === 'realise' && !etaitRealise) {
      try { await notifRapportFinalSouhait({ ...souhait, statut }, profile?.id) } catch (e) { console.warn('notif rapport final:', e?.message) }
    }
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

          {/* Fiches annuaire liées (secret médical) */}
          {can('annuaire.medical') && annu.benef && (
            <InfoCard title="🎗️ Fiche bénéficiaire (annuaire)">
              <Row label="Nom" val={`${annu.benef.prenom||''} ${annu.benef.nom||''}`.trim()} />
              {annu.benef.date_naissance && <Row label="Naissance" val={new Date(annu.benef.date_naissance).toLocaleDateString('fr-BE')} />}
              {annu.inst && <Row label="Institution" val={annu.inst.nom} />}
              {annu.benef.adresse && <Row label="Adresse" val={annu.benef.adresse} />}
              {annu.med && <Row label="Médecin traitant" val={`Dr ${annu.med.prenom||''} ${annu.med.nom||''}`.trim() + (annu.med.telephone?` · ${annu.med.telephone}`:'')} />}
              {annu.inf && <Row label="Infirmier" val={`${annu.inf.prenom||''} ${annu.inf.nom||''}`.trim() + (annu.inf.telephone?` · ${annu.inf.telephone}`:'')} />}
              {annu.benef.telephone && <Row label="Tél." val={annu.benef.telephone} isLink={`tel:${annu.benef.telephone}`} />}
              {annu.benef.pathologie && <Row label="Pathologie" val={annu.benef.pathologie} isAlert />}
              {annu.benef.note && <Row label="Note" val={annu.benef.note} />}
              <div style={{ marginTop:8 }}><Link to="/app/annuaire" style={{ fontSize:12, color:'#0E7A93', textDecoration:'none', fontWeight:600 }}>→ Ouvrir l'annuaire</Link></div>
            </InfoCard>
          )}
          {can('annuaire.medical') && annu.acc && (
            <InfoCard title="🤝 Accompagnant (annuaire)">
              <Row label="Nom" val={`${annu.acc.prenom||''} ${annu.acc.nom||''}`.trim()} />
              {annu.acc.lien && <Row label="Lien" val={annu.acc.lien} />}
              {annu.acc.telephone && <Row label="Tél." val={annu.acc.telephone} isLink={`tel:${annu.acc.telephone}`} />}
              {annu.acc.email && <Row label="Email" val={annu.acc.email} isLink={`mailto:${annu.acc.email}`} />}
              {annu.acc.note && <Row label="Note" val={annu.acc.note} />}
            </InfoCard>
          )}

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
        <TimingTab souhait={souhait} peutEditer={can('coordinateur') || personnel.some(p=>p.user_id===profile?.id)} onSave={sauverChamps} />
      )}

      {tab === 'medical' && <MedicalTab souhait={souhait} souhaitDates={souhaitDates} peutEditer={can('coordinateur') || personnel.some(p=>p.user_id===profile?.id)} peutPlan={false} onSave={sauverChamps} />}

      {tab === 'logistique' && (
        <div style={{ maxWidth:920 }}>
          <EquipagesReadOnly equipages={souhait.equipages || []} personnel={personnel} />
        </div>
      )}

      {tab === 'checklist' && (
        <RapportLogistiqueTab souhait={souhait} peutEditer={can('coordinateur') || personnel.some(p=>p.user_id===profile?.id)} estCoordinateur={can('coordinateur')} profileNom={`${profile?.prenom||''} ${profile?.nom||''}`.trim()} onSave={sauverChamps} />
      )}

      {/* Tab Photos */}
      {tab === 'photos' && (
        <PhotosTab souhaitId={id} />
      )}

      {tab === 'rapport' && (
        <RapportTab souhait={souhait} souhaitId={id} rapports={rapports} personnel={personnel} souhaitDates={souhaitDates} peutRediger={peutRediger} estCoordinateur={can('coordinateur')} profile={profile} onSaved={load} rappel={rapportManquant} />
      )}

      <style>{`@media(max-width:800px){ [style*='grid-template-columns: 1fr 1fr']{grid-template-columns:1fr !important;} }`}</style>
    </div>
  )
}

// ── RAPPORT FINAL CONSOLIDÉ ───────────────────────────────────────────────────
const RF_DEPART = [['gps','GPS'],['sac_intervention',"Sac d'intervention"],['sac_dos','Sac à dos'],['sac_confort','Sac confort'],['o2','O2 présent'],['visa_essence','Carte VISA + Essence'],['sn_requis','Matériel « si nécessaire » (SN) requis']]
const RF_PEC = [['consentement','Consentement'],['autorisation_photos','Autorisation photos'],['feuille_traitements','Feuille de traitements'],['traitements_surplus','Traitements avec surplus sécurité'],['protections_sondes','Protections, sondes, sachet à diurèse (SN)']]
const RF_RPEC = [['traitements_surplus_rendu','Traitements en surplus rendu'],['divers_rendu','Divers patients rendu'],['echange_draps','Échange draps / matériel (institution)'],['reprise_materiels','Reprise matériels et sacs']]
const RF_RETOUR = [['plein','Plein du véhicule'],['rangement','Rangement matériel'],['remplacement_materiel','Remplacement matériel pris'],['remise_ordre','Remise en ordre et nettoyage'],['linge_sale','Linge sale dans sac'],['remise_cles','Remise des clés et papiers']]

function rfJour(j){ return j ? new Date(String(j).slice(0,10)+'T00:00:00').toLocaleDateString('fr-BE',{ weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '' }
function Oui({ v }){ return v ? <span style={{ color:'#3B6D11', fontWeight:600 }}>✓ Oui</span> : <span style={{ color:'#A8A39D' }}>✗ Non</span> }

function RFSection({ titre, children }) {
  return (
    <div style={{ marginBottom:18, breakInside:'avoid' }}>
      <div style={{ fontSize:14, fontWeight:700, color:'#0A4A5A', borderBottom:'2px solid #1BB0CE', paddingBottom:4, marginBottom:10 }}>{titre}</div>
      {children}
    </div>
  )
}
function RFRow({ label, children }) {
  return <div style={{ display:'flex', gap:10, padding:'3px 0', fontSize:13 }}><span style={{ minWidth:200, color:'#5A6A6E', fontWeight:500 }}>{label}</span><span style={{ color:'#1A1514' }}>{children}</span></div>
}
function RFValid({ v }) {
  if (!v?.valide) return <span style={{ fontSize:11.5, color:'#BA7517', fontWeight:600 }}>Non validée</span>
  return <span style={{ fontSize:11.5, color:'#3B6D11', fontWeight:600 }}>✓ Validée{v.par?` · ${v.par}`:''}{v.date?` · ${new Date(v.date).toLocaleDateString('fr-BE')} à ${new Date(v.date).toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})}`:''}</span>
}
function RFItems({ obj, champs }) {
  return <>{champs.map(([k,l]) => <RFRow key={k} label={l}><Oui v={obj?.[k]} /></RFRow>)}</>
}
function RFCustom({ items }) {
  const list = Array.isArray(items) ? items.filter(i=>i.label) : []
  if (!list.length) return null
  return list.map((it,i)=><RFRow key={i} label={it.label}><Oui v={it.checked} /></RFRow>)
}
function RFPhotos({ photos, titre }) {
  const cotesAvecPhoto = COTES.filter(([k]) => photoUrl(photos?.[k]))
  if (!cotesAvecPhoto.length) return null
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ fontSize:12.5, fontWeight:600, color:'#5A6A6E', marginBottom:6 }}>{titre}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:14 }}>
        {cotesAvecPhoto.map(([k,lab])=>{
          const ph = normPhoto(photos[k]); const marques = ph.marques||[]
          return (
            <div key={k} style={{ breakInside:'avoid' }}>
              <div style={{ fontSize:11.5, fontWeight:600, color:'#4A4340', marginBottom:3 }}>{lab}{marques.length?` — ${marques.length} dégât(s)`:''}</div>
              <div style={{ position:'relative', width:200 }}>
                <img src={ph.url} alt={lab} style={{ width:200, borderRadius:8, border:'1px solid rgba(0,0,0,.15)', display:'block' }} />
                {marques.map((m,mi)=>(
                  <span key={mi} style={{ position:'absolute', left:`${(m.x||0)*100}%`, top:`${(m.y||0)*100}%`, transform:'translate(-50%,-50%)', width:18, height:18, borderRadius:'50%', background:'#C8435A', color:'white', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid white' }}>{mi+1}</span>
                ))}
              </div>
              {marques.length>0 && (
                <ol style={{ margin:'5px 0 0', paddingLeft:18, fontSize:11.5, color:'#1A1514' }}>
                  {marques.map((m,mi)=><li key={mi}>{m.note || <em style={{ color:'#A8A39D' }}>sans description</em>}</li>)}
                </ol>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
function RFO2({ o2, phase }) {
  const types = O2_TYPES.filter(t => Array.isArray(o2?.[t.type]) && o2[t.type].length)
  if (!types.length) return <div style={{ fontSize:12.5, color:'#A8A39D' }}>Aucune bouteille.</div>
  return types.map(({type,volume}) => (
    <RFRow key={type} label={`${type} (${volume} L) ×${o2[type].length}`}>
      {o2[type].map((b,i)=>{
        const d=parseFloat(b.d), r=parseFloat(b.r)
        const parts=[]
        if(isFinite(d)) parts.push(`départ ${d} bar`)
        if(phase==='retour' && isFinite(r)) parts.push(`retour ${r} bar`)
        if(phase==='retour' && isFinite(d) && isFinite(r)) parts.push(`conso ${(volume*(d-r)).toFixed(0)} L`)
        return <span key={i} style={{ marginRight:10 }}>#{i+1} {parts.join(' · ')||'—'}</span>
      })}
    </RFRow>
  ))
}

function RFTimingRow({ label, prevu, reel, jour, fmtJ }) {
  return (
    <>
      <div style={{ color:'#1A1514' }}>{label}{jour?` (${fmtJ(jour)})`:''}</div>
      <div style={{ color:'#0E7A93', fontWeight:600 }}>{prevu||'—'}</div>
      <div style={{ color: reel?'#3B6D11':'#A8A39D', fontWeight:600 }}>{reel||'—'}</div>
    </>
  )
}

function RapportFinalVue({ souhait, equipages, personnel, rapports }) {
  const r = normRapport(souhait.rapport_logistique, equipages)
  const labelVeh = (e,i) => (e.type==='logistique' ? `Véhicule logistique ${i+1}` : `Ambulance ${i+1}`) + (e.immatriculation ? ` · ${e.immatriculation}` : '')
  const timings = (Array.isArray(souhait.timings)?souhait.timings:[]).filter(t=>t.label)
  const ajouts = Array.isArray(souhait.timings_ajouts)?souhait.timings_ajouts:[]
  const medical = Array.isArray(souhait.rapport_medical)?souhait.rapport_medical:[]
  const fmtJ = (j)=> j? new Date(String(j).slice(0,10)+'T00:00:00').toLocaleDateString('fr-BE',{day:'numeric',month:'short'}) : ''

  const debut = souhait.date_souhait ? String(souhait.date_souhait).slice(0,10) : null
  const fin = (souhait.sur_plusieurs_jours && souhait.date_fin) ? String(souhait.date_fin).slice(0,10) : debut

  return (
    <div style={{ fontFamily:'Arial,Helvetica,sans-serif', color:'#1A1514', maxWidth:760 }}>
      <div style={{ borderBottom:'3px solid #C8435A', paddingBottom:10, marginBottom:18 }}>
        <div style={{ fontSize:12, color:'#C8435A', fontWeight:700, letterSpacing:1 }}>HEART'S ANGELS ASBL</div>
        <div style={{ fontSize:20, fontWeight:700, color:'#0A4A5A' }}>Rapport de réalisation du souhait</div>
        <div style={{ fontSize:13, color:'#5A6A6E', marginTop:4 }}>
          {(souhait.patient_prenom||souhait.patient_nom) ? `${souhait.patient_prenom||''} ${souhait.patient_nom||''}`.trim() : 'Patient'}
          {souhait.etablissement ? ` — ${souhait.etablissement}` : ''}
        </div>
        <div style={{ fontSize:12.5, color:'#7A7470', marginTop:2 }}>
          {debut ? rfJour(debut) : ''}{fin && fin!==debut ? ` → ${rfJour(fin)}` : ''} · Statut : {souhait.statut}
        </div>
      </div>

      {souhait.souhait_description && (
        <RFSection titre="🎯 Le souhait">
          <div style={{ fontSize:13, whiteSpace:'pre-wrap', lineHeight:1.5 }}>{souhait.souhait_description}</div>
          {souhait.souhait_lieu && <div style={{ fontSize:12.5, color:'#5A6A6E', marginTop:4 }}>Lieu : {souhait.souhait_lieu}</div>}
        </RFSection>
      )}

      <RFSection titre="🚑 Équipage(s)">
        {equipages.length===0 ? <div style={{ fontSize:12.5, color:'#A8A39D' }}>Aucun équipage.</div> : equipages.map((e,i)=>{
          const membres = personnel.filter(p=>p.equipage_id===e.id)
          return (
            <div key={e.id} style={{ marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#0E4A5A' }}>{labelVeh(e,i)}</div>
              {membres.length ? membres.map(m=>(
                <div key={m.id} style={{ fontSize:12.5, color:'#1A1514', paddingLeft:10 }}>
                  • {m.profiles?.prenom} {m.profiles?.nom} <span style={{ color:'#7A7470' }}>— {m.profiles?.role?.replace(/_/g,' ')}</span>
                  {e.chauffeur_id===m.user_id ? <span style={{ color:'#0E7A93', fontWeight:600 }}> · chauffeur</span> : ''}
                </div>
              )) : <div style={{ fontSize:12, color:'#A8A39D', paddingLeft:10 }}>Aucun membre affecté.</div>}
            </div>
          )
        })}
      </RFSection>

      <RFSection titre="🕐 Horaires">
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'2px 16px', fontSize:13 }}>
          <div style={{ fontWeight:600, color:'#5A6A6E', fontSize:11.5 }}>Étape</div>
          <div style={{ fontWeight:600, color:'#5A6A6E', fontSize:11.5 }}>Prévu</div>
          <div style={{ fontWeight:600, color:'#5A6A6E', fontSize:11.5 }}>Réel</div>
          {timings.map((t,i)=>(
            <RFTimingRow key={i} label={t.label} prevu={t.heure} reel={t.reel} jour={t.jour} fmtJ={fmtJ} />
          ))}
        </div>
        {ajouts.length>0 && (
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:'#5A6A6E', marginBottom:4 }}>Trajets équipage</div>
            {ajouts.map(a=>(
              <RFRow key={a.id} label={a.label}>Départ {a.depart||'—'} · Arrivée {a.arrivee||'—'}</RFRow>
            ))}
          </div>
        )}
      </RFSection>

      {rapports.length>0 && (
        <RFSection titre="📝 Rapports">
          {[...rapports].sort((a,b)=>String(a.jour||'').localeCompare(String(b.jour||''))).map(rp=>(
            <div key={rp.id} style={{ marginBottom:10, breakInside:'avoid' }}>
              <div style={{ fontSize:12.5, fontWeight:600, color:'#0E4A5A' }}>
                {rp.jour ? rfJour(rp.jour) : 'Rapport général'} — {rp.auteur_nom}{rp.role_auteur?` (${rp.role_auteur.replace(/_/g,' ')})`:''}
              </div>
              {rp.deroulement && <div style={{ fontSize:12.5, whiteSpace:'pre-wrap', lineHeight:1.45 }}><strong>Déroulement : </strong>{rp.deroulement}</div>}
              {rp.etat_patient && <div style={{ fontSize:12.5, whiteSpace:'pre-wrap' }}><strong>État patient : </strong>{rp.etat_patient}</div>}
              {rp.incidents && <div style={{ fontSize:12.5, color:'#A32D2D', whiteSpace:'pre-wrap' }}><strong>Incidents : </strong>{rp.incidents}</div>}
              {rp.observations && <div style={{ fontSize:12.5, whiteSpace:'pre-wrap' }}><strong>Observations : </strong>{rp.observations}</div>}
            </div>
          ))}
        </RFSection>
      )}

      <RFSection titre="🤝 Prise en charge (PEC)">
        <div style={{ marginBottom:4 }}><RFValid v={r.v_pec} /></div>
        <RFItems obj={r.pec} champs={RF_PEC} />
        <RFCustom items={r.pec?.custom} />
        {r.pec?.divers_requis && <RFRow label="Divers requis">{r.pec.divers_requis}</RFRow>}
      </RFSection>
      <RFSection titre="🏠 Retour PEC">
        <div style={{ marginBottom:4 }}><RFValid v={r.v_retour_pec} /></div>
        <RFItems obj={r.retour_pec} champs={RF_RPEC} />
        <RFCustom items={r.retour_pec?.custom} />
      </RFSection>

      {equipages.map((e,i)=>{
        const v = r.vehicules[e.id] || {}
        const base = v.base||{}, ret = v.retour_base||{}
        const kd=parseFloat(base.kms_depart), kr=parseFloat(ret.kms_retour)
        const dist=(isFinite(kd)&&isFinite(kr)&&kr>=kd)?kr-kd:null
        const tickets = Array.isArray(v.tickets)?v.tickets:[]
        const totalE = tickets.reduce((s,t)=>s+(parseFloat(t.montant)||0),0)
        const totalL = tickets.reduce((s,t)=>s+(parseFloat(t.litres)||0),0)
        return (
          <div key={e.id} style={{ marginBottom:6 }}>
            <RFSection titre={`🚗 ${labelVeh(e,i)}`}>
              <div style={{ fontSize:13, fontWeight:600, color:'#0E4A5A', margin:'2px 0' }}>Départ — <RFValid v={v.v_base} /></div>
              <RFRow label="KMs départ">{base.kms_depart||'—'} km</RFRow>
              <RFItems obj={base} champs={RF_DEPART} />
              {base.essence_pct!=null && base.essence_pct!=='' && <RFRow label="Jauge carburant">{base.essence_pct}%</RFRow>}
              <RFCustom items={base.custom} />
              {base.degats && <RFRow label="Dégâts au départ">{base.degats}</RFRow>}
              <RFPhotos photos={base.photos} titre="📸 Photos départ + dégâts" />
              <div style={{ marginTop:6 }}><div style={{ fontSize:12.5, fontWeight:600, color:'#5A6A6E' }}>🫁 O2 départ</div><RFO2 o2={v.o2} phase="depart" /></div>

              <div style={{ fontSize:13, fontWeight:600, color:'#0E4A5A', margin:'10px 0 2px' }}>Retour — <RFValid v={v.v_retour} /></div>
              <RFRow label="KMs retour">{ret.kms_retour||'—'} km{dist!=null?` (distance ${dist} km)`:''}</RFRow>
              <RFItems obj={ret} champs={RF_RETOUR} />
              <RFCustom items={ret.custom} />
              {ret.degats_mission && <RFRow label="Dégâts durant la mission">{ret.degats_mission}</RFRow>}
              {ret.materiels_utilises && <RFRow label="Matériels utilisés">{ret.materiels_utilises}</RFRow>}
              <RFPhotos photos={ret.photos} titre="📸 Photos retour + dégâts" />
              <div style={{ marginTop:6 }}><div style={{ fontSize:12.5, fontWeight:600, color:'#5A6A6E' }}>🫁 O2 retour</div><RFO2 o2={v.o2} phase="retour" /></div>

              {tickets.length>0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:12.5, fontWeight:600, color:'#5A6A6E' }}>⛽ Tickets carburant ({tickets.length}) — {totalE.toFixed(2)} € · {totalL.toFixed(1)} L</div>
                  {tickets.map((t,ti)=>(
                    <RFRow key={ti} label={t.station||`Ticket ${ti+1}`}>{(parseFloat(t.montant)||0).toFixed(2)} € · {(parseFloat(t.litres)||0).toFixed(1)} L{t.date?` · ${t.date}`:''}</RFRow>
                  ))}
                </div>
              )}
            </RFSection>
          </div>
        )
      })}

      {medical.length>0 && (
        <RFSection titre="🏥 Rapport médical">
          {medical.map((l,i)=>(
            <div key={i} style={{ fontSize:12.5, padding:'2px 0' }}>{l.heure?<strong>{l.heure} — </strong>:''}{l.texte||l.contenu||''}</div>
          ))}
        </RFSection>
      )}

      {(() => {
        const traits = (souhait.traitements||[]).map(normTrait)
        const tMap = Object.fromEntries(traits.map(t=>[t.id, t]))
        const adm = souhait.traitements_administres || {}
        const snL = Array.isArray(souhait.traitements_sn_log) ? souhait.traitements_sn_log : []
        const parJour = {}
        const push = (j, o) => { (parJour[j] = parJour[j] || []).push(o) }
        const lib = (t) => `${t.nom}${t.dosage?` · ${t.dosage}`:''}${t.debit?` · ${t.debit}`:''} (${VOIE_LABEL[t.voie]||t.voie}`
        Object.entries(adm).forEach(([k,v]) => {
          if (!v) return
          const [j, medId, h] = k.split('|')
          const t = tMap[medId]; if (!t) return
          if (h === 'perf') {
            const d = Math.min(t.perf_debut, t.perf_fin), f = Math.max(t.perf_debut, t.perf_fin)
            push(j, { ordre: d, txt: `${lib(t)}) — perfusion posée ${d}h→${f}h` })
          } else {
            push(j, { ordre: Number(h), txt: `${h}h — ${lib(t)})` })
          }
        })
        snL.forEach(p => {
          const t = tMap[p.medId]; if (!t) return
          push(p.jour, { ordre: parseInt(p.heure,10)||0, txt: `${p.heure} — ${lib(t)} · si nécessaire)` })
        })
        const joursAdm = Object.keys(parJour).sort()
        if (!joursAdm.length) return null
        return (
          <RFSection titre="💊 Médicaments administrés">
            {joursAdm.map(j=>(
              <div key={j} style={{ marginBottom:8 }}>
                {joursAdm.length>1 && <div style={{ fontSize:12, fontWeight:700, color:'#0E4A5A', marginBottom:2 }}>{fmtJ(j)}</div>}
                {parJour[j].sort((a,b)=>a.ordre-b.ordre).map((m,i)=>(
                  <div key={i} style={{ fontSize:12.5, padding:'2px 0' }}>{m.txt}</div>
                ))}
              </div>
            ))}
          </RFSection>
        )
      })()}

      <div style={{ marginTop:20, fontSize:10.5, color:'#A8A39D', borderTop:'1px solid #ddd', paddingTop:6 }}>
        Document généré automatiquement — Heart's Angels ASBL · {new Date().toLocaleString('fr-BE')}
      </div>
    </div>
  )
}

function imprimerRapport(elId) {
  const el = document.getElementById(elId)
  if (!el) return
  const w = window.open('', '_blank')
  if (!w) { alert('Autorisez les pop-ups pour générer le PDF.'); return }
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport Heart's Angels</title>
    <style>*{box-sizing:border-box}body{margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1A1514}img{max-width:100%}@page{margin:14mm}@media print{body{padding:0}}</style>
    </head><body>${el.innerHTML}</body></html>`)
  w.document.close(); w.focus()
  setTimeout(()=>{ try { w.print() } catch(e){} }, 700)
}

function RapportTab({ souhait, souhaitId, rapports, personnel = [], souhaitDates = [], peutRediger, estCoordinateur = false, profile, onSaved, rappel }) {
  const [form, setForm] = useState({ deroulement:'', etat_patient:'', incidents:'', observations:'' })
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [voirFinal, setVoirFinal] = useState(souhait.statut === 'realise')
  const equipages = souhait.equipages || []
  const elId = 'rapport-final-' + souhaitId

  // Jours de la mission
  const ymd = d => { const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}` }
  const expand = (deb, fin) => { const out=[]; const a=new Date(deb+'T00:00:00'), b=new Date((fin||deb)+'T00:00:00'); for(let t=new Date(a); t<=b; t.setDate(t.getDate()+1)) out.push(ymd(t)); return out }
  const jours = (() => {
    if (souhait?.date_souhait) {
      const deb = String(souhait.date_souhait).slice(0,10)
      const fin = (souhait?.sur_plusieurs_jours && souhait?.date_fin) ? String(souhait.date_fin).slice(0,10) : deb
      return expand(deb, fin)
    }
    // sinon : date confirmée parmi les dates possibles
    const conf = souhaitDates.find(d => d.confirmee) || (souhaitDates.length === 1 ? souhaitDates[0] : null)
    if (conf?.date_proposee) {
      const deb = String(conf.date_proposee).slice(0,10)
      const fin = (conf.plusieurs_jours && conf.date_fin_proposee) ? String(conf.date_fin_proposee).slice(0,10) : deb
      return expand(deb, fin)
    }
    return []
  })()
  const multiJour = jours.length > 1
  const today = ymd(new Date())
  const [jourSel, setJourSel] = useState(null)
  const jourActif = jourSel || (multiJour ? (jours.includes(today) ? today : jours[0]) : (jours[0] || null))
  const fmtJ = (j) => j ? new Date(j+'T00:00:00').toLocaleDateString('fr-BE',{ weekday:'short', day:'numeric', month:'short' }) : 'Général'

  async function enregistrer() {
    if (!form.deroulement.trim()) return
    setSaving(true)
    await supabase.from('souhait_rapports').insert({
      souhait_id: souhaitId,
      profile_id: profile?.id,
      auteur_nom: `${profile?.prenom||''} ${profile?.nom||''}`.trim(),
      role_auteur: profile?.role || null,
      jour: multiJour ? jourActif : (jours[0] || null),
      deroulement: form.deroulement,
      etat_patient: form.etat_patient || null,
      incidents: form.incidents || null,
      observations: form.observations || null,
    })
    setSaving(false); setOpen(false)
    setForm({ deroulement:'', etat_patient:'', incidents:'', observations:'' })
    onSaved && onSaved()
  }

  async function supprimer(rapId) {
    if (!confirm('Supprimer ce rapport ? Cette action est définitive.')) return
    await supabase.from('souhait_rapports').delete().eq('id', rapId)
    onSaved && onSaved()
  }
  const peutSupprimer = (rp) => peutRediger && (rp.profile_id === profile?.id || estCoordinateur)

  const visibles = multiJour
    ? rapports.filter(r => (r.jour ? String(r.jour).slice(0,10) === jourActif : true))
    : rapports

  const TA = { width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.12)', borderRadius:8, fontSize:13.5, fontFamily:'DM Sans,sans-serif', resize:'vertical', marginBottom:10 }
  const L = { fontSize:12.5, fontWeight:600, color:'#0E4A5A', display:'block', marginBottom:4 }

  return (
    <div style={{ maxWidth:760 }}>
      {/* Rapport final consolidé */}
      <div style={{ background:'#F0F9FB', border:'1px solid rgba(27,176,206,.2)', borderRadius:12, padding:'14px 16px', marginBottom:18 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#0A4A5A' }}>📄 Rapport final consolidé</div>
            <div style={{ fontSize:12, color:'#5A6A6E' }}>Reprend infos, horaires (prévu/réel), rapports, check-listes, O2, carburant, photos + dégâts et rapport médical.</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={()=>setVoirFinal(v=>!v)} style={{ padding:'8px 14px', background:'white', color:'#0E7A93', border:'1px solid rgba(14,122,147,.3)', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>{voirFinal?'Masquer':'Aperçu'}</button>
            <button onClick={()=>{ setVoirFinal(true); setTimeout(()=>imprimerRapport(elId), 60) }} style={{ padding:'8px 16px', background:'#C8435A', color:'white', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>⬇️ Télécharger le PDF</button>
          </div>
        </div>
        {voirFinal && (
          <div style={{ marginTop:14, background:'white', border:'1px solid rgba(0,0,0,.08)', borderRadius:10, padding:'18px 20px', overflowX:'auto' }}>
            <div id={elId}>
              <RapportFinalVue souhait={souhait} equipages={equipages} personnel={personnel} rapports={rapports} />
            </div>
          </div>
        )}
      </div>

      {rappel && (
        <div style={{ background:'#FCEBEB', border:'1px solid #F0C9C9', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13.5, color:'#A32D2D' }}>
          ⚠️ Ce souhait est réalisé : un rapport de réalisation est attendu de votre part (infirmier/médecin).
        </div>
      )}

      {multiJour && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12.5, fontWeight:600, color:'#0E4A5A', marginBottom:6 }}>📅 Rapport journalier — choisissez le jour</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {jours.map(j => {
              const aRapport = rapports.some(r => r.jour && String(r.jour).slice(0,10) === j)
              return (
                <button key={j} onClick={()=>setJourSel(j)} style={{ padding:'7px 12px', borderRadius:99, border:'none', cursor:'pointer', fontSize:12.5, fontWeight:600, fontFamily:'DM Sans,sans-serif', background: j===jourActif?'#C8435A':'#F0F4F5', color: j===jourActif?'white':'#5A6A6E' }}>
                  {fmtJ(j)} {aRapport ? '✓' : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Rapports (du jour sélectionné si multi-jours) */}
      {visibles.length === 0 ? (
        <div style={{ fontSize:13.5, color:'#A8A39D', marginBottom:16 }}>Aucun rapport {multiJour ? `pour le ${fmtJ(jourActif)}` : ''} pour le moment.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:18 }}>
          {visibles.map(r => (
            <div key={r.id} style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, flexWrap:'wrap', gap:6 }}>
                <span style={{ fontSize:13.5, fontWeight:600, color:'#0E4A5A' }}>{r.auteur_nom} {r.role_auteur ? `· ${r.role_auteur.replace(/_/g,' ')}` : ''}{r.jour && multiJour ? ` · ${fmtJ(String(r.jour).slice(0,10))}` : ''}</span>
                <span style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:12, color:'#A8A39D' }}>{new Date(r.created_at).toLocaleString('fr-BE')}</span>
                  {peutSupprimer(r) && <button onClick={()=>supprimer(r.id)} title="Supprimer ce rapport" style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'3px 8px', fontSize:12, cursor:'pointer' }}>🗑️</button>}
                </span>
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
            <div style={{ fontSize:14, fontWeight:600, color:'#0E4A5A', marginBottom:12 }}>Nouveau rapport {multiJour ? `— ${fmtJ(jourActif)}` : ''}</div>
            <label style={L}>Déroulement {multiJour ? 'de la journée' : 'de la sortie'} *</label>
            <textarea rows={4} value={form.deroulement} onChange={e=>setForm(f=>({...f,deroulement:e.target.value}))} style={TA} placeholder="Résumé du déroulement…" />
            <label style={L}>État du patient</label>
            <textarea rows={2} value={form.etat_patient} onChange={e=>setForm(f=>({...f,etat_patient:e.target.value}))} style={TA} placeholder="État général, évolution…" />
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
          <button onClick={()=>setOpen(true)} style={{ padding:'10px 18px', background:'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>📝 Rédiger un rapport {multiJour ? `pour le ${fmtJ(jourActif)}` : ''}</button>
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

function MedicalTab({ souhait, souhaitDates = [], peutEditer, peutPlan, onSave }) {
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
          <TraitementsSection souhait={s} souhaitDates={souhaitDates} peutPlan={peutPlan} peutCocher={peutEditer} onSave={onSave} />
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

function joursSouhait(s, dates = []) {
  let debut = s.date_souhait ? String(s.date_souhait).slice(0,10) : null
  let fin = (s.sur_plusieurs_jours && s.date_fin) ? String(s.date_fin).slice(0,10) : debut
  if (!debut && Array.isArray(dates) && dates.length) {
    const conf = dates.find(d => d.confirmee) || [...dates].sort((a,b)=>String(a.date_proposee).localeCompare(String(b.date_proposee)))[0]
    if (conf?.date_proposee) {
      debut = String(conf.date_proposee).slice(0,10)
      fin = (conf.plusieurs_jours && conf.date_fin_proposee) ? String(conf.date_fin_proposee).slice(0,10) : debut
    }
  }
  if (!debut) return []
  const out = []; const d = new Date(debut+'T00:00:00'); const end = new Date((fin||debut)+'T00:00:00')
  let guard = 0
  while (d <= end && guard < 60) {
    out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
    d.setDate(d.getDate()+1); guard++
  }
  return out
}
// Normalise un traitement (compat anciens formats string / horaires 'HH:MM')
function normTrait(t, i) {
  if (typeof t === 'string') return { id:'t'+i, nom:t, type:'office', voie:'PO', dosage:'', debit:'', consignes:'', heures:[], perfusion:false, perf_debut:null, perf_fin:null, max_jour:null }
  const heures = Array.isArray(t.heures) ? t.heures.map(Number).filter(n=>!isNaN(n))
    : Array.isArray(t.horaires) ? t.horaires.map(h=>parseInt(String(h),10)).filter(n=>!isNaN(n)) : []
  return {
    id: t.id||('t'+i), nom: t.nom||'', type: t.type||'office',
    voie: t.voie||'PO', dosage: (t.dosage ?? t.posologie ?? ''), debit: t.debit||'',
    consignes: (t.consignes ?? t.condition ?? ''),
    heures, perfusion: !!t.perfusion,
    perf_debut: (t.perf_debut===0||t.perf_debut)? t.perf_debut : null,
    perf_fin: (t.perf_fin===0||t.perf_fin)? t.perf_fin : null,
    max_jour: (t.max_jour===0||t.max_jour)? t.max_jour : null,
  }
}

function TraitementsSection({ souhait, souhaitDates = [], peutPlan, peutCocher, onSave }) {
  const [mode, setMode] = useState('chart')  // 'chart' | 'edit'
  const traitements = (souhait.traitements||[]).map(normTrait)
  const jours = joursSouhait(souhait, souhaitDates)

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
        : <TraitementsChart traitements={traitements} jours={jours} administres={souhait.traitements_administres||{}} snLog={souhait.traitements_sn_log||[]} peutCocher={peutCocher} onSave={onSave} />
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

function TraitementsChart({ traitements, jours, administres, snLog = [], peutCocher, onSave }) {
  const [jour, setJour] = useState(jours[0] || null)
  useEffect(()=>{ if (!jour && jours.length) setJour(jours[0]) }, [jours])
  const [adm, setAdm] = useState(administres || {})
  const [snAdm, setSnAdm] = useState(snLog || [])
  useEffect(()=>{ setAdm(administres||{}) }, [administres])
  useEffect(()=>{ setSnAdm(snLog||[]) }, [snLog])

  if (traitements.length === 0) return <Vide />

  const office = traitements.filter(t => t.type !== 'si_necessaire')
  const sn = traitements.filter(t => t.type === 'si_necessaire')
  const HEURES = Array.from({ length:24 }, (_,h)=>h)

  const nowHM = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
  async function toggle(medId, h) {
    if (!peutCocher || !jour) return
    const key = `${jour}|${medId}|${h}`
    const next = { ...adm, [key]: !adm[key] }
    if (!next[key]) delete next[key]
    setAdm(next); await onSave({ traitements_administres: next })
  }
  async function togglePerf(medId) {
    if (!peutCocher || !jour) return
    const key = `${jour}|${medId}|perf`
    const next = { ...adm, [key]: !adm[key] }
    if (!next[key]) delete next[key]
    setAdm(next); await onSave({ traitements_administres: next })
  }
  async function ajouterSN(medId) {
    if (!peutCocher || !jour) return
    const next = [...snAdm, { jour, medId, heure: nowHM() }]
    setSnAdm(next); await onSave({ traitements_sn_log: next })
  }
  async function retirerSN(p) {
    const next = snAdm.filter(x => !(x.jour===p.jour && x.medId===p.medId && x.heure===p.heure))
    setSnAdm(next); await onSave({ traitements_sn_log: next })
  }
  const pmin = (t)=>Math.min(t.perf_debut, t.perf_fin), pmax = (t)=>Math.max(t.perf_debut, t.perf_fin)
  const inRange = (t,h) => t.perfusion && t.perf_debut!=null && t.perf_fin!=null && h>=pmin(t) && h<=pmax(t)

  const TH = { padding:'5px 0', fontSize:10.5, fontWeight:700, color:'#7A7470', textAlign:'center', borderBottom:'1px solid rgba(0,0,0,.1)', minWidth:26 }
  const LEFT = { position:'sticky', left:0, background:'white', zIndex:2, padding:'8px 10px', borderRight:'1px solid rgba(0,0,0,.08)', minWidth:170, maxWidth:200 }

  return (
    <div>
      {jours.length > 1 && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12 }}>
          {jours.map(j=>(
            <button key={j} onClick={()=>setJour(j)} style={{ padding:'5px 11px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif", background: j===jour?'#0E7A93':'#F0F9FB', color: j===jour?'white':'#0E7A93' }}>
              {new Date(j+'T00:00:00').toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'})}
            </button>
          ))}
        </div>
      )}
      {jour && peutCocher
        ? <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:8 }}>Cliquez l'heure pour marquer une prise administrée le {new Date(jour+'T00:00:00').toLocaleDateString('fr-BE')}.</div>
        : !jour && <div style={{ fontSize:12, color:'#BA7517', marginBottom:8 }}>Aucune date définie pour ce souhait — le pointage sera possible une fois la date connue.</div>}

      {office.length > 0 && (
        <div style={{ overflowX:'auto', border:'1px solid rgba(0,0,0,.08)', borderRadius:10 }}>
          <table style={{ borderCollapse:'collapse', width:'100%' }}>
            <thead><tr>
              <th style={{ ...LEFT, ...TH, textAlign:'left', minWidth:170 }}>Médicament</th>
              {HEURES.map(h=><th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {office.map(t=>{
                const perfDone = !!adm[`${jour}|${t.id}|perf`]
                return (
                  <tr key={t.id}>
                    <td style={LEFT}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1A1514' }}>{t.nom || '—'}{t.perfusion && <span style={{ fontSize:10.5, color:'#0E7A93', fontWeight:600 }}> · perfusion</span>}</div>
                      <div style={{ fontSize:11, color:'#7A7470' }}>{VOIE_LABEL[t.voie]||t.voie}{t.dosage?` · ${t.dosage}`:''}{t.debit?` · ${t.debit}`:''}</div>
                      {t.consignes && <div style={{ fontSize:10.5, color:'#7A7470', fontStyle:'italic' }}>{t.consignes}</div>}
                    </td>
                    {HEURES.map(h=>{
                      if (t.perfusion) {
                        if (!inRange(t,h)) return <td key={h} style={{ borderBottom:'1px solid rgba(0,0,0,.04)' }} />
                        const isStart = h===pmin(t), isEnd = h===pmax(t)
                        return (
                          <td key={h} onClick={()=>togglePerf(t.id)} title={perfDone?'Perfusion posée — cliquer pour annuler':'Cliquer pour marquer la perfusion posée'}
                            style={{ padding:'0 0', borderBottom:'1px solid rgba(0,0,0,.04)', cursor:peutCocher&&jour?'pointer':'default', verticalAlign:'middle' }}>
                            <div style={{ height:12, background: perfDone?'#3B6D11':'#1BB0CE',
                              marginLeft:isStart?3:0, marginRight:isEnd?3:0,
                              borderTopLeftRadius:isStart?6:0, borderBottomLeftRadius:isStart?6:0,
                              borderTopRightRadius:isEnd?6:0, borderBottomRightRadius:isEnd?6:0 }} />
                          </td>
                        )
                      }
                      const prevu = t.heures.includes(h)
                      const key = `${jour}|${t.id}|${h}`
                      const coche = !!adm[key]
                      return (
                        <td key={h} style={{ padding:3, textAlign:'center', borderBottom:'1px solid rgba(0,0,0,.04)' }}>
                          {prevu ? (
                            <button onClick={()=>toggle(t.id,h)} disabled={!peutCocher||!jour} title={coche?'Administré — cliquer pour décocher':'Cliquer pour marquer administré'}
                              style={{ width:24, height:24, borderRadius:6, cursor:peutCocher&&jour?'pointer':'default',
                                border:`1.5px solid ${coche?'#3B6D11':'#C8C3BD'}`, background:coche?'#3B6D11':'white',
                                color:coche?'white':'#C8C3BD', fontSize:13, fontWeight:700, lineHeight:1, padding:0 }}>
                              {coche?'✓':''}
                            </button>
                          ) : <span style={{ color:'#E2DED8' }}>·</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Si nécessaire */}
      {sn.length > 0 && (
        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#BA7517', marginBottom:6 }}>⚡ Si nécessaire</div>
          {sn.map(t=>{
            const prises = snAdm.filter(x => x.jour===jour && x.medId===t.id).sort((a,b)=>a.heure.localeCompare(b.heure))
            const donne = prises.length > 0
            const max = (t.max_jour!=null && t.max_jour!=='') ? Number(t.max_jour) : null
            const atteint = max!=null && prises.length>=max
            return (
              <div key={t.id} style={{ padding:'9px 11px', background: donne?'#EAF3DE':'#FAEEDA', border:`1px solid ${donne?'#3B6D11':'rgba(186,117,23,.25)'}`, borderRadius:8, marginBottom:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start', flexWrap:'wrap' }}>
                  <span style={{ fontSize:12.5 }}>
                    <span style={{ fontWeight:600, color:'#1A1514' }}>{t.nom}</span>
                    <span style={{ color:'#7A7470' }}> · {VOIE_LABEL[t.voie]||t.voie}{t.dosage?` · ${t.dosage}`:''}{t.debit?` · ${t.debit}`:''}</span>
                    {t.consignes && <span style={{ color:'#7A5512', fontStyle:'italic' }}> — {t.consignes}</span>}
                    {max!=null && <span style={{ color:'#7A7470' }}> · max {max}×/j ({prises.length} pris)</span>}
                  </span>
                  {peutCocher && jour && (
                    <button onClick={()=>ajouterSN(t.id)} disabled={atteint} title={atteint?'Maximum journalier atteint':''}
                      style={{ flexShrink:0, padding:'5px 10px', borderRadius:7, border:'none', cursor:atteint?'not-allowed':'pointer', opacity:atteint?.5:1, fontSize:11.5, fontWeight:600, fontFamily:"'DM Sans',sans-serif", background:'#3B6D11', color:'white' }}>💊 Administré maintenant</button>
                  )}
                </div>
                {donne && (
                  <div style={{ marginTop:7, display:'flex', flexWrap:'wrap', gap:6 }}>
                    {prises.map((p,idx)=>(
                      <span key={idx} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'white', border:'1px solid #3B6D11', color:'#3B6D11', borderRadius:99, padding:'2px 9px', fontSize:11.5, fontWeight:600 }}>
                        ✓ donné à {p.heure}
                        {peutCocher && <button onClick={()=>retirerSN(p)} title="Retirer cette prise" style={{ background:'none', border:'none', color:'#C8435A', cursor:'pointer', fontSize:13, padding:0, lineHeight:1 }}>✕</button>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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

function RapportLogistiqueTab({ souhait, peutEditer, estCoordinateur, profileNom, onSave }) {
  const equipages = souhait.equipages || []
  const [r, setR] = useState(() => normRapport(souhait.rapport_logistique, equipages))
  const [selEq, setSelEq] = useState(equipages[0]?.id || null)
  const [sous, setSous] = useState('depart')   // depart | pec | rpec | retour
  useEffect(()=>{ setR(normRapport(souhait.rapport_logistique, equipages)) }, [souhait.rapport_logistique, JSON.stringify(equipages.map(e=>e.id))])

  const clone = (o) => JSON.parse(JSON.stringify(o))
  const apply = (next) => { setR(next); onSave({ rapport_logistique: next }) }
  const updVeh = (eqId, sec, k, v) => { const n = clone(r); n.vehicules[eqId][sec] = { ...n.vehicules[eqId][sec], [k]:v }; apply(n) }
  const setVehSection = (eqId, sec, val) => { const n = clone(r); n.vehicules[eqId][sec] = val; apply(n) }
  const updShared = (sec, k, v) => { const n = clone(r); n[sec] = { ...n[sec], [k]:v }; apply(n) }
  const validerVeh = (eqId, which) => { const n = clone(r); n.vehicules[eqId][which] = { valide:true, par:profileNom, date:new Date().toISOString() }; apply(n) }
  const validerShared = (which) => { const n = clone(r); n[which] = { valide:true, par:profileNom, date:new Date().toISOString() }; apply(n) }

  if (equipages.length === 0) {
    return <div style={{ fontSize:13.5, color:'#A8A39D', fontStyle:'italic', padding:'10px 0' }}>Définissez d'abord les équipages dans le formulaire (étape Logistique) — les check-listes se remplissent par véhicule.</div>
  }

  // Verrouillage séquentiel : chaque étape attend la validation de la précédente
  const tousDepartsValides = equipages.every(e => r.vehicules[e.id]?.v_base?.valide)
  const pecOuvert    = tousDepartsValides           // PEC après tous les départs
  const rpecOuvert   = !!r.v_pec?.valide             // Retour PEC après PEC
  const retourOuvert = !!r.v_retour_pec?.valide      // Retour après Retour PEC
  const eq = equipages.find(e => e.id === selEq) || equipages[0]
  const veh = r.vehicules[eq.id]
  const labelVeh = (e,i) => (e.type==='logistique' ? `🚐 Logistique ${i+1}` : `🚑 Ambulance ${i+1}`) + (e.immatriculation ? ` · ${e.immatriculation}` : '')

  // éditable = a le droit, étape ouverte, et (pas encore validé OU coordinateur)
  const editable = (validee, ouvert=true) => peutEditer && ouvert && (!validee || estCoordinateur)
  const idx = equipages.findIndex(e=>e.id===eq.id)

  const baseEdit   = editable(veh.v_base?.valide)
  const pecEdit    = editable(r.v_pec?.valide, pecOuvert)
  const rpecEdit   = editable(r.v_retour_pec?.valide, rpecOuvert)
  const retourEdit = editable(veh.v_retour?.valide, retourOuvert)
  const ticketsEdit = peutEditer && (!veh.v_retour?.valide || estCoordinateur)

  const kd = parseFloat(veh.base.kms_depart), kr = parseFloat(veh.retour_base.kms_retour)
  const distance = (isFinite(kd) && isFinite(kr) && kr >= kd) ? (kr - kd) : null

  const baseComplet = photos4ok(veh.base.photos)
  const retourComplet = photos4ok(veh.retour_base.photos)

  const TABS = [
    { id:'depart', label:'🚀 Départ', lock:false },
    { id:'pec',    label:'🤝 PEC',    lock:!pecOuvert },
    { id:'rpec',   label:'🏠 Retour PEC', lock:!rpecOuvert },
    { id:'retour', label:'🔧 Retour', lock:!retourOuvert },
    { id:'carburant', label:'⛽ Carburant', lock:false },
  ]
  const RAISON = { pec:'Validez d\'abord la check-liste de départ de tous les véhicules.', rpec:'Validez d\'abord la check-liste PEC.', retour:'Validez d\'abord la check-liste Retour PEC.' }

  return (
    <div style={{ maxWidth:760 }}>
      {/* Sélecteur de véhicule */}
      {equipages.length > 1 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
          {equipages.map((e,i)=>(
            <button key={e.id} onClick={()=>setSelEq(e.id)} style={{ padding:'7px 13px', borderRadius:99, border:'none', cursor:'pointer', fontSize:12.5, fontWeight:600, fontFamily:"'DM Sans',sans-serif", background: e.id===eq.id?'#0E4A5A':'#F0F4F5', color: e.id===eq.id?'white':'#5A6A6E' }}>
              {labelVeh(e,i)}
            </button>
          ))}
        </div>
      )}

      {/* Onglets d'étapes */}
      <div style={{ display:'flex', gap:4, marginBottom:18, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setSous(t.id)}
            style={{ padding:'7px 13px', borderRadius:99, border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
              background: sous===t.id ? '#0E4A5A' : '#F0F4F5', color: sous===t.id ? 'white' : (t.lock ? '#A8A39D' : '#5A6A6E'),
              fontWeight: sous===t.id?600:500, fontSize:12.5, display:'flex', alignItems:'center', gap:5 }}>
            {t.label} {t.lock && <span style={{ fontSize:11 }}>🔒</span>}
          </button>
        ))}
      </div>

      {/* DÉPART (véhicule) */}
      {sous === 'depart' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <RLCard titre={`Checklist départ — ${labelVeh(eq, idx)}`}>
            <ValidBar v={veh.v_base} canValider={baseEdit && !veh.v_base?.valide && baseComplet} onValider={()=>validerVeh(eq.id,'v_base')} estCoord={estCoordinateur} bloqueMsg={baseEdit && !veh.v_base?.valide && !baseComplet ? 'Prenez les 4 photos du véhicule avant de valider.' : null} />
            <RLNum label="KMs départ" value={veh.base.kms_depart} onChange={v=>updVeh(eq.id,'base','kms_depart',v)} peutEditer={baseEdit} unit="km" />
            <RLChk label="GPS" checked={veh.base.gps} onChange={v=>updVeh(eq.id,'base','gps',v)} peutEditer={baseEdit} />
            <RLChk label="Sac d'intervention" checked={veh.base.sac_intervention} onChange={v=>updVeh(eq.id,'base','sac_intervention',v)} peutEditer={baseEdit} />
            <RLChk label="Sac à dos" checked={veh.base.sac_dos} onChange={v=>updVeh(eq.id,'base','sac_dos',v)} peutEditer={baseEdit} />
            <RLChk label="Sac confort" checked={veh.base.sac_confort} onChange={v=>updVeh(eq.id,'base','sac_confort',v)} peutEditer={baseEdit} />
            <RLChk label="O2 présent" checked={veh.base.o2} onChange={v=>updVeh(eq.id,'base','o2',v)} peutEditer={baseEdit} />
            <RLChk label="Carte VISA + Essence" checked={veh.base.visa_essence} onChange={v=>updVeh(eq.id,'base','visa_essence',v)} peutEditer={baseEdit} />
            <JaugeCarburant value={veh.base.essence_pct} onChange={v=>updVeh(eq.id,'base','essence_pct',v)} peutEditer={baseEdit} />
            <RLChk label="Matériel « si nécessaire » (SN) requis" checked={veh.base.sn_requis} onChange={v=>updVeh(eq.id,'base','sn_requis',v)} peutEditer={baseEdit} />
            <CustomItems items={veh.base.custom} editable={baseEdit} estCoord={estCoordinateur} onChange={(items)=>updVeh(eq.id,'base','custom',items)} />
            <RLTxt label="Dégâts véhicule ou pannes (au départ)" value={veh.base.degats} onChange={v=>updVeh(eq.id,'base','degats',v)} peutEditer={baseEdit} />
            <PhotosVehicule souhaitId={souhait.id} dossier="vehicule-depart" photos={veh.base.photos} editable={baseEdit} onChange={(p)=>updVeh(eq.id,'base','photos',p)} />
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#0E4A5A', marginBottom:4 }}>🫁 Bouteilles O2 (départ)</div>
              <O2Section value={veh.o2} editable={baseEdit} phase="depart" onChange={(o2)=>setVehSection(eq.id,'o2',o2)} />
            </div>
          </RLCard>
        </div>
      )}

      {/* PEC (patient) */}
      {sous === 'pec' && (
        <RLCard titre="Checklist PEC (patient)">
          <ValidBar v={r.v_pec} canValider={pecEdit && !r.v_pec?.valide} onValider={()=>validerShared('v_pec')} estCoord={estCoordinateur} />
          <RLChk label="Consentement" checked={r.pec.consentement} onChange={v=>updShared('pec','consentement',v)} peutEditer={pecEdit} />
          <RLChk label="Autorisation photos" checked={r.pec.autorisation_photos} onChange={v=>updShared('pec','autorisation_photos',v)} peutEditer={pecEdit} />
          <RLChk label="Feuille de traitements" checked={r.pec.feuille_traitements} onChange={v=>updShared('pec','feuille_traitements',v)} peutEditer={pecEdit} />
          <RLChk label="Traitements avec surplus sécurité" checked={r.pec.traitements_surplus} onChange={v=>updShared('pec','traitements_surplus',v)} peutEditer={pecEdit} />
          <RLChk label="Protections, sondes et sachet à diurèse (SN)" checked={r.pec.protections_sondes} onChange={v=>updShared('pec','protections_sondes',v)} peutEditer={pecEdit} />
          <CustomItems items={r.pec.custom} editable={pecEdit} estCoord={estCoordinateur} onChange={(items)=>updShared('pec','custom',items)} />
          <RLTxt label="Divers requis" value={r.pec.divers_requis} onChange={v=>updShared('pec','divers_requis',v)} peutEditer={pecEdit} />
        </RLCard>
      )}

      {/* Bandeau verrou de l'étape courante */}
      {TABS.find(t=>t.id===sous)?.lock && (
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#FCEBEB', color:'#A32D2D', border:'1px solid rgba(163,45,45,.2)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12.5, fontWeight:600 }}>
          🔒 {RAISON[sous]}
        </div>
      )}

      {/* RETOUR PEC (patient) */}
      {sous === 'rpec' && (
        <RLCard titre="Checklist Retour PEC (patient)">
          <ValidBar v={r.v_retour_pec} canValider={rpecEdit && !r.v_retour_pec?.valide} onValider={()=>validerShared('v_retour_pec')} estCoord={estCoordinateur} />
          <RLChk label="Traitements en surplus rendu" checked={r.retour_pec.traitements_surplus_rendu} onChange={v=>updShared('retour_pec','traitements_surplus_rendu',v)} peutEditer={rpecEdit} />
          <RLChk label="Divers patients rendu" checked={r.retour_pec.divers_rendu} onChange={v=>updShared('retour_pec','divers_rendu',v)} peutEditer={rpecEdit} />
          <RLChk label="Si institution, échange draps, matériel utilisé" checked={r.retour_pec.echange_draps} onChange={v=>updShared('retour_pec','echange_draps',v)} peutEditer={rpecEdit} />
          <RLChk label="Reprise matériels et sacs" checked={r.retour_pec.reprise_materiels} onChange={v=>updShared('retour_pec','reprise_materiels',v)} peutEditer={rpecEdit} />
          <CustomItems items={r.retour_pec.custom} editable={rpecEdit} estCoord={estCoordinateur} onChange={(items)=>updShared('retour_pec','custom',items)} />
        </RLCard>
      )}

      {/* RETOUR (véhicule) */}
      {sous === 'retour' && (
        <RLCard titre={`Checklist retour — ${labelVeh(eq, idx)}`}>
          <ValidBar v={veh.v_retour} canValider={retourEdit && !veh.v_retour?.valide && retourComplet} onValider={()=>validerVeh(eq.id,'v_retour')} estCoord={estCoordinateur} bloqueMsg={retourEdit && !veh.v_retour?.valide && !retourComplet ? 'Prenez les 4 photos du véhicule avant de valider.' : null} />
          <RLNum label="KMs retour" unit="km" value={veh.retour_base.kms_retour} onChange={v=>updVeh(eq.id,'retour_base','kms_retour',v)} peutEditer={retourEdit} />
          {distance != null && <div style={{ fontSize:12.5, fontWeight:600, color:'#0E7A93', padding:'3px 0 6px' }}>🛣️ Distance parcourue : {distance} km</div>}
          <RLChk label="Plein du véhicule" checked={veh.retour_base.plein} onChange={v=>updVeh(eq.id,'retour_base','plein',v)} peutEditer={retourEdit} />
          <RLChk label="Rangement matériel (cfr départ)" checked={veh.retour_base.rangement} onChange={v=>updVeh(eq.id,'retour_base','rangement',v)} peutEditer={retourEdit} />
          <RLChk label="Remplacement matériel pris dans le véhicule" checked={veh.retour_base.remplacement_materiel} onChange={v=>updVeh(eq.id,'retour_base','remplacement_materiel',v)} peutEditer={retourEdit} />
          <RLChk label="Remise en ordre et nettoyage véhicule" checked={veh.retour_base.remise_ordre} onChange={v=>updVeh(eq.id,'retour_base','remise_ordre',v)} peutEditer={retourEdit} />
          <RLChk label="Linge sale dans sac de linge" checked={veh.retour_base.linge_sale} onChange={v=>updVeh(eq.id,'retour_base','linge_sale',v)} peutEditer={retourEdit} />
          <RLChk label="Remise des clés et papiers" checked={veh.retour_base.remise_cles} onChange={v=>updVeh(eq.id,'retour_base','remise_cles',v)} peutEditer={retourEdit} />
          <CustomItems items={veh.retour_base.custom} editable={retourEdit} estCoord={estCoordinateur} onChange={(items)=>updVeh(eq.id,'retour_base','custom',items)} />
          <RLTxt label="Dégâts ou pannes durant la mission" value={veh.retour_base.degats_mission} onChange={v=>updVeh(eq.id,'retour_base','degats_mission',v)} peutEditer={retourEdit} />
          <RLTxt label="Matériels utilisés" value={veh.retour_base.materiels_utilises} onChange={v=>updVeh(eq.id,'retour_base','materiels_utilises',v)} peutEditer={retourEdit} />
          <PhotosVehicule souhaitId={souhait.id} dossier="vehicule-retour" photos={veh.retour_base.photos} editable={retourEdit} onChange={(p)=>updVeh(eq.id,'retour_base','photos',p)} />
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#0E4A5A', marginBottom:4 }}>🫁 Bouteilles O2 (retour)</div>
            <O2Section value={veh.o2} editable={retourEdit} phase="retour" onChange={(o2)=>setVehSection(eq.id,'o2',o2)} />
          </div>
        </RLCard>
      )}

      {/* CARBURANT (tickets, à tout moment) */}
      {sous === 'carburant' && (
        <RLCard titre={`⛽ Tickets carburant — ${labelVeh(eq, idx)}`}>
          <div style={{ fontSize:11.5, color:'#7A7470', marginBottom:8 }}>Les tickets peuvent être ajoutés à tout moment, indépendamment des check-listes.</div>
          <TicketsCarburant souhaitId={souhait.id} tickets={veh.tickets} peutEditer={ticketsEdit}
            onChange={(t)=>setVehSection(eq.id,'tickets',t)} />
        </RLCard>
      )}

      {!peutEditer && <div style={{ fontSize:11.5, color:'#A8A39D', marginTop:14 }}>Lecture seule — seul l'équipage affecté remplit ce rapport.</div>}
      {peutEditer && !estCoordinateur && <div style={{ fontSize:11, color:'#A8A39D', marginTop:14 }}>Une fois une check-liste validée, vous ne pourrez plus la modifier (seuls les coordinateurs le peuvent).</div>}
    </div>
  )
}

// Bandeau de validation d'une section
function ValidBar({ v, canValider, onValider, estCoord, bloqueMsg }) {
  if (v?.valide) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, background:'#EAF3DE', border:'1px solid rgba(59,109,17,.25)', borderRadius:8, padding:'6px 10px', marginBottom:10, fontSize:12 }}>
        <span style={{ color:'#3B6D11', fontWeight:700 }}>✓ Validée</span>
        {v.par && <span style={{ color:'#5A6A4A' }}>par {v.par}{v.date ? ` · ${new Date(v.date).toLocaleDateString('fr-BE')} à ${new Date(v.date).toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})}` : ''}</span>}
        {estCoord && <span style={{ marginLeft:'auto', color:'#7A7470', fontStyle:'italic' }}>modifiable (coordinateur)</span>}
      </div>
    )
  }
  if (canValider) {
    return (
      <button onClick={()=>{ if (confirm('Valider cette check-liste ? Elle ne sera plus modifiable (sauf par un coordinateur).')) onValider() }}
        style={{ marginBottom:10, padding:'7px 14px', background:'#3B6D11', color:'white', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
        ✓ Valider cette check-liste (définitif)
      </button>
    )
  }
  if (bloqueMsg) {
    return <div style={{ marginBottom:10, fontSize:12, color:'#A32D2D', background:'#FCEBEB', border:'1px solid rgba(163,45,45,.2)', borderRadius:8, padding:'6px 10px' }}>⚠️ {bloqueMsg}</div>
  }
  return null
}

function normRapport(init, equipages = []) {
  const i = init || {}
  const flat = (i.base || i.retour_base || i.o2 || i.tickets_carburant) && !i.vehicules
  const out = {
    pec: i.pec || {}, retour_pec: i.retour_pec || {},
    v_pec: i.v_pec || {}, v_retour_pec: i.v_retour_pec || {},
    vehicules: {},
  }
  equipages.forEach((e, idx) => {
    const v = (i.vehicules && i.vehicules[e.id]) || {}
    out.vehicules[e.id] = {
      base: v.base || (flat && idx===0 ? (i.base||{}) : {}),
      retour_base: v.retour_base || (flat && idx===0 ? (i.retour_base||{}) : {}),
      o2: v.o2 || (flat && idx===0 ? (i.o2||{}) : {}),
      tickets: Array.isArray(v.tickets) ? v.tickets : (flat && idx===0 && Array.isArray(i.tickets_carburant) ? i.tickets_carburant : []),
      v_base: v.v_base || {}, v_retour: v.v_retour || {},
    }
  })
  return out
}

// ── Tickets carburant : photo, reconnaissance auto (OCR), totaux ──────────────
async function uploadTicketPhoto(file, souhaitId) {
  return uploadImage(file, souhaitId, 'tickets')
}
async function uploadImage(file, souhaitId, dossier='divers') {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${dossier}/${souhaitId || 'divers'}/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`
  const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert:true, contentType:file.type })
  if (error) throw error
  return supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl
}

// Photos du véhicule — 4 côtés obligatoires
const COTES = [['avant','Avant'],['arriere','Arrière'],['gauche','Côté gauche'],['droite','Côté droit']]
function normPhoto(v){ if(!v) return null; if(typeof v==='string') return { url:v, marques:[] }; return { url:v.url||'', marques:Array.isArray(v.marques)?v.marques:[] } }
function photoUrl(v){ const n=normPhoto(v); return n?n.url:'' }
function photos4ok(p){ return COTES.every(([k])=>photoUrl(p?.[k])) }

function PhotosVehicule({ souhaitId, dossier, photos, editable, onChange }) {
  const p = photos || {}
  const [busy, setBusy] = useState(null)
  const [markCote, setMarkCote] = useState(null)  // côté en cours d'annotation
  const nb = COTES.filter(([k])=>photoUrl(p[k])).length

  async function set(cote, file) {
    if (!file) return
    setBusy(cote)
    try { const url = await uploadImage(file, souhaitId, dossier); onChange({ ...p, [cote]: { url, marques:[] } }) }
    catch (e) { alert('Upload impossible : ' + (e.message||e)) }
    setBusy(null)
  }
  function remove(cote){ const n = { ...p }; delete n[cote]; onChange(n) }
  function setMarques(cote, marques){ onChange({ ...p, [cote]: { url: photoUrl(p[cote]), marques } }) }

  return (
    <div style={{ marginTop:8 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#0E4A5A', marginBottom:6 }}>📸 Photos du véhicule (4 côtés) — <span style={{ color: nb===4?'#3B6D11':'#A32D2D' }}>{nb}/4</span></div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:8 }}>
        {COTES.map(([k,lab])=>{
          const ph = normPhoto(p[k])
          const url = ph?.url
          const marques = ph?.marques || []
          return (
            <div key={k} style={{ border:`1px solid ${url?'rgba(59,109,17,.25)':'rgba(0,0,0,.12)'}`, borderRadius:10, padding:8, background:url?'#F6FBF1':'#FAFAF8' }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#4A4340', marginBottom:6 }}>{lab} {url && <span style={{ color:'#3B6D11' }}>✓</span>} {marques.length>0 && <span style={{ color:'#C8435A', fontWeight:700 }}>· {marques.length} dégât{marques.length>1?'s':''}</span>}</div>
              {url ? (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ position:'relative', width:'100%', maxWidth:140, alignSelf:'flex-start' }}>
                    <img src={url} alt={lab} style={{ width:'100%', height:90, objectFit:'cover', borderRadius:8, border:'1px solid rgba(0,0,0,.1)', display:'block' }} />
                    {marques.map((m,mi)=>(
                      <span key={mi} style={{ position:'absolute', left:`${(m.x||0)*100}%`, top:`${(m.y||0)*100}%`, transform:'translate(-50%,-50%)', width:14, height:14, borderRadius:'50%', background:'#C8435A', color:'white', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid white', boxShadow:'0 1px 3px rgba(0,0,0,.4)' }}>{mi+1}</span>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button type="button" onClick={()=>setMarkCote(k)} style={{ background:'#FBEAF0', color:'#C8435A', border:'none', borderRadius:6, padding:'4px 9px', fontSize:11.5, fontWeight:600, cursor:'pointer' }}>{editable ? '🎯 Marquer dégâts' : '🔍 Voir dégâts'}</button>
                    {editable && <button type="button" onClick={()=>remove(k)} style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'4px 8px', fontSize:11.5, cursor:'pointer' }}>✕</button>}
                  </div>
                </div>
              ) : editable ? (
                <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 10px', background:'#E6F7FA', color:'#0E7A93', borderRadius:7, fontSize:12, fontWeight:600, cursor:busy===k?'wait':'pointer' }}>
                  {busy===k ? '…' : '📷 Prendre'}
                  <input type="file" accept="image/*" capture="environment" disabled={busy===k} onChange={e=>{ const f=e.target.files?.[0]; e.target.value=''; set(k,f) }} style={{ display:'none' }} />
                </label>
              ) : <span style={{ fontSize:12, color:'#A8A39D' }}>—</span>}
            </div>
          )
        })}
      </div>

      {markCote && (
        <PhotoMarkerModal
          lab={COTES.find(([k])=>k===markCote)?.[1]}
          url={photoUrl(p[markCote])}
          marques={normPhoto(p[markCote])?.marques || []}
          editable={editable}
          onSave={(mq)=>{ setMarques(markCote, mq); setMarkCote(null) }}
          onClose={()=>setMarkCote(null)}
        />
      )}
    </div>
  )
}

// Modal d'annotation des dégâts sur une photo
function PhotoMarkerModal({ lab, url, marques, editable, onSave, onClose }) {
  const [mk, setMk] = useState(marques.map(m=>({ ...m })))
  function addAt(e){
    if (!editable) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    setMk(l => [...l, { x, y, note:'' }])
  }
  const setNote = (i,v) => setMk(l => l.map((m,j)=>j===i?{ ...m, note:v }:m))
  const del = (i) => setMk(l => l.filter((_,j)=>j!==i))

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,30,45,.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:14, padding:18, maxWidth:560, width:'100%', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#0E4A5A' }}>Dégâts — {lab}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'#7A7470', cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        {editable && <div style={{ fontSize:12, color:'#7A7470', marginBottom:8 }}>Touchez la photo à l'endroit d'un dégât pour ajouter un repère, puis décrivez-le ci-dessous.</div>}
        <div style={{ position:'relative', width:'100%', borderRadius:10, overflow:'hidden', border:'1px solid rgba(0,0,0,.1)', cursor:editable?'crosshair':'default' }} onClick={addAt}>
          <img src={url} alt={lab} style={{ width:'100%', display:'block' }} />
          {mk.map((m,i)=>(
            <span key={i} style={{ position:'absolute', left:`${(m.x||0)*100}%`, top:`${(m.y||0)*100}%`, transform:'translate(-50%,-50%)', width:24, height:24, borderRadius:'50%', background:'#C8435A', color:'white', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid white', boxShadow:'0 1px 4px rgba(0,0,0,.5)' }}>{i+1}</span>
          ))}
        </div>
        <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
          {mk.length === 0 && <div style={{ fontSize:12.5, color:'#A8A39D' }}>Aucun dégât marqué.</div>}
          {mk.map((m,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ flexShrink:0, width:22, height:22, borderRadius:'50%', background:'#C8435A', color:'white', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{i+1}</span>
              {editable
                ? <input value={m.note||''} onChange={e=>setNote(i,e.target.value)} placeholder="Décrire le dégât (ex. rayure portière)" style={{ flex:1, padding:'7px 9px', border:'1px solid rgba(0,0,0,.12)', borderRadius:7, fontSize:13, fontFamily:'DM Sans,sans-serif' }} />
                : <span style={{ flex:1, fontSize:13, color:'#1A1514' }}>{m.note || <em style={{ color:'#A8A39D' }}>sans description</em>}</span>}
              {editable && <button onClick={()=>del(i)} style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'5px 9px', fontSize:12, cursor:'pointer' }}>✕</button>}
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:14 }}>
          <button onClick={onClose} style={{ padding:'8px 16px', background:'none', border:'1px solid rgba(0,0,0,.15)', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>{editable?'Annuler':'Fermer'}</button>
          {editable && <button onClick={()=>onSave(mk)} style={{ padding:'8px 18px', background:'#1BB0CE', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>✓ Enregistrer</button>}
        </div>
      </div>
    </div>
  )
}

// Éléments personnalisés (cases à cocher ajoutées par les coordinateurs)
function CustomItems({ items, editable, estCoord, onChange }) {
  const list = Array.isArray(items) ? items : []
  const toggle = (id,v) => onChange(list.map(it=>it.id===id?{ ...it, checked:v }:it))
  const del = (id) => onChange(list.filter(it=>it.id!==id))
  function add(){ const label = prompt('Nom de l\'élément (ex. Chaise roulante, Pompe d\'aspiration, Coussin lune…)'); if (label && label.trim()) onChange([...list, { id:'c'+Date.now(), label:label.trim(), checked:false }]) }
  return (
    <div>
      {list.map(it=>(
        <div key={it.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
          <label style={{ display:'flex', alignItems:'center', gap:9, padding:'5px 0', fontSize:13, color:'#1A1514', cursor:editable?'pointer':'default', flex:1 }}>
            <input type="checkbox" disabled={!editable} checked={!!it.checked} onChange={e=>toggle(it.id,e.target.checked)} style={{ accentColor:'#3B6D11', width:16, height:16 }} />
            {it.label}
          </label>
          {estCoord && <button type="button" onClick={()=>del(it.id)} title="Supprimer cet élément" style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'2px 7px', fontSize:12, cursor:'pointer' }}>✕</button>}
        </div>
      ))}
      {estCoord && (
        <button type="button" onClick={add} style={{ marginTop:6, padding:'6px 12px', background:'#E6F7FA', color:'#0E7A93', border:'1px dashed rgba(14,122,147,.4)', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>+ Ajouter un élément à cocher</button>
      )}
    </div>
  )
}
async function uploadTicketPhoto_unused(file, souhaitId) {
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

function O2Section({ value, editable, phase = 'depart', onChange }) {
  // Normalisation : { B10:[{d,r},...], B5:[...], B2:[...] }
  const o2 = { B10: Array.isArray(value?.B10)?value.B10:[], B5: Array.isArray(value?.B5)?value.B5:[], B2: Array.isArray(value?.B2)?value.B2:[] }
  const depart = phase === 'depart'

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
  const totalBouteilles = o2.B10.length + o2.B5.length + o2.B2.length
  if (!depart && totalBouteilles === 0) {
    return <div style={{ fontSize:12, color:'#A8A39D', fontStyle:'italic' }}>Aucune bouteille saisie au départ.</div>
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {O2_TYPES.map(({ type, volume, perte }) => {
        const facteur = 1 - perte
        if (!depart && o2[type].length === 0) return null
        return (
          <div key={type}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#0E4A5A' }}>{type} <span style={{ color:'#7A7470', fontWeight:400 }}>({volume} L · −{Math.round(perte*100)}%)</span></span>
              {depart && (
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, color:'#4A4340' }}>
                  Nombre :
                  <FieldInput value={o2[type].length || 0} onCommit={v=>setCount(type, v)} peutEditer={editable} inputMode="numeric" style={{ ...IN, width:60 }} />
                </label>
              )}
            </div>

            {depart && o2[type].length === 0 && <div style={{ fontSize:12, color:'#A8A39D', fontStyle:'italic' }}>Aucune bouteille {type}.</div>}

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {o2[type].map((b, i) => {
                const d = parseFloat(b.d), rr = parseFloat(b.r)
                const litresDep = isFinite(d) ? volume * d : null
                const consommes = (isFinite(d) && isFinite(rr)) ? volume * (d - rr) : null
                return (
                  <div key={i} style={{ border:'1px solid rgba(0,0,0,.08)', borderRadius:10, padding:'10px 12px', background:'#FAFAF8' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#7A7470', minWidth:80 }}>Bouteille {i+1}</span>
                      {depart ? (
                        <>
                          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5 }}>
                            Pression départ
                            <FieldInput value={b.d} onCommit={v=>setVal(type, i, 'd', v)} peutEditer={editable} style={IN} /> bar
                          </label>
                          {litresDep != null && <span style={{ fontSize:12.5, fontWeight:600, color:'#0E7A93' }}>= {Math.round(litresDep)} L</span>}
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize:12.5, color:'#7A7470' }}>départ {isFinite(d)?`${d} bar`:'—'}{litresDep!=null?` (${Math.round(litresDep)} L)`:''}</span>
                          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5 }}>
                            Pression retour
                            <FieldInput value={b.r} onCommit={v=>setVal(type, i, 'r', v)} peutEditer={editable} style={IN} /> bar
                          </label>
                          {consommes != null && (
                            <span style={{ fontSize:12.5, fontWeight:600, color:'#C8435A' }}>consommé {Math.round(Math.max(0, consommes))} L</span>
                          )}
                        </>
                      )}
                    </div>
                    {depart && litresDep != null && (
                      <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
                        <span style={{ fontSize:11, color:'#7A7470', alignSelf:'center' }}>Autonomie :</span>
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
      {depart && <div style={{ fontSize:11, color:'#A8A39D' }}>Litres = volume × pression. Autonomie = (volume × pression ÷ débit) − 10% (B10/B5), 15% (B2). Neuve ≈ 200 bar.</div>}
    </div>
  )
}

function Vide() {
  return <p style={{ fontSize:13, color:'#A8A39D', fontStyle:'italic', margin:0 }}>Non renseigné.</p>
}

const TIMING_FIN_IDS = ['retour_pec','arrivee_retour','retour_base','rentre_base']
function TimingTab({ souhait, peutEditer, onSave }) {
  const [timings, setTimings] = useState(Array.isArray(souhait.timings) ? souhait.timings : [])
  const [ajouts, setAjouts] = useState(Array.isArray(souhait.timings_ajouts) ? souhait.timings_ajouts : [])
  const planning = souhait.planning_particulier || []
  const fmtJour = (j) => j ? new Date(j+'T00:00:00').toLocaleDateString('fr-BE', { weekday:'short', day:'numeric', month:'short' }) : null
  const maintenant = () => { const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }

  function maj(id, reel) {
    const next = timings.map(t => t.id === id ? { ...t, reel } : t)
    setTimings(next)
    onSave({ timings: next })
  }
  const pointer = (id) => maj(id, maintenant())
  const effacer = (id) => maj(id, '')

  // Lignes ajoutées par l'équipage (2 pointages)
  const persistAjouts = (next) => { setAjouts(next); onSave({ timings_ajouts: next }) }
  const majAjout = (id,k,v) => setAjouts(ajouts.map(a => a.id===id ? { ...a, [k]:v } : a))   // local (commit au blur pour le libellé)
  const pointAjout = (id,k) => persistAjouts(ajouts.map(a => a.id===id ? { ...a, [k]:maintenant() } : a))
  const clearAjout = (id,k) => persistAjouts(ajouts.map(a => a.id===id ? { ...a, [k]:'' } : a))
  const delAjout = (id) => persistAjouts(ajouts.filter(a => a.id!==id))
  function addAjout(){ const label = prompt('Libellé du trajet / segment (ex. Détour pharmacie, Pause repas…)') || 'Trajet'; persistAjouts([...ajouts, { id:'a'+Date.now(), label:label.trim()||'Trajet', depart:'', arrivee:'' }]) }

  // n'afficher que les horaires renseignés (heure prévue) ou déjà pointés ; sinon tout si on peut éditer
  const visibles = timings.filter(t => t.label && (peutEditer || t.heure || t.reel))

  return (
    <div style={{ maxWidth:760 }}>
      <InfoCard title="🏁 Base de départ">
        <Row label="Base départ" val={souhait.base_depart || '—'} />
      </InfoCard>

      <div style={{ marginTop:18 }}>
        <InfoCard title="🕐 Horaires">
          {visibles.length === 0 && ajouts.length === 0 && !peutEditer ? <Vide /> : (() => {
            const finStart = (() => { const i = visibles.findIndex(t => TIMING_FIN_IDS.includes(t.id)); return i === -1 ? visibles.length : i })()
            const avant = visibles.slice(0, finStart)
            const apres = visibles.slice(finStart)

            const ligneFixe = (t,i) => (
              <div key={t.id||i} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom:'1px solid rgba(0,0,0,.05)', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:150 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1514' }}>{t.label}</div>
                  <div style={{ display:'flex', gap:14, marginTop:2, fontSize:12 }}>
                    <span style={{ color:'#7A7470' }}>prévu&nbsp;: <strong style={{ color:'#0E7A93' }}>{t.heure || '—'}</strong></span>
                    {t.jour && <span style={{ color:'#BA7517', fontWeight:600 }}>{fmtJour(t.jour)}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {t.reel
                    ? <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#EAF3DE', color:'#3B6D11', borderRadius:99, padding:'4px 11px', fontSize:13, fontWeight:700 }}>⏱ {t.reel} <span style={{ fontSize:10, fontWeight:600, color:'#5A6A4A' }}>réel</span></span>
                    : <span style={{ fontSize:12.5, color:'#A8A39D' }}>non pointé</span>}
                  {peutEditer && (
                    t.reel
                      ? <>
                          <button onClick={()=>pointer(t.id)} title="Re-pointer maintenant" style={{ background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:7, padding:'5px 9px', fontSize:12, fontWeight:600, cursor:'pointer' }}>↻</button>
                          <button onClick={()=>effacer(t.id)} title="Effacer" style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:7, padding:'5px 9px', fontSize:12, cursor:'pointer' }}>✕</button>
                        </>
                      : <button onClick={()=>pointer(t.id)} style={{ background:'#3B6D11', color:'white', border:'none', borderRadius:8, padding:'6px 12px', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>⏱ Pointer</button>
                  )}
                </div>
              </div>
            )

            return (
              <div style={{ display:'flex', flexDirection:'column' }}>
                {avant.map(ligneFixe)}

                {/* Trajets ajoutés par l'équipage — ENTRE les deux blocs */}
                {(peutEditer || ajouts.length > 0) && (
                  <div style={{ borderLeft:'2px dashed rgba(14,122,147,.3)', paddingLeft:10, margin:'10px 0 10px 2px', display:'flex', flexDirection:'column', gap:10 }}>
                    {ajouts.map(a => (
                      <div key={a.id} style={{ background:'#F0F9FB', border:'1px solid rgba(27,176,206,.15)', borderRadius:10, padding:'10px 12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                          {peutEditer
                            ? <input value={a.label} onChange={e=>majAjout(a.id,'label',e.target.value)} onBlur={()=>persistAjouts(ajouts)} placeholder="Libellé du trajet" style={{ flex:1, padding:'6px 9px', border:'1px solid rgba(0,0,0,.12)', borderRadius:7, fontSize:13, fontFamily:'DM Sans,sans-serif', fontWeight:600 }} />
                            : <span style={{ flex:1, fontSize:13.5, fontWeight:600, color:'#1A1514' }}>{a.label}</span>}
                          {peutEditer && <button onClick={()=>delAjout(a.id)} title="Supprimer la ligne" style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:7, padding:'5px 9px', fontSize:12, cursor:'pointer' }}>✕</button>}
                        </div>
                        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                          {[['depart','🚀 Départ'],['arrivee','🏁 Arrivée']].map(([k,lab])=>(
                            <div key={k} style={{ display:'flex', alignItems:'center', gap:8, background:'white', border:'1px solid rgba(0,0,0,.08)', borderRadius:8, padding:'6px 10px' }}>
                              <span style={{ fontSize:12, fontWeight:600, color:'#5A6A6E' }}>{lab}</span>
                              {a[k]
                                ? <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#EAF3DE', color:'#3B6D11', borderRadius:99, padding:'3px 10px', fontSize:13, fontWeight:700 }}>⏱ {a[k]}</span>
                                : <span style={{ fontSize:12, color:'#A8A39D' }}>—</span>}
                              {peutEditer && (a[k]
                                ? <>
                                    <button onClick={()=>pointAjout(a.id,k)} title="Re-pointer" style={{ background:'#E6F7FA', color:'#0E7A93', border:'none', borderRadius:6, padding:'4px 7px', fontSize:11.5, fontWeight:600, cursor:'pointer' }}>↻</button>
                                    <button onClick={()=>clearAjout(a.id,k)} title="Effacer" style={{ background:'#FCEBEB', color:'#C8435A', border:'none', borderRadius:6, padding:'4px 7px', fontSize:11.5, cursor:'pointer' }}>✕</button>
                                  </>
                                : <button onClick={()=>pointAjout(a.id,k)} style={{ background:'#3B6D11', color:'white', border:'none', borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>⏱ Pointer</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {peutEditer && <button onClick={addAjout} style={{ alignSelf:'flex-start', padding:'7px 13px', background:'#E6F7FA', color:'#0E7A93', border:'1px dashed rgba(14,122,147,.4)', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>+ Ajouter un trajet (départ + arrivée)</button>}
                  </div>
                )}

                {apres.map(ligneFixe)}
              </div>
            )
          })()}
          {peutEditer && <div style={{ fontSize:11.5, color:'#A8A39D', marginTop:10 }}>« Pointer » enregistre l'heure réelle au moment du clic — utile pour les retours, décidés sur le moment. Les trajets ajoutés s'insèrent entre l'aller et le retour.</div>}
        </InfoCard>
      </div>

      {planning.length > 0 && (
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