import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, TA, Sel, Pill, inp, lbl } from '@/components/ui'

const STATUTS = [
  { v:'en_attente', l:'En attente', c:'#BA7517', bg:'#FAEEDA' },
  { v:'planifie',   l:'Planifié',   c:'#185FA5', bg:'#E6F1FB' },
  { v:'en_cours',   l:'En cours',   c:'#1BB0CE', bg:'#E6F7FA' },
  { v:'realise',    l:'Réalisé',    c:'#3B6D11', bg:'#EAF3DE' },
  { v:'annule',     l:'Annulé',     c:'#A32D2D', bg:'#FCEBEB' },
  { v:'urgent',     l:'Urgent',     c:'#A32D2D', bg:'#FCEBEB' },
]
const stInfo = v => STATUTS.find(s => s.v === v) || STATUTS[0]

export default function Souhaits() {
  const [tab, setTab] = useState('souhaits')
  return (
    <Page title="Souhaits" action={
      <div style={{ display:'flex', gap:6 }}>
        {[['souhaits','⭐ Souhaits'],['demandes','📨 Demandes']].map(([v,l]) => (
          <button key={v} onClick={()=>setTab(v)} style={{ padding:'8px 14px', borderRadius:9, border:'1px solid var(--border)', background: tab===v?'var(--accent)':'var(--card)', color: tab===v?'#fff':'var(--text-2)', fontWeight:600, fontSize:13.5, cursor:'pointer' }}>{l}</button>
        ))}
      </div>
    }>
      {tab === 'souhaits' ? <ListeSouhaits /> : <ListeDemandes />}
    </Page>
  )
}

// ── Demandes entrantes ────────────────────────────────────────────────────────
function ListeDemandes() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('demandes_souhaits').select('*').order('created_at', { ascending:false })
    setItems(data || []); setLoading(false)
  }
  async function refuser(d) {
    if (!confirm('Refuser cette demande ?')) return
    await supabase.from('demandes_souhaits').update({ statut:'refusee' }).eq('id', d.id); load()
  }
  async function accepter(d) {
    // Crée un souhait à partir de la demande et les relie
    const { data: s, error } = await supabase.from('souhaits').insert({
      beneficiaire_nom: d.patient_nom, beneficiaire_prenom: d.patient_prenom,
      beneficiaire_ddn: d.patient_ddn || null,
      beneficiaire_contact: `${d.contact_prenom||''} ${d.contact_nom||''} ${d.contact_telephone||d.contact_email||''}`.trim(),
      description: d.souhait_description, localisation: d.souhait_lieu,
      besoins_specifiques: d.equipement_medical, notes_medicales: d.allergies,
      date_souhaitee: d.souhait_date || null,
      statut: d.urgence ? 'urgent' : 'en_attente',
      created_by: profile?.id,
    }).select().single()
    if (error) { alert('Erreur : ' + error.message); return }
    await supabase.from('demandes_souhaits').update({ statut:'acceptee', souhait_id: s.id }).eq('id', d.id)
    load()
  }

  if (loading) return <p style={{ color:'var(--text-muted)' }}>Chargement…</p>
  const actives = items.filter(d => !['refusee'].includes(d.statut))
  if (actives.length === 0) return <Card>Aucune demande en attente.</Card>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {actives.map(d => (
        <Card key={d.id}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:8 }}>
            <div>
              <div style={{ fontWeight:600, color:'var(--text)' }}>{d.patient_prenom} {d.patient_nom} {d.urgence && <Pill color="#A32D2D" bg="#FCEBEB">Urgent</Pill>}</div>
              <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Demandé par {d.contact_prenom} {d.contact_nom} · {d.contact_email}</div>
            </div>
            <Pill>{d.statut}</Pill>
          </div>
          <div style={{ fontSize:13.5, color:'var(--text-2)', lineHeight:1.5, marginBottom:10 }}>{d.souhait_description}</div>
          {(d.mobilite || d.equipement_medical || d.allergies) && (
            <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:10 }}>
              {d.mobilite && <>Mobilité : {d.mobilite}. </>}{d.equipement_medical && <>Équipement : {d.equipement_medical}. </>}{d.allergies && <>Allergies : {d.allergies}.</>}
            </div>
          )}
          {d.statut === 'acceptee' ? <Pill color="#3B6D11" bg="#EAF3DE">✓ Souhait créé</Pill> : (
            <div style={{ display:'flex', gap:8 }}>
              <Btn kind="ok" onClick={()=>accepter(d)}>✓ Accepter → créer le souhait</Btn>
              <Btn kind="danger" onClick={()=>refuser(d)}>Refuser</Btn>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

// ── Liste des souhaits ────────────────────────────────────────────────────────
function ListeSouhaits() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)
  const [creer, setCreer] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('souhaits').select('*').order('created_at', { ascending:false })
    setItems(data || []); setLoading(false)
  }

  if (sel) return <DetailSouhait id={sel} onBack={() => { setSel(null); load() }} />
  if (creer) return <FormSouhait onDone={() => { setCreer(false); load() }} />

  return (
    <div>
      <div style={{ marginBottom:14 }}><Btn onClick={()=>setCreer(true)}>+ Nouveau souhait</Btn></div>
      {loading ? <p style={{ color:'var(--text-muted)' }}>Chargement…</p>
        : items.length === 0 ? <Card>Aucun souhait pour le moment.</Card>
        : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,300px),1fr))', gap:12 }}>
            {items.map(s => {
              const st = stInfo(s.statut)
              return (
                <Card key={s.id} style={{ cursor:'pointer' }}>
                  <div onClick={()=>setSel(s.id)}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:6 }}>
                      <div style={{ fontWeight:600, color:'var(--text)' }}>{s.beneficiaire_prenom} {s.beneficiaire_nom}</div>
                      <Pill color={st.c} bg={st.bg}>{st.l}</Pill>
                    </div>
                    <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{s.description}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{s.date_souhaitee ? new Date(s.date_souhaitee).toLocaleDateString('fr-BE') : 'Date à définir'}</div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
    </div>
  )
}

// ── Création d'un souhait ─────────────────────────────────────────────────────
function FormSouhait({ onDone }) {
  const { profile } = useAuth()
  const [f, setF] = useState({ beneficiaire_prenom:'', beneficiaire_nom:'', description:'', localisation:'', date_souhaitee:'', statut:'en_attente', notes_medicales:'' })
  const set = (k,v) => setF(s => ({ ...s, [k]:v }))
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!f.beneficiaire_nom || !f.description) return
    setSaving(true)
    await supabase.from('souhaits').insert({ ...f, date_souhaitee: f.date_souhaitee || null, created_by: profile?.id })
    setSaving(false); onDone()
  }
  return (
    <Card>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
        <h2 style={{ margin:0, fontSize:'1.3rem', color:'var(--text)' }}>Nouveau souhait</h2>
        <Btn kind="soft" onClick={onDone}>← Retour</Btn>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="Prénom du bénéficiaire" value={f.beneficiaire_prenom} set={v=>set('beneficiaire_prenom',v)} required />
        <F label="Nom du bénéficiaire" value={f.beneficiaire_nom} set={v=>set('beneficiaire_nom',v)} required />
      </div>
      <TA label="Description du souhait" value={f.description} set={v=>set('description',v)} rows={3} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="Lieu" value={f.localisation} set={v=>set('localisation',v)} />
        <F label="Date souhaitée" type="date" value={f.date_souhaitee} set={v=>set('date_souhaitee',v)} />
      </div>
      <Sel label="Statut" value={f.statut} set={v=>set('statut',v)} options={STATUTS.map(s=>({v:s.v,l:s.l}))} />
      <TA label="Notes médicales (confidentiel)" value={f.notes_medicales} set={v=>set('notes_medicales',v)} rows={2} />
      <Btn onClick={save} disabled={saving} style={{ width:'100%', marginTop:6 }}>{saving?'Enregistrement…':'✓ Créer le souhait'}</Btn>
    </Card>
  )
}

// ── Détail d'un souhait ───────────────────────────────────────────────────────
function DetailSouhait({ id, onBack }) {
  const { profile } = useAuth()
  const [s, setS] = useState(null)
  const [suivi, setSuivi] = useState([])
  const [rapport, setRapport] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => { load() }, [id])
  async function load() {
    const [{ data:so }, { data:su }, { data:ra }] = await Promise.all([
      supabase.from('souhaits').select('*').eq('id', id).single(),
      supabase.from('souhait_suivi').select('*').eq('souhait_id', id).order('date_contact', { ascending:false }),
      supabase.from('souhait_rapports').select('*').eq('souhait_id', id).order('created_at', { ascending:false }).limit(1),
    ])
    setS(so); setSuivi(su||[]); setRapport(ra?.[0] || null)
  }
  async function majStatut(v) {
    await supabase.from('souhaits').update({ statut:v, date_realisee: v==='realise' ? new Date().toISOString().slice(0,10) : s.date_realisee }).eq('id', id)
    setS(x => ({ ...x, statut:v })); flash('Statut mis à jour.')
  }
  function flash(t) { setMsg(t); setTimeout(()=>setMsg(null), 3000) }

  if (!s) return <p style={{ color:'var(--text-muted)' }}>Chargement…</p>
  const st = stInfo(s.statut)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <Btn kind="soft" onClick={onBack}>← Souhaits</Btn>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:12.5, color:'var(--text-muted)' }}>Statut :</span>
          <select value={s.statut} onChange={e=>majStatut(e.target.value)} style={{ ...inp, width:'auto' }}>
            {STATUTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
      </div>
      {msg && <Card style={{ background:'#F0FAF0', border:'1px solid #C3E6C3', color:'#1E5C1E', marginBottom:12, padding:'10px 14px' }}>{msg}</Card>}

      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:8, flexWrap:'wrap' }}>
          <h2 style={{ margin:0, fontSize:'1.3rem', color:'var(--text)' }}>{s.beneficiaire_prenom} {s.beneficiaire_nom}</h2>
          <Pill color={st.c} bg={st.bg}>{st.l}</Pill>
        </div>
        <div style={{ fontSize:13.5, color:'var(--text-2)', lineHeight:1.6, marginBottom:10 }}>{s.description}</div>
        <div style={{ fontSize:12.5, color:'var(--text-muted)', display:'flex', gap:16, flexWrap:'wrap' }}>
          {s.localisation && <span>📍 {s.localisation}</span>}
          {s.date_souhaitee && <span>🗓 Souhaitée : {new Date(s.date_souhaitee).toLocaleDateString('fr-BE')}</span>}
          {s.beneficiaire_contact && <span>👤 {s.beneficiaire_contact}</span>}
        </div>
        {s.notes_medicales && <div style={{ marginTop:10, fontSize:12.5, color:'#A32D2D', background:'#FCEBEB', borderRadius:8, padding:'8px 12px' }}>⚕️ {s.notes_medicales}</div>}
      </Card>

      <Suivi souhaitId={id} suivi={suivi} onAdd={load} profile={profile} />
      <Rapport souhaitId={id} rapport={rapport} onChange={load} profile={profile} flash={flash} />
    </div>
  )
}

function Suivi({ souhaitId, suivi, onAdd, profile }) {
  const [type, setType] = useState('note')
  const [contenu, setContenu] = useState('')
  const [saving, setSaving] = useState(false)
  async function ajouter() {
    if (!contenu.trim()) return
    setSaving(true)
    await supabase.from('souhait_suivi').insert({ souhait_id:souhaitId, profile_id:profile?.id, type_contact:type, contenu })
    setContenu(''); setSaving(false); onAdd()
  }
  return (
    <Card style={{ marginBottom:14 }}>
      <div style={{ fontWeight:600, color:'var(--heading)', marginBottom:10 }}>Suivi interne</div>
      <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <select value={type} onChange={e=>setType(e.target.value)} style={{ ...inp, width:'auto' }}>
          {['note','appel','visite','validation','modification'].map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <input value={contenu} onChange={e=>setContenu(e.target.value)} placeholder="Ajouter une note de suivi…" style={{ ...inp, flex:1, minWidth:160 }} />
        <Btn onClick={ajouter} disabled={saving}>Ajouter</Btn>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {suivi.map(n => (
          <div key={n.id} style={{ borderLeft:'3px solid var(--accent)', padding:'4px 0 4px 10px' }}>
            <div style={{ fontSize:13, color:'var(--text)' }}>{n.contenu}</div>
            <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>{n.type_contact} · {new Date(n.date_contact).toLocaleString('fr-BE')}</div>
          </div>
        ))}
        {suivi.length === 0 && <div style={{ fontSize:13, color:'var(--text-muted)' }}>Aucune note pour l'instant.</div>}
      </div>
    </Card>
  )
}

function Rapport({ souhaitId, rapport, onChange, profile, flash }) {
  const [f, setF] = useState({ deroulement:'', etat_patient:'', incidents:'', observations:'' })
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (rapport) setF({ deroulement:rapport.deroulement||'', etat_patient:rapport.etat_patient||'', incidents:rapport.incidents||'', observations:rapport.observations||'' }) }, [rapport?.id])
  const set = (k,v) => setF(s => ({ ...s, [k]:v }))

  async function enregistrer() {
    setSaving(true)
    const payload = { souhait_id:souhaitId, profile_id:profile?.id, auteur_nom:`${profile?.prenom||''} ${profile?.nom||''}`.trim(), role_auteur:profile?.role, ...f }
    if (rapport) await supabase.from('souhait_rapports').update(payload).eq('id', rapport.id)
    else await supabase.from('souhait_rapports').insert(payload)
    setSaving(false); onChange(); flash('Rapport enregistré.')
  }
  async function togglePublie() {
    const nv = !rapport.publie
    await supabase.from('souhait_rapports').update({ publie:nv, publie_le: nv ? new Date().toISOString() : null }).eq('id', rapport.id)
    onChange(); flash(nv ? 'Rapport publié — visible du partenaire.' : 'Rapport dépublié.')
  }

  return (
    <Card>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:8 }}>
        <div style={{ fontWeight:600, color:'var(--heading)' }}>Rapport final</div>
        {rapport && <Pill color={rapport.publie?'#3B6D11':'#BA7517'} bg={rapport.publie?'#EAF3DE':'#FAEEDA'}>{rapport.publie?'Publié':'Brouillon'}</Pill>}
      </div>
      <TA label="Déroulement" value={f.deroulement} set={v=>set('deroulement',v)} rows={3} />
      <TA label="État du patient" value={f.etat_patient} set={v=>set('etat_patient',v)} rows={2} />
      <TA label="Incidents éventuels" value={f.incidents} set={v=>set('incidents',v)} rows={2} />
      <TA label="Observations" value={f.observations} set={v=>set('observations',v)} rows={2} />
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <Btn onClick={enregistrer} disabled={saving}>{saving?'Enregistrement…':'✓ Enregistrer le rapport'}</Btn>
        {rapport && <Btn kind={rapport.publie?'soft':'ok'} onClick={togglePublie}>{rapport.publie?'Dépublier':'📢 Publier (visible partenaire)'}</Btn>}
      </div>
    </Card>
  )
}
