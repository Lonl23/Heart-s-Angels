import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, fmtAdresse, AdresseAffichee } from '@/components/ui'
import { GROUPES, CHECKLISTS, itemsChecklistTous, lblEtapeTerrain } from './missionSchema'

export default function MissionSummary({ souhaitId, infoOnly=false }) {
  const [m, setM] = useState(null)
  const [meds, setMeds] = useState([])
  useEffect(() => { (async () => {
    const { data: s } = await supabase.from('souhaits').select('mission').eq('id', souhaitId).single()
    setM(s?.mission || {})
    const { data: ints } = await supabase.from('souhait_medicaments').select('*').eq('souhait_id', souhaitId)
    let all = ints || []
    const { data: dem } = await supabase.from('demandes_souhaits').select('id').eq('souhait_id', souhaitId).limit(1)
    if (dem?.[0]) { const { data: pm } = await supabase.from('souhait_medicaments').select('*').eq('demande_id', dem[0].id); all=[...all,...(pm||[])] }
    setMeds(all)
  })() }, [souhaitId])
  if (!m) return null

  const fmt = (f, v) => {
    if (f.t === 'address') { return fmtAdresse(v) ? <AdresseAffichee value={v} compact /> : null }
    if (f.t === 'toggle') return v ? 'Oui' : null
    if (f.t === 'datetime' && v) return new Date(v).toLocaleString('fr-BE')
    if (f.t === 'date' && v) return new Date(v).toLocaleDateString('fr-BE')
    return (v === '' || v == null) ? null : v
  }
  const groupesRemplis = GROUPES.filter(g => g.id !== 'rapport_medical').map(g => ({
    ...g, lignes: g.fields.filter(f => f.t !== 'sep').map(f => ({ l:f.l, v:fmt(f, m[f.k]) })).filter(x => x.v)
  })).filter(g => g.lignes.length)

  const clRempli = (m.vecteurs?.length ? m.vecteurs : [{ id: null, nom: '' }]).flatMap(v => {
    const vc = (v.id && m.vecteur_checklists?.[v.id]) || {}
    const g = m.checklists || {}
    return Object.entries(CHECKLISTS).map(([sec, def]) => {
      const etat = vc[sec] || g[sec] || {}
      return {
        titre: [v.nom, def.titre].filter(Boolean).join(' · '),
        faits: itemsChecklistTous(sec, m).filter(it => etat[it]).length,
        total: itemsChecklistTous(sec, m).length,
      }
    })
  }).filter(c => c.faits > 0)

  const rien = groupesRemplis.length === 0 && meds.length === 0 && clRempli.length === 0 && !(m.vecteurs || []).length && !m.rapport_medical && !m.rapport_observations
  if (rien) return <Card><div style={{ color:'var(--text-muted)', fontSize:13.5 }}>Dossier encore vide. Ouvrez « Préparer le dossier » pour encoder le trajet, les vecteurs et le médical.</div></Card>

  const suiviVecteurs = (m.vecteurs || []).map(v => ({
    id: v.id,
    nom: v.nom || v.plaque || 'Véhicule',
    etape: lblEtapeTerrain(m.vecteur_etapes?.[v.id] || m.etape_terrain, m.vecteur_statuts?.[v.id]),
  }))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {suiviVecteurs.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>Où est le véhicule</div>
          {suiviVecteurs.map(v => (
            <div key={v.id || v.nom} style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:6, fontSize:14 }}>
              <span style={{ color:'var(--text-muted)' }}>{v.nom}</span>
              <span style={{ fontWeight:700, color:'var(--heading)' }}>{v.etape}</span>
            </div>
          ))}
        </Card>
      )}
      {groupesRemplis.map(g => (
        <Card key={g.id}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>{g.label}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'8px 24px' }}>
            {g.lignes.map((x,i) => <div key={i}><div style={{ fontSize:12, color:'var(--text-muted)' }}>{x.l}</div><div style={{ fontSize:13.5, color:'var(--text)', whiteSpace:'pre-wrap' }}>{x.v}</div></div>)}
          </div>
        </Card>
      ))}

      {!infoOnly && meds.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>Traitements</div>
          {meds.map(md => {
            const prises = Array.isArray(md.prises) ? md.prises : (md.prises && typeof md.prises === 'object' ? Object.entries(md.prises).filter(([,p])=>p?.donne).map(([h,p])=>({heure:p.reelle||h})) : [])
            const donnes = prises.filter(p => p.heure || p.donne)
            return (
              <div key={md.id} style={{ borderLeft:'3px solid var(--accent)', padding:'2px 0 6px 10px', marginBottom:6 }}>
                <div style={{ fontSize:13.5, fontWeight:600 }}>{md.medicament} {md.dosage && <span style={{ fontWeight:400, color:'var(--text-muted)' }}>· {md.dosage}</span>}</div>
                <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                  {donnes.length > 0 ? `Administré : ${donnes.map(p=>p.heure||'?').join(', ')}` : (Array.isArray(md.horaires)&&md.horaires.length ? `Prévu : ${md.horaires.join(', ')}` : 'Non administré')}
                </div>
              </div>
            )
          })}
        </Card>
      )}
      {infoOnly && meds.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>Traitements prévus</div>
          {meds.map(md => (
            <div key={md.id} style={{ borderLeft:'3px solid var(--accent)', padding:'2px 0 6px 10px', marginBottom:6 }}>
              <div style={{ fontSize:13.5, fontWeight:600 }}>{md.medicament} {md.dosage && <span style={{ fontWeight:400, color:'var(--text-muted)' }}>· {md.dosage}</span>}</div>
              <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                {md.type_admin==='si_necessaire' ? `Si nécessaire${md.posologie_max?` · max ${md.posologie_max}`:''}` : (Array.isArray(md.horaires)&&md.horaires.length ? `Heures : ${md.horaires.join(', ')}` : 'Horaires à préciser')}
              </div>
            </div>
          ))}
        </Card>
      )}

      {!infoOnly && clRempli.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>Checklists</div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
            {clRempli.map((c,i) => <div key={i} style={{ fontSize:13 }}><span style={{ color:'var(--text-muted)' }}>{c.titre} : </span><strong>{c.faits}/{c.total}</strong></div>)}
          </div>
        </Card>
      )}

      {!infoOnly && m.rapport_medical && <Card><div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:6 }}>Rapport de mission</div><div style={{ fontSize:13.5, color:'var(--text-2)', whiteSpace:'pre-wrap' }}>{m.rapport_medical}</div></Card>}
      {!infoOnly && m.rapport_observations && <Card><div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:6 }}>Notes logistiques</div><div style={{ fontSize:13.5, color:'var(--text-2)', whiteSpace:'pre-wrap' }}>{m.rapport_observations}</div></Card>}
    </div>
  )
}
