import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Btn, F, TA, Sel } from '@/components/ui'
import { STATUTS, PIPELINE_ENCODE, statutsDisponibles, peutPasserNonRealise } from './Souhaits'

export default function FormSouhait({ initial, onDone, inline=false }) {
  const { profile } = useAuth()
  const [f, setF] = useState(initial || {
    beneficiaire_prenom:'', beneficiaire_nom:'', beneficiaire_ddn:'', beneficiaire_contact:'',
    description:'', localisation:'', notes_medicales:'', besoins_specifiques:'',
    date_souhaitee:'', date_fin:'', courte_duree:false, heure_depart:'', heure_retour:'',
    statut:'nouveau', priorite:2,
  })
  const set = (k,v) => setF(s => ({ ...s, [k]:v }))
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!f.beneficiaire_nom || !f.description) { alert('Nom du bénéficiaire et description requis.'); return }
    const statut = inline
      ? undefined
      : (f.statut === 'non_realise' && initial?.id && !peutPasserNonRealise(initial.statut))
        ? initial.statut
        : f.statut
    setSaving(true)
    const payload = {
      beneficiaire_prenom:f.beneficiaire_prenom, beneficiaire_nom:f.beneficiaire_nom,
      beneficiaire_ddn:f.beneficiaire_ddn||null, beneficiaire_contact:f.beneficiaire_contact||null,
      description:f.description, localisation:f.localisation||null,
      notes_medicales:f.notes_medicales||null, besoins_specifiques:f.besoins_specifiques||null,
      date_souhaitee:f.date_souhaitee||null,
      date_fin: f.date_fin && f.date_souhaitee && f.date_fin >= f.date_souhaitee ? f.date_fin : (f.date_souhaitee || null),
      courte_duree: !!f.courte_duree,
      heure_depart: f.courte_duree && f.heure_depart ? f.heure_depart : null,
      heure_retour: f.courte_duree && f.heure_retour ? f.heure_retour : null,
      priorite:Number(f.priorite)||2,
    }
    if (statut !== undefined) payload.statut = statut
    if (f.id) {
      const { error } = await supabase.from('souhaits').update(payload).eq('id', f.id)
      setSaving(false)
      if (error) { alert('Erreur : ' + error.message); return }
      onDone(f.id)
      return
    }
    const { data, error } = await supabase.from('souhaits').insert({ ...payload, created_by:profile?.id }).select('id').single()
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    onDone(data?.id)
  }

  const Wrap = inline ? 'div' : 'div'
  return (
    <Wrap style={inline ? {} : { padding:'clamp(16px,3vw,28px)', maxWidth:760, margin:'0 auto' }}>
      {!inline && (
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <h1 style={{ fontSize:'1.5rem', color:'var(--heading)', margin:0 }}>{f.id ? 'Modifier le souhait' : 'Nouveau souhait'}</h1>
            {!f.id && <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--text-muted)' }}>Le dossier commencera en « Nouveau ». Vous pourrez ensuite le préparer.</p>}
          </div>
          <Btn kind="soft" onClick={()=>onDone(false)}>← Retour</Btn>
        </div>
      )}

      <Card style={{ marginBottom:14 }}>
        <div style={{ fontWeight:600, color:'var(--heading)', marginBottom:10 }}>Bénéficiaire</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
          <F label="Prénom" value={f.beneficiaire_prenom} set={v=>set('beneficiaire_prenom',v)} required />
          <F label="Nom" value={f.beneficiaire_nom} set={v=>set('beneficiaire_nom',v)} required />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
          <F label="Date de naissance" type="date" value={f.beneficiaire_ddn} set={v=>set('beneficiaire_ddn',v)} />
          <F label="Contact / famille référente" value={f.beneficiaire_contact} set={v=>set('beneficiaire_contact',v)} />
        </div>
      </Card>

      <Card style={{ marginBottom:14 }}>
        <div style={{ fontWeight:600, color:'var(--heading)', marginBottom:10 }}>Le souhait</div>
        <TA label="Description *" value={f.description} set={v=>set('description',v)} rows={3} />
        <F label="Lieu (affiché au calendrier, sans nom de patient)" value={f.localisation} set={v=>set('localisation',v)} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
          <F label="Du" type="date" value={f.date_souhaitee} set={v=>setF(s => ({ ...s, date_souhaitee:v, date_fin: (!s.date_fin || s.date_fin < v) ? v : s.date_fin }))} />
          <F label="Au (si plusieurs jours)" type="date" value={f.date_fin || f.date_souhaitee} set={v=>set('date_fin',v)} />
        </div>
        <label className="ha-check" style={{ marginBottom:10 }}>
          <input type="checkbox" checked={!!f.courte_duree} onChange={e=>set('courte_duree', e.target.checked)} />
          <span>Souhait de courte durée (sinon toute la journée, minuit à minuit)</span>
        </label>
        {!!f.courte_duree && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10 }}>
            <F label="Heure de départ" type="time" value={(f.heure_depart||'').slice(0,5)} set={v=>set('heure_depart',v)} />
            <F label="Heure de retour" type="time" value={(f.heure_retour||'').slice(0,5)} set={v=>set('heure_retour',v)} />
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10 }}>
          {!inline && !f.id && <Sel label="Statut" value={f.statut} set={v=>set('statut',v)} options={PIPELINE_ENCODE.map(k=>({v:k,l:STATUTS[k].l}))} />}
          {!inline && f.id && <Sel label="Statut" value={f.statut} set={v=>set('statut',v)} options={statutsDisponibles(initial?.statut || f.statut).map(k=>({v:k,l:STATUTS[k].l}))} />}
          <Sel label="Priorité" value={String(f.priorite)} set={v=>set('priorite',v)} options={[
            { v:'1', l:'1 · Basse' }, { v:'2', l:'2 · Normale' }, { v:'3', l:'3 · Haute' }, { v:'4', l:'4 · Urgente' }, { v:'5', l:'5 · Critique' },
          ]} />
        </div>
      </Card>

      <Card style={{ marginBottom:14 }}>
        <div style={{ fontWeight:600, color:'var(--heading)', marginBottom:10 }}>Médical & besoins</div>
        <TA label="Notes médicales (confidentiel)" value={f.notes_medicales} set={v=>set('notes_medicales',v)} rows={2} />
        <TA label="Besoins spécifiques (matériel, logistique…)" value={f.besoins_specifiques} set={v=>set('besoins_specifiques',v)} rows={2} />
      </Card>

      <Btn onClick={save} disabled={saving} style={{ width:'100%' }}>{saving?'Enregistrement…':'Enregistrer'}</Btn>
    </Wrap>
  )
}
