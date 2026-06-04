// src/modules/souhaits/DetailSouhait.jsx
import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import ChecklistForm from './ChecklistForm'

const STATUTS = {
  nouvelle:   { label:'Nouvelle demande', color:'#185FA5' },
  urgente:    { label:'Urgente',          color:'#A32D2D' },
  en_attente: { label:'En attente',       color:'#BA7517' },
  planifie:   { label:'Planifié',         color:'#3B6D11' },
  en_cours:   { label:'En cours',         color:'#C8435A' },
  realise:    { label:'Réalisé',          color:'#3B6D11' },
  annule:     { label:'Annulé',           color:'#7A7470' },
}

export default function DetailSouhait() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { profile, can } = useAuth()
  const [souhait, setSouhait]   = useState(null)
  const [personnel, setPersonnel] = useState([])
  const [checklists, setChecklists] = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('info')   // 'info'|'checklist'|'photos'
  const [showCL, setShowCL]     = useState(null)     // 'depart'|'retour'
  const [updatingStatut, setUpdatingStatut] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const [{ data: s }, { data: p }, { data: cl }] = await Promise.all([
      supabase.from('souhaits').select('*').eq('id', id).single(),
      supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role,email)').eq('souhait_id', id),
      supabase.from('checklists').select('*, checklist_reponses(*)').eq('souhait_id', id),
    ])
    setSouhait(s); setPersonnel(p || []); setChecklists(cl || [])
    setLoading(false)
  }

  async function changeStatut(statut) {
    setUpdatingStatut(true)
    await supabase.from('souhaits').update({ statut }).eq('id', id)
    setSouhait(s => ({...s, statut}))
    setUpdatingStatut(false)
  }

  if (loading) return <div style={{ padding:28, fontFamily:'DM Sans,sans-serif', color:'#7A7470' }}>Chargement…</div>
  if (!souhait) return <div style={{ padding:28 }}><Link to="/app/souhaits">← Retour</Link><p>Souhait introuvable.</p></div>

  const st = STATUTS[souhait.statut] || { label:souhait.statut, color:'#7A7470' }
  const clDepart = checklists.find(c => c.type === 'depart')
  const clRetour = checklists.find(c => c.type === 'retour')

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
          {can('coordinateur') && (
            <select value={souhait.statut} onChange={e => changeStatut(e.target.value)} disabled={updatingStatut} style={{ padding:'8px 12px', border:'1px solid rgba(200,67,90,.2)', borderRadius:9, fontSize:13.5, fontFamily:'DM Sans,sans-serif', color:'#1A1514', cursor:'pointer' }}>
              {Object.entries(STATUTS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(200,67,90,.1)', marginBottom:24 }}>
        {[['info','ℹ️ Informations'],['checklist','📋 Check-listes'],['photos','📸 Photos']].map(([v,l]) => (
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

          {/* Carte hébergement (souhait sur plusieurs jours) */}
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

          {/* Carte personnel */}
          <InfoCard title="👥 Personnel assigné">
            {personnel.length === 0 ? (
              <p style={{ fontSize:13.5, color:'#7A7470', fontStyle:'italic' }}>Aucun personnel assigné.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {personnel.map((p, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#FBEAF0,#F7C1C1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#C8435A', flexShrink:0 }}>
                      {(p.profiles?.prenom?.[0]||'')+( p.profiles?.nom?.[0]||'')}
                    </div>
                    <div>
                      <div style={{ fontSize:13.5, fontWeight:500, color:'#1A1514' }}>{p.profiles?.prenom} {p.profiles?.nom}</div>
                      <div style={{ fontSize:11.5, color:'#7A7470' }}>{p.profiles?.role?.replace(/_/g,' ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {souhait.notes && (
              <div style={{ marginTop:12, background:'#FAEEDA', border:'1px solid rgba(186,117,23,.2)', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#633806' }}>
                <strong>Notes :</strong> {souhait.notes}
              </div>
            )}
          </InfoCard>
        </div>
      )}

      {/* Tab Checklistes */}
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