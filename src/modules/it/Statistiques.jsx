import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Card, Loading, Flash, Empty } from '@/components/ui'
import {
  GRAINS, anneesDisponibles, dansPeriode, libellePeriode, preparerLigne,
  compter, parInstitution, parVolontaire, evolutionAnnees, totalKm, ordreTranches,
} from './agregatsSouhaits.js'

function Tableau({ titre, rows, unite = 'souhaits' }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: 'var(--heading)' }}>{titre}</h2>
      {!rows.length ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>Aucune donnée sur cette période.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            {rows.map(r => (
              <tr key={r.label || r.institution || r.nom || r.annee}>
                <td style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>{r.label || r.institution || r.nom || r.annee}</td>
                <td style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700 }}>{r.n} {unite}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function Souhaits({ lignes }) {
  const annees = anneesDisponibles(lignes)
  const [grain, setGrain] = useState('mois')
  const [annee, setAnnee] = useState(annees[0])
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const prep = useMemo(() => lignes.map(preparerLigne), [lignes])
  const periode = useMemo(
    () => prep.filter(l => dansPeriode(l.jour, { grain, annee, mois })),
    [prep, grain, annee, mois],
  )
  const evo = evolutionAnnees(prep)
  const institutions = parInstitution(periode)

  return (
    <div>
      <div className="ha-tabs" style={{ marginBottom: 12 }}>
        {GRAINS.map(g => (
          <button key={g.v} type="button" className={'ha-tab' + (grain === g.v ? ' is-on' : '')} onClick={() => setGrain(g.v)}>{g.l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <label>Année
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))} style={{ marginLeft: 8 }}>
            {annees.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        {grain !== 'annee' && (
          <label>{grain === 'mois' ? 'Mois' : grain === 'trimestre' ? 'Mois du trimestre' : 'Mois du semestre'}
            <select value={mois} onChange={e => setMois(Number(e.target.value))} style={{ marginLeft: 8 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2026, m - 1, 1).toLocaleDateString('fr-BE', { month: 'long' })}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p style={{ fontWeight: 700 }}>{libellePeriode({ grain, annee, mois })} · {periode.length} souhait{periode.length > 1 ? 's' : ''} · {totalKm(periode)} km</p>
      <Card style={{ marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Évolution par année</h2>
        {evo.map(r => (
          <div key={r.annee} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 40px', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span>{r.annee}</span>
            <span style={{ background: 'var(--border)', borderRadius: 99, height: 10, display: 'block' }}>
              <span style={{ display: 'block', width: r.pct + '%', height: '100%', background: 'var(--accent)', borderRadius: 99 }} />
            </span>
            <strong>{r.n}</strong>
          </div>
        ))}
      </Card>
      <Tableau titre="Lieux" rows={compter(periode, 'lieu')} />
      <Tableau titre="Types d’activités" rows={compter(periode, 'activites')} />
      <Tableau titre="Pathologies" rows={compter(periode, 'pathologies')} />
      <Tableau titre="Sexe" rows={compter(periode, 'genre')} />
      <Tableau titre="Tranches d’âge" rows={ordreTranches(compter(periode, 'tranche'))} />
      <Card style={{ marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Institutions et services</h2>
        {!institutions.length ? <p style={{ color: 'var(--text-muted)' }}>Aucune institution sur cette période.</p> : institutions.map(inst => (
          <div key={inst.institution} style={{ marginBottom: 10 }}>
            <strong>{inst.institution}</strong> · {inst.n}
            <div style={{ paddingLeft: 12, fontSize: 13.5, color: 'var(--text-2)' }}>
              {inst.services.map(s => <div key={s.label}>{s.label} · {s.n}</div>)}
            </div>
          </div>
        ))}
      </Card>
      <Tableau titre="Volontaires" rows={parVolontaire(periode).map(v => ({ label: v.nom, n: v.n }))} />
      <Card>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Kilométrage</h2>
        <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{totalKm(periode)} km</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Somme des écarts entre le kilométrage de départ et celui du retour, quand les deux sont encodés.</p>
      </Card>
    </div>
  )
}

export default function Statistiques() {
  const [vue, setVue] = useState('souhaits')
  const [lignes, setLignes] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    supabase.rpc('stats_souhaits').then(({ data, error }) => {
      if (error || data?.ok === false) setErr(error?.message || data?.error || 'Statistiques inaccessibles.')
      else setLignes(data?.lignes || [])
    })
  }, [])

  return (
    <Page title="Statistiques" subtitle="Présidence et informatique. Les souhaits de formation ne sont pas comptés.">
      <div className="ha-tabs" style={{ marginBottom: 16 }}>
        <button type="button" className={'ha-tab' + (vue === 'souhaits' ? ' is-on' : '')} onClick={() => setVue('souhaits')}>Statistique Souhaits</button>
        <button type="button" className={'ha-tab' + (vue === 'secours' ? ' is-on' : '')} onClick={() => setVue('secours')}>Statistiques Département secours</button>
      </div>
      {vue === 'secours' ? (
        <Empty title="Statistiques du département secours" hint="Cette partie sera codée plus tard." />
      ) : err ? <Flash kind="err">{err}</Flash>
        : lignes == null ? <Loading />
          : <Souhaits lignes={lignes} />}
    </Page>
  )
}
