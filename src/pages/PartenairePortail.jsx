import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import config from '@/app.config'
import { COPYRIGHT } from '@/copyright'
import { Card, Btn, F, TA, Sel, Pill, inp, lbl, Empty, Loading } from '@/components/ui'

const STATUT = {
  nouvelle:  { l:'Reçue',       c:'#BA7517', bg:'#FAEEDA' },
  en_cours:  { l:'En cours',    c:'#1BB0CE', bg:'#E6F7FA' },
  acceptee:  { l:'Acceptée',    c:'#185FA5', bg:'#E6F1FB' },
  realisee:  { l:'Réalisée',    c:'#3B6D11', bg:'#EAF3DE' },
  refusee:   { l:'Non retenue', c:'#A32D2D', bg:'#FCEBEB' },
}
const stInfo = v => STATUT[v] || STATUT.nouvelle

export default function PartenairePortail() {
  const { profile, signOut } = useAuth()
  const nav = useNavigate()
  const [view, setView] = useState('liste')   // liste | nouvelle | detail
  const [selId, setSelId] = useState(null)

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', background:'var(--surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:20 }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.3rem', color:'var(--heading)' }}>{config.organisation.nom} — Espace partenaire</div>
        <Btn kind="soft" onClick={async()=>{ await signOut(); nav('/login') }}>Déconnexion</Btn>
      </header>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'clamp(16px,3vw,28px)' }}>
        {view === 'liste' && (
          <ListeDemandes profile={profile} onNew={() => setView('nouvelle')} onOpen={(id) => { setSelId(id); setView('detail') }} />
        )}
        {view === 'nouvelle' && (
          <NouvelleDemande profile={profile} onDone={() => setView('liste')} />
        )}
        {view === 'detail' && (
          <DetailDemande id={selId} onBack={() => setView('liste')} />
        )}
        <div style={{ fontSize:10.5, color:'var(--text-faint)', marginTop:24, textAlign:'center' }}>{COPYRIGHT}</div>
      </div>
    </div>
  )
}

// ── Liste des demandes du partenaire ──────────────────────────────────────────
function ListeDemandes({ profile, onNew, onOpen }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { (async () => {
    const { data } = await supabase.from('demandes_souhaits').select('*').order('created_at', { ascending:false })
    setItems(data || []); setLoading(false)
  })() }, [])

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:'1.6rem', color:'var(--heading)', margin:0 }}>Vos demandes de souhait</h1>
          <p style={{ color:'var(--text-muted)', fontSize:13.5, marginTop:2 }}>Bonjour {profile?.prenom || ''}. Encodez une demande et suivez son avancement.</p>
        </div>
        <Btn onClick={onNew}>+ Nouvelle demande</Btn>
      </div>

      {loading ? <Loading />
        : items.length === 0 ? <Empty title="Aucune demande pour l'instant" hint="Encodez une demande : notre équipe la prendra en charge et vous pourrez suivre son avancement ici." action={<Btn onClick={onNew}>+ Nouvelle demande</Btn>} />
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {items.map(d => {
              const st = stInfo(d.statut)
              return (
                <Card key={d.id} clickable onClick={()=>onOpen(d.id)}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontWeight:600, color:'var(--text)' }}>{d.patient_prenom} {d.patient_nom}</div>
                      <div style={{ fontSize:13, color:'var(--text-2)', marginTop:2, display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{d.souhait_description}</div>
                      <div style={{ fontSize:11.5, color:'var(--text-faint)', marginTop:2 }}>Encodée le {new Date(d.created_at).toLocaleDateString('fr-BE')}</div>
                    </div>
                    <Pill color={st.c} bg={st.bg}>{st.l}</Pill>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
    </div>
  )
}

// ── Nouvelle demande (patient + souhait + médical + médicaments) ──────────────
const empty = {
  patient_prenom:'', patient_nom:'', patient_ddn:'', etablissement:'', medecin_referent:'',
  contact_prenom:'', contact_nom:'', contact_relation:'', contact_email:'', contact_telephone:'',
  souhait_description:'', souhait_date:'', souhait_lieu:'',
  mobilite:'', equipement_medical:'', allergies:'', urgence:false,
  consent_patient:false, consent_rgpd:false,
}

function NouvelleDemande({ profile, onDone }) {
  const [f, setF] = useState(empty)
  const set = (k,v) => setF(s => ({ ...s, [k]:v }))
  const [meds, setMeds] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  function addMed() { setMeds(m => [...m, { medicament:'', dosage:'', voie:'', frequence:'', horaires:'', notes:'' }]) }
  function setMed(i, k, v) { setMeds(m => m.map((x,j) => j===i ? { ...x, [k]:v } : x)) }
  function delMed(i) { setMeds(m => m.filter((_,j) => j!==i)) }

  async function save() {
    if (!f.patient_prenom || !f.patient_nom || !f.souhait_description || !f.contact_prenom || !f.contact_nom || !f.contact_email) { setErr('Merci de compléter les champs obligatoires (*).'); return }
    if (!f.consent_patient || !f.consent_rgpd) { setErr('Merci de cocher les deux consentements.'); return }
    setSaving(true); setErr(null)
    const { data: dem, error } = await supabase.from('demandes_souhaits').insert({
      ...f, source:'partenaire', partenaire_id: profile?.partenaire_id, cree_par: profile?.id,
      patient_ddn: f.patient_ddn || null, souhait_date: f.souhait_date || null,
    }).select().single()
    if (error) { setErr('Erreur : ' + error.message); setSaving(false); return }
    const valides = meds.filter(m => m.medicament.trim())
    if (valides.length) {
      await supabase.from('souhait_medicaments').insert(valides.map((m,i) => ({
        demande_id: dem.id, medicament:m.medicament, dosage:m.dosage||null, voie:m.voie||null,
        frequence:m.frequence||null,
        horaires: m.horaires ? m.horaires.split(/[,;]/).map(x=>x.trim()).filter(Boolean) : null,
        notes:m.notes||null, ordre:i,
      })))
    }
    setSaving(false); onDone()
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
        <h1 style={{ fontSize:'1.5rem', color:'var(--text)', margin:0 }}>Nouvelle demande</h1>
        <Btn kind="soft" onClick={onDone}>← Retour</Btn>
      </div>

      <Card style={{ marginBottom:14 }}>
        <Sec>Patient</Sec>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <F label="Prénom" value={f.patient_prenom} set={v=>set('patient_prenom',v)} required />
          <F label="Nom" value={f.patient_nom} set={v=>set('patient_nom',v)} required />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <F label="Date de naissance" type="date" value={f.patient_ddn} set={v=>set('patient_ddn',v)} />
          <F label="Établissement / lieu" value={f.etablissement} set={v=>set('etablissement',v)} />
        </div>
        <F label="Médecin référent" value={f.medecin_referent} set={v=>set('medecin_referent',v)} />
      </Card>

      <Card style={{ marginBottom:14 }}>
        <Sec>Personne de contact (famille / proche)</Sec>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <F label="Prénom" value={f.contact_prenom} set={v=>set('contact_prenom',v)} required />
          <F label="Nom" value={f.contact_nom} set={v=>set('contact_nom',v)} required />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <F label="Lien avec le patient" value={f.contact_relation} set={v=>set('contact_relation',v)} />
          <F label="Téléphone" value={f.contact_telephone} set={v=>set('contact_telephone',v)} />
        </div>
        <F label="E-mail" type="email" value={f.contact_email} set={v=>set('contact_email',v)} required />
      </Card>

      <Card style={{ marginBottom:14 }}>
        <Sec>Le souhait</Sec>
        <TA label="Description" value={f.souhait_description} set={v=>set('souhait_description',v)} rows={3} />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <F label="Date envisagée" type="date" value={f.souhait_date} set={v=>set('souhait_date',v)} />
          <F label="Lieu" value={f.souhait_lieu} set={v=>set('souhait_lieu',v)} />
        </div>
      </Card>

      <Card style={{ marginBottom:14 }}>
        <Sec>Informations médicales</Sec>
        <F label="Mobilité (autonome, fauteuil, alité…)" value={f.mobilite} set={v=>set('mobilite',v)} />
        <F label="Équipement médical nécessaire" value={f.equipement_medical} set={v=>set('equipement_medical',v)} />
        <F label="Allergies" value={f.allergies} set={v=>set('allergies',v)} />
        <label style={chk}><input type="checkbox" checked={f.urgence} onChange={e=>set('urgence',e.target.checked)} /> Demande urgente</label>
      </Card>

      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <Sec noMargin>Programmation des médicaments</Sec>
          <Btn kind="soft" onClick={addMed}>+ Ajouter</Btn>
        </div>
        {meds.length === 0 && <div style={{ fontSize:13, color:'var(--text-muted)' }}>Aucun médicament ajouté.</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {meds.map((m,i) => (
            <div key={i} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:8 }}>
                <F label="Médicament" value={m.medicament} set={v=>setMed(i,'medicament',v)} />
                <F label="Dosage" value={m.dosage} set={v=>setMed(i,'dosage',v)} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <F label="Voie (orale, IV…)" value={m.voie} set={v=>setMed(i,'voie',v)} />
                <F label="Fréquence (ex: 3x/jour)" value={m.frequence} set={v=>setMed(i,'frequence',v)} />
              </div>
              <F label="Horaires (séparés par des virgules)" value={m.horaires} set={v=>setMed(i,'horaires',v)} placeholder="08:00, 13:00, 20:00" />
              <F label="Notes" value={m.notes} set={v=>setMed(i,'notes',v)} />
              <Btn kind="danger" onClick={()=>delMed(i)} style={{ padding:'5px 10px' }}>Retirer</Btn>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <label style={chk}><input type="checkbox" checked={f.consent_patient} onChange={e=>set('consent_patient',e.target.checked)} /> Le patient (ou son représentant) consent à cette demande.</label>
        <label style={chk}><input type="checkbox" checked={f.consent_rgpd} onChange={e=>set('consent_rgpd',e.target.checked)} /> J'accepte le traitement de ces données conformément au RGPD.</label>
        {err && <div style={{ color:'#C8435A', fontSize:13, marginTop:8 }}>{err}</div>}
        <Btn onClick={save} disabled={saving} style={{ width:'100%', marginTop:10 }}>{saving?'Envoi…':'✓ Envoyer la demande'}</Btn>
      </Card>
    </div>
  )
}

// ── Détail d'une demande (médicaments + rapport publié) ───────────────────────
function DetailDemande({ id, onBack }) {
  const [d, setD] = useState(null)
  const [meds, setMeds] = useState([])
  const [rapport, setRapport] = useState(null)

  useEffect(() => { load() }, [id])
  async function load() {
    const { data: dem } = await supabase.from('demandes_souhaits').select('*').eq('id', id).single()
    setD(dem)
    const { data: m } = await supabase.from('souhait_medicaments').select('*').eq('demande_id', id).order('ordre')
    setMeds(m || [])
    if (dem?.souhait_id) {
      const { data: r } = await supabase.from('souhait_rapports').select('*').eq('souhait_id', dem.souhait_id).eq('publie', true).order('created_at', { ascending:false }).limit(1)
      setRapport(r?.[0] || null)
    }
  }

  if (!d) return <p style={{ color:'var(--text-muted)' }}>Chargement…</p>
  const st = stInfo(d.statut)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <Btn kind="soft" onClick={onBack}>← Mes demandes</Btn>
        <Pill color={st.c} bg={st.bg}>{st.l}</Pill>
      </div>

      <Card style={{ marginBottom:14 }}>
        <h2 style={{ margin:'0 0 6px', fontSize:'1.3rem', color:'var(--text)' }}>{d.patient_prenom} {d.patient_nom}</h2>
        <div style={{ fontSize:13.5, color:'var(--text-2)', lineHeight:1.6 }}>{d.souhait_description}</div>
        <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:8, display:'flex', gap:16, flexWrap:'wrap' }}>
          {d.souhait_date && <span>🗓 {new Date(d.souhait_date).toLocaleDateString('fr-BE')}</span>}
          {d.souhait_lieu && <span>📍 {d.souhait_lieu}</span>}
        </div>
      </Card>

      <Card style={{ marginBottom:14 }}>
        <Sec>Programmation des médicaments</Sec>
        {meds.length === 0 ? <div style={{ fontSize:13, color:'var(--text-muted)' }}>Aucun médicament renseigné.</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {meds.map(m => (
              <div key={m.id} style={{ borderLeft:'3px solid var(--accent)', padding:'4px 0 4px 10px' }}>
                <div style={{ fontSize:13.5, color:'var(--text)', fontWeight:600 }}>{m.medicament} {m.dosage && <span style={{ fontWeight:400, color:'var(--text-muted)' }}>· {m.dosage}</span>}</div>
                <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{[m.voie, m.frequence, Array.isArray(m.horaires) ? m.horaires.join(', ') : m.horaires].filter(Boolean).join(' · ')}</div>
                {m.notes && <div style={{ fontSize:12, color:'var(--text-2)' }}>{m.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <Sec>Rapport</Sec>
        {rapport ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13.5, color:'var(--text-2)', lineHeight:1.6 }}>
            {rapport.deroulement && <p style={{ margin:0 }}><strong>Déroulement.</strong> {rapport.deroulement}</p>}
            {rapport.etat_patient && <p style={{ margin:0 }}><strong>État du patient.</strong> {rapport.etat_patient}</p>}
            {rapport.observations && <p style={{ margin:0 }}><strong>Observations.</strong> {rapport.observations}</p>}
            <div style={{ fontSize:11.5, color:'var(--text-faint)' }}>Publié le {rapport.publie_le ? new Date(rapport.publie_le).toLocaleDateString('fr-BE') : ''}</div>
          </div>
        ) : (
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>Le rapport sera disponible ici une fois le souhait réalisé et publié par l'équipe.</div>
        )}
      </Card>
    </div>
  )
}

function Sec({ children, noMargin }) {
  return <div style={{ fontSize:13, fontWeight:600, color:'var(--heading)', marginBottom: noMargin?0:10 }}>{children}</div>
}
const chk = { display:'flex', gap:8, alignItems:'flex-start', fontSize:13, color:'var(--text-2)', cursor:'pointer', marginBottom:8 }
