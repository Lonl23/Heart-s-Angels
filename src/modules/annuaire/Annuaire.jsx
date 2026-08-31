import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, TA, Sel, PhoneF, AddressFields, fmtAdresse, lbl, Empty } from '@/components/ui'
import { CATEGORIES, ACCOMPAGNANT_FIELDS, catInfo } from './annuaireSchema'

const COLS = ['nom', 'prenom', 'beneficiaire_id', 'institution_id']

// éclate un enregistrement DB en objet plat pour le formulaire
const toForm = r => ({ id:r.id, nom:r.nom||'', prenom:r.prenom||'', beneficiaire_id:r.beneficiaire_id||null, institution_id:r.institution_id||null, ...(r.data||{}) })
// reconstruit l'enregistrement DB depuis le formulaire
function toRecord(cat, f) {
  const data = { ...f }; delete data.id; COLS.forEach(k => delete data[k])
  return { categorie:cat, nom:f.nom||null, prenom:f.prenom||null, beneficiaire_id:f.beneficiaire_id||null, institution_id:f.institution_id||null, data }
}
const nomComplet = r => [r.prenom, r.nom].filter(Boolean).join(' ') || '(sans nom)'

export default function Annuaire() {
  const [cat, setCat] = useState('beneficiaire')
  const [rows, setRows] = useState([])
  const [institutions, setInstitutions] = useState([])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)   // objet formulaire ou null

  useEffect(() => { load() }, [cat])
  async function load() {
    const { data } = await supabase.from('annuaire').select('*').eq('categorie', cat).order('nom')
    setRows(data || [])
    if (institutions.length === 0) { const { data: inst } = await supabase.from('annuaire').select('id,nom').eq('categorie','institution').order('nom'); setInstitutions(inst||[]) }
  }
  async function supprimer(r) { if (!confirm('Supprimer cette fiche ?')) return; await supabase.from('annuaire').delete().eq('id', r.id); load() }

  const info = catInfo(cat)
  const filtered = rows.filter(r => !q || `${r.prenom} ${r.nom} ${JSON.stringify(r.data)}`.toLowerCase().includes(q.toLowerCase()))

  if (editing) return <FicheContact cat={cat} form={editing} setForm={setEditing} institutions={institutions} onDone={()=>{ setEditing(null); load() }} />

  return (
    <Page title="Annuaire" subtitle="Contacts médicaux, institutions et accompagnants.">
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
        {CATEGORIES.map(c => (
          <button key={c.v} onClick={()=>{ setCat(c.v); setQ('') }} style={{ padding:'8px 13px', borderRadius:9, border:'1px solid var(--border)', background: cat===c.v?'var(--accent)':'var(--card)', color: cat===c.v?'#fff':'var(--text-2)', fontWeight:600, fontSize:13, cursor:'pointer' }}>{c.icon} {c.l}</button>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <input className="ha-search" value={q} onChange={e=>setQ(e.target.value)} placeholder={`Rechercher un(e) ${info.titre.toLowerCase()}…`} style={{ flex:1, minWidth:180, maxWidth:'none' }} />
        <Btn onClick={()=>setEditing({})}>+ {info.titre}</Btn>
      </div>

      {filtered.length === 0 ? <Empty title={`Aucun(e) ${info.titre.toLowerCase()}`} hint={q ? 'Aucun résultat pour cette recherche.' : 'Ajoutez une fiche pour la retrouver ici.'} /> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
          {filtered.map(r => <ContactCard key={r.id} r={r} cat={cat} institutions={institutions} onEdit={()=>setEditing(toForm(r))} onDelete={()=>supprimer(r)} />)}
        </div>
      )}
    </Page>
  )
}

function ContactCard({ r, cat, institutions, onEdit, onDelete }) {
  const d = r.data || {}
  const inst = r.institution_id && institutions.find(i => i.id === r.institution_id)
  return (
    <Card style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
        <div style={{ fontWeight:700, color:'var(--text)' }}>{nomComplet(r)}</div>
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={onEdit} style={miniBtn}>✎</button>
          <button onClick={onDelete} style={{ ...miniBtn, color:'#C8435A' }}>✕</button>
        </div>
      </div>
      <div style={{ fontSize:12.5, color:'var(--text-muted)', display:'flex', flexDirection:'column', gap:2 }}>
        {d.type_medical && <span>{d.type_medical}{d.specialite?` · ${d.specialite}`:''}</span>}
        {d.type_institution && <span>{d.type_institution}</span>}
        {d.domaine && <span>{d.domaine}</span>}
        {d.type_partenaire && <span>{d.type_partenaire}</span>}
        {d.contact_personne && <span>Contact : {d.contact_personne}</span>}
        {inst && <span>🏥 {inst.nom}</span>}
        {d.telephone && <span>📞 {d.telephone}</span>}
        {d.email && <span>✉️ {d.email}</span>}
        {d.adresse && fmtAdresse(d.adresse) && <span>📍 {fmtAdresse(d.adresse)}</span>}
      </div>
      {cat === 'beneficiaire' && <Accompagnants beneficiaireId={r.id} compact />}
    </Card>
  )
}

function FicheContact({ cat, form, setForm, institutions, onDone }) {
  const { profile } = useAuth()
  const info = catInfo(cat)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    const rec = toRecord(cat, form)
    if (form.id) await supabase.from('annuaire').update(rec).eq('id', form.id)
    else await supabase.from('annuaire').insert({ ...rec, created_by: profile?.id })
    setSaving(false); onDone()
  }
  return (
    <Page title={`${form.id ? 'Modifier' : 'Nouveau'} — ${info.titre}`} action={<Btn kind="soft" onClick={onDone}>← Retour</Btn>}>
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'0 20px' }}>
          {info.fields.map(f => <Champ key={f.k} f={f} val={form[f.k]} set={v=>set(f.k, v)} institutions={institutions} />)}
        </div>
        <Btn onClick={save} disabled={saving} style={{ width:'100%', marginTop:10 }}>{saving?'…':'✓ Enregistrer'}</Btn>
      </Card>
      {cat === 'beneficiaire' && form.id && <Card><Accompagnants beneficiaireId={form.id} /></Card>}
      {cat === 'beneficiaire' && !form.id && <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Enregistrez d'abord le bénéficiaire pour ajouter ses accompagnants.</div>}
    </Page>
  )
}

function Champ({ f, val, set, institutions }) {
  if (f.t === 'address') return <div style={{ gridColumn:'1 / -1', margin:'8px 0' }}><label style={lbl}>{f.l}</label><AddressFields value={val} set={set} /></div>
  if (f.t === 'textarea') return <div style={{ gridColumn:'1 / -1' }}><TA label={f.l} value={val||''} set={set} rows={2} /></div>
  if (f.t === 'phone') return <PhoneF label={f.l} value={val||''} set={set} />
  if (f.t === 'select') return <Sel label={f.l} value={val||''} set={set} options={f.options.map(o=>({v:o,l:o||'—'}))} />
  if (f.t === 'institution') return <Sel label={f.l} value={val||''} set={v=>set(v||null)} options={[{v:'',l:'—'}, ...institutions.map(i=>({v:i.id,l:i.nom}))]} />
  const type = f.t === 'date' ? 'date' : 'text'
  return <F label={f.l} type={type} value={val||''} set={set} />
}

function Accompagnants({ beneficiaireId, compact }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null)
  useEffect(() => { load() }, [beneficiaireId])
  async function load() { const { data } = await supabase.from('annuaire').select('*').eq('categorie','accompagnant').eq('beneficiaire_id', beneficiaireId).order('nom'); setRows(data||[]) }
  async function save() {
    const rec = { categorie:'accompagnant', nom:form.nom||null, prenom:form.prenom||null, beneficiaire_id:beneficiaireId, data:{ lien:form.lien||'', telephone:form.telephone||'', email:form.email||'' } }
    if (form.id) await supabase.from('annuaire').update(rec).eq('id', form.id); else await supabase.from('annuaire').insert(rec)
    setForm(null); load()
  }
  async function suppr(r) { await supabase.from('annuaire').delete().eq('id', r.id); load() }

  if (compact) {
    if (rows.length === 0) return null
    return <div style={{ marginTop:6, fontSize:12, color:'var(--text-muted)' }}>👥 {rows.map(r => `${r.prenom||''} ${r.nom||''}`.trim()).join(', ')}</div>
  }
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontWeight:600, color:'var(--heading)' }}>Accompagnants</div>
        <Btn kind="soft" onClick={()=>setForm({})}>+ Ajouter</Btn>
      </div>
      {form && (
        <Card style={{ marginBottom:10, background:'var(--bg-alt)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'0 14px' }}>
            {ACCOMPAGNANT_FIELDS.map(f => f.t==='phone'
              ? <PhoneF key={f.k} label={f.l} value={form[f.k]||''} set={v=>setForm(s=>({...s,[f.k]:v}))} />
              : <F key={f.k} label={f.l} value={form[f.k]||''} set={v=>setForm(s=>({...s,[f.k]:v}))} />)}
          </div>
          <div style={{ display:'flex', gap:8 }}><Btn onClick={save}>✓ Enregistrer</Btn><Btn kind="soft" onClick={()=>setForm(null)}>Annuler</Btn></div>
        </Card>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {rows.map(r => (
          <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px' }}>
            <span style={{ fontSize:13.5 }}>{r.prenom} {r.nom} {r.data?.lien && <span style={{ color:'var(--text-muted)' }}>— {r.data.lien}</span>} {r.data?.telephone && <span style={{ color:'var(--text-muted)' }}>· {r.data.telephone}</span>}</span>
            <div style={{ display:'flex', gap:4 }}>
              <button onClick={()=>setForm({ id:r.id, prenom:r.prenom, nom:r.nom, ...(r.data||{}) })} style={miniBtn}>✎</button>
              <button onClick={()=>suppr(r)} style={{ ...miniBtn, color:'#C8435A' }}>✕</button>
            </div>
          </div>
        ))}
        {rows.length===0 && <div style={{ fontSize:13, color:'var(--text-muted)' }}>Aucun accompagnant.</div>}
      </div>
    </div>
  )
}

const miniBtn = { background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'3px 8px', fontSize:13, color:'var(--text-2)', cursor:'pointer' }
