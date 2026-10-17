import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Card, Loading, Flash, Empty } from '@/components/ui'
import { Barres, Colonnes } from './graphiques'
import {
  GRAINS, anneesDisponibles, dansPeriode, libellePeriode, preparerLigne,
  compter, parInstitution, parVolontaire, evolutionAnnees, totalKm, ordreTranches,
} from './agregatsSouhaits.js'

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
      <Colonnes titre="Évolution par année" rows={evo} />
      <div className="ha-graph-grille">
        <Barres titre="Lieux" rows={compter(periode, 'lieu')} />
        <Barres titre="Types d’activités" rows={compter(periode, 'activites')} />
        <Barres titre="Pathologies" rows={compter(periode, 'pathologies')} />
        <Barres titre="Sexe" rows={compter(periode, 'genre')} />
        <Barres titre="Tranches d’âge" rows={ordreTranches(compter(periode, 'tranche'))} />
        <Barres titre="Volontaires" rows={parVolontaire(periode).map(v => ({ label: v.nom, n: v.n }))} />
      </div>
      <Barres titre="Institutions demandeuses" rows={institutions.map(i => ({ label: i.institution, n: i.n }))} />
      <Card style={{ marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Services de chaque institution</h2>
        {!institutions.length ? <p style={{ color: 'var(--text-muted)' }}>Aucune institution sur cette période.</p> : institutions.map(inst => (
          <div key={inst.institution} style={{ marginBottom: 14 }}>
            <strong>{inst.institution}</strong>
            <Barres titre="" rows={inst.services} />
          </div>
        ))}
      </Card>
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
    <Page title="Statistiques" subtitle="Module à part. Présidence et informatique. Les souhaits de formation ne sont pas comptés.">
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
