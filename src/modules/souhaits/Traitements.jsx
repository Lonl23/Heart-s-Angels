import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, Sel, inp, lbl } from '@/components/ui'
import { recalcPerfusion, debitLabel, LIQUIDES } from './medCalc'

const HEURES = Array.from({ length:24 }, (_,i) => String(i).padStart(2,'0') + ':00')
const aPerfusion = m => { const p = m.perfusion||{}; return !!(p.debit_ml_h || p.debit_gttes_min || p.volume_ml || p.type_liquide || p.quantite_med) }

export default function Traitements({ souhaitId, readOnly=false }) {
  const [internes, setInternes] = useState([])
  const [partenaire, setPartenaire] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data: ints } = await supabase.from('souhait_medicaments').select('*').eq('souhait_id', souhaitId).order('created_at')
    setInternes(ints || [])
    const { data: dem } = await supabase.from('demandes_souhaits').select('id').eq('souhait_id', souhaitId).limit(1)
    if (dem?.[0]) { const { data: pm } = await supabase.from('souhait_medicaments').select('*').eq('demande_id', dem[0].id); setPartenaire(pm || []) }
    else setPartenaire([])
    setLoading(false)
  }
  async function save(f) {
    const payload = {
      souhait_id: souhaitId, medicament:f.medicament, dosage:f.dosage||null, voie:f.voie||null,
      type_admin: f.type_admin || 'programme',
      horaires: f.type_admin==='programme' ? (f.horaires||[]) : null,
      perfusion: f.estPerf ? (f.perfusion||{}) : {},
      posologie_max: f.type_admin==='si_necessaire' ? (f.posologie_max||null) : null,
      notes: f.notes||null,
    }
    if (f.id) await supabase.from('souhait_medicaments').update(payload).eq('id', f.id)
    else await supabase.from('souhait_medicaments').insert(payload)
    setForm(null); load()
  }
  async function supprimer(m) { if (!confirm('Supprimer ce traitement ?')) return; await supabase.from('souhait_medicaments').delete().eq('id', m.id); load() }
  function editer(m) { setForm({ ...m, horaires: Array.isArray(m.horaires)?m.horaires:[], perfusion:m.perfusion||{}, estPerf: aPerfusion(m) }) }

  if (loading) return <p style={{ color:'var(--text-muted)' }}>Chargement…</p>

  return (
    <div>
      {partenaire.length > 0 && (
        <Card style={{ marginBottom:14, background:'var(--bg-alt)' }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Transmis par le partenaire (lecture seule)</div>
          {partenaire.map(m => <LigneMed key={m.id} m={m} />)}
        </Card>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontWeight:600, color:'var(--heading)' }}>Traitements (interne)</div>
        {!readOnly && <Btn onClick={()=>setForm({ type_admin:'programme', horaires:[], perfusion:{}, estPerf:false })}>+ Ajouter</Btn>}
      </div>
      {form && <FormMed form={form} setForm={setForm} onSave={save} />}

      {internes.length === 0 ? <Card>Aucun traitement interne.</Card> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {internes.map(m => (
            <Card key={m.id} style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start' }}>
              <LigneMed m={m} />
              {!readOnly && (
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <Btn kind="soft" onClick={()=>editer(m)} style={{ padding:'5px 10px' }}>Modifier</Btn>
                  <Btn kind="danger" onClick={()=>supprimer(m)} style={{ padding:'5px 10px' }}>✕</Btn>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function LigneMed({ m }) {
  const p = m.perfusion || {}; const perf = aPerfusion(m)
  return (
    <div style={{ borderLeft:'3px solid var(--accent)', padding:'2px 0 2px 10px', flex:1 }}>
      <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>
        {m.medicament} {m.dosage && <span style={{ fontWeight:400, color:'var(--text-muted)' }}>· {m.dosage}</span>}
        {m.type_admin==='si_necessaire' && <span style={{ marginLeft:6, fontSize:11.5, color:'#BA7517', fontWeight:700 }}>SI NÉCESSAIRE</span>}
        {perf && <span style={{ marginLeft:6, fontSize:11.5, color:'#185FA5', fontWeight:700 }}>PERFUSION</span>}
      </div>
      <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{[m.voie, debitLabel(m)].filter(Boolean).join(' · ')}</div>
      {perf && <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{[p.type_liquide, p.volume_ml && `${p.volume_ml} ml`, p.quantite_med && `contient ${p.quantite_med}`, p.duree_min && `durée ${p.duree_min} min`].filter(Boolean).join(' · ')}</div>}
      {m.type_admin==='programme' && Array.isArray(m.horaires) && m.horaires.length>0 && <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Heures : {m.horaires.join(', ')}</div>}
      {m.type_admin==='si_necessaire' && m.posologie_max && <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Max/jour : {m.posologie_max}</div>}
      {m.notes && <div style={{ fontSize:12, color:'var(--text-2)' }}>{m.notes}</div>}
    </div>
  )
}

function FormMed({ form, setForm, onSave }) {
  const set = (k,v) => setForm(s => ({ ...s, [k]:v }))
  const setPerf = (k,v) => setForm(s => ({ ...s, perfusion: recalcPerfusion({ ...(s.perfusion||{}), [k]:v }, k) }))
  const [saving, setSaving] = useState(false)
  const t = form.type_admin || 'programme'
  const heures = Array.isArray(form.horaires) ? form.horaires : []
  const toggleH = h => set('horaires', heures.includes(h) ? heures.filter(x=>x!==h) : [...heures, h].sort())
  const p = form.perfusion || {}
  async function go() { if (!form.medicament?.trim()) { alert('Nom du médicament requis.'); return } setSaving(true); await onSave(form); setSaving(false) }

  return (
    <Card style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontWeight:600, color:'var(--text)' }}>{form.id?'Modifier le traitement':'Nouveau traitement'}</div>
        <Btn kind="soft" onClick={()=>setForm(null)}>Annuler</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'0 12px' }}>
        <F label="Médicament" value={form.medicament} set={v=>set('medicament',v)} required />
        <F label="Dosage" value={form.dosage} set={v=>set('dosage',v)} />
        <F label="Voie d'administration" value={form.voie} set={v=>set('voie',v)} placeholder="Per os, IV, IM, SC…" />
      </div>

      <label style={lbl}>Type</label>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        {[['programme','Programmé'],['si_necessaire','Si nécessaire']].map(([v,l]) => (
          <button key={v} type="button" onClick={()=>set('type_admin',v)} style={{ padding:'7px 14px', borderRadius:99, border:`1.5px solid ${t===v?'var(--accent)':'var(--border)'}`, background:t===v?'var(--accent)':'var(--card)', color:t===v?'#fff':'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>{l}</button>
        ))}
      </div>

      {t==='programme' && (
        <div style={{ marginBottom:12 }}>
          <label style={lbl}>Heures d'administration (cochez)</label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(62px,1fr))', gap:6 }}>
            {HEURES.map(h => {
              const on = heures.includes(h)
              return <button key={h} type="button" onClick={()=>toggleH(h)} style={{ padding:'8px 4px', borderRadius:8, border:`1.5px solid ${on?'#3B6D11':'var(--border)'}`, background:on?'#EAF3DE':'var(--surface)', color:on?'#3B6D11':'var(--text-2)', fontSize:12.5, fontWeight:on?700:500, cursor:'pointer' }}>{h}</button>
            })}
          </div>
          {heures.length>0 && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>Sélectionnées : {heures.join(', ')}</div>}
        </div>
      )}

      {t==='si_necessaire' && (
        <F label="Posologie maximale sur la journée" value={form.posologie_max||''} set={v=>set('posologie_max',v)} placeholder="ex: max 4 g / 24 h" />
      )}

      <label style={{ ...lbl, display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginTop:4 }}>
        <input type="checkbox" checked={!!form.estPerf} onChange={e=>set('estPerf', e.target.checked)} style={{ width:16, height:16 }} />
        Perfusion (débit, volume, dilution…)
      </label>
      {form.estPerf && (
        <div style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', margin:'8px 0' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'0 12px' }}>
            <Sel label="Type de perfusion (si dilution)" value={p.type_liquide||''} set={v=>setPerf('type_liquide',v)} options={LIQUIDES.map(x=>({v:x,l:x||'—'}))} />
            <F label="Quantité de médicament dans la perfusion" value={p.quantite_med||''} set={v=>setPerf('quantite_med',v)} placeholder="ex: 1 g, 40 mg" />
            <F label="Volume de la perfusion (ml)" type="number" value={p.volume_ml??''} set={v=>setPerf('volume_ml',v)} />
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)', margin:'8px 0 4px' }}>Débit — encodez ml/h <b>ou</b> gouttes/min <b>ou</b> la durée : le reste se calcule (1 ml = 20 gttes).</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:'0 12px' }}>
            <F label="Débit (ml/h)" type="number" value={p.debit_ml_h??''} set={v=>setPerf('debit_ml_h',v)} />
            <F label="Débit (gouttes/min)" type="number" value={p.debit_gttes_min??''} set={v=>setPerf('debit_gttes_min',v)} />
            <F label="Durée (min)" type="number" value={p.duree_min??''} set={v=>setPerf('duree_min',v)} />
          </div>
        </div>
      )}

      <F label="Notes" value={form.notes||''} set={v=>set('notes',v)} />
      <Btn onClick={go} disabled={saving} style={{ width:'100%' }}>{saving?'…':'✓ Enregistrer'}</Btn>
    </Card>
  )
}
