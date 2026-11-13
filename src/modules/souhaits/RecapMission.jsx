import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Loading, Flash, AdresseAffichee, fmtAdresse } from '@/components/ui'
import RappelAsbl from './RappelAsbl'

const fmt = v => {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })
}

function Ligne({ k, v }) {
  if (v == null || v === '' || v === '—') return null
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k}</div>
      <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.4 }}>{v}</div>
    </div>
  )
}

function Bloc({ titre, children }) {
  return (
    <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginTop: 12 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem', color: 'var(--heading)' }}>{titre}</h2>
      {children}
    </section>
  )
}

export default function RecapMission({ souhaitId, onBack }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let stop = false
    supabase.rpc('recap_mission', { p_souhait: souhaitId }).then(({ data, error }) => {
      if (stop) return
      if (error || data?.ok === false) setErr(error?.message || data?.error || 'Récapitulatif inaccessible.')
      else setD(data)
    })
    return () => { stop = true }
  }, [souhaitId])

  if (err) return <div style={{ padding: 16 }}><Flash kind="err">{err}</Flash>{onBack && <Btn kind="soft" onClick={onBack}>← Menu</Btn>}</div>
  if (!d) return <div style={{ padding: 16 }}><Loading /></div>

  return (
    <div style={{ padding: '12px 14px 32px' }}>
      {onBack && <Btn kind="soft" onClick={onBack}>← Menu de la mission</Btn>}
      <h1 style={{ fontSize: '1.45rem', color: 'var(--heading)', margin: '12px 0 4px' }}>Récapitulatif</h1>
      {d.description && <p style={{ marginTop: 0, color: 'var(--text-2)' }}>{d.description}</p>}
      <RappelAsbl />
      <Bloc titre="Base">
        <Ligne k="Base" v={d.base?.nom} />
        {fmtAdresse(d.base?.adresse) ? <Ligne k="Adresse" v={<AdresseAffichee value={d.base.adresse} />} /> : null}
        <Ligne k="Rendez-vous" v={fmt(d.base?.rdv)} />
        <Ligne k="Départ prévu" v={fmt(d.base?.depart) || (d.heure_depart ? String(d.heure_depart).slice(0, 5) : '')} />
      </Bloc>
      <Bloc titre="Prise en charge">
        <Ligne k="Lieu" v={d.pec?.type} />
        <Ligne k="Institution" v={d.pec?.institution} />
        {fmtAdresse(d.pec?.adresse) ? <Ligne k="Adresse" v={<AdresseAffichee value={d.pec.adresse} />} /> : null}
        <Ligne k="Service" v={[d.pec?.service, d.pec?.etage && `étage ${d.pec.etage}`, d.pec?.aile && `aile ${d.pec.aile}`, d.pec?.chambre && `ch. ${d.pec.chambre}`].filter(Boolean).join(' · ')} />
        <Ligne k="Heure attendue" v={fmt(d.pec?.heure)} />
        <Ligne k="Départ souhaité" v={fmt(d.pec?.depart)} />
        <Ligne k="Précisions" v={d.pec?.precisions} />
      </Bloc>
      <Bloc titre="Destination et activités">
        {fmtAdresse(d.destination?.adresse) ? <Ligne k="Adresse" v={<AdresseAffichee value={d.destination.adresse} />} /> : null}
        <Ligne k="Heure attendue" v={fmt(d.destination?.heure)} />
        <Ligne k="Précisions" v={d.destination?.precisions} />
        {(d.activites || []).map(a => (
          <div key={a.id || a.nom} style={{ marginTop: 10 }}>
            <Ligne k={a.nom || 'Activité'} v={[fmt(a.heure) || a.heure, a.telephone, a.notes].filter(Boolean).join(' · ')} />
            {fmtAdresse(a.adresse) ? <AdresseAffichee value={a.adresse} compact /> : null}
          </div>
        ))}
        {(d.lieux || []).map(l => (
          <div key={l.id} style={{ marginTop: 10 }}>
            <Ligne k={l.nom || l.type || 'Lieu'} v={l.notes} />
            {fmtAdresse(l.adresse) ? <AdresseAffichee value={l.adresse} compact /> : null}
          </div>
        ))}
      </Bloc>
      <Bloc titre="Retour">
        <Ligne k="Type" v={d.retour?.type} />
        <Ligne k="Heure attendue" v={fmt(d.retour?.heure) || (d.heure_retour ? String(d.heure_retour).slice(0, 5) : '')} />
        <Ligne k="Précisions" v={d.retour?.precisions} />
      </Bloc>
    </div>
  )
}
