import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Card, Btn, Loading, Flash, Empty } from '@/components/ui'
import { Barres, Colonnes } from './graphiques'
import { STATUTS } from '../souhaits/statuts'
import { exporterStatsExcel } from './excelStats'
import {
  GRAINS, anneesDisponibles, libellePeriode, preparerLigne, filtrerLignes, valeursUniques,
  compter, parInstitution, parVolontaire, evolutionAnnees, totalKm, ordreTranches, echelleCommune,
} from './agregatsSouhaits.js'

const ORDRE_STATUT = ['nouveau', 'en_attente', 'demande_info_externe', 'pret', 'en_cours', 'terminee_terrain', 'realise', 'non_realise']
const ORDRE_SEXE = ['Femme', 'Homme', 'Non renseigné']

const FILTRE_VIDE = {
  genre: '', tranche: '', pathologie: '', activite: '', lieu: '', institution: '', service: '', volontaire: '',
}

function libelleStatut(code) {
  return STATUTS[code]?.l || code || 'Non renseigné'
}

function trier(rows, ordre, cle = 'label') {
  return [...rows].sort((a, b) => {
    const ia = ordre.indexOf(a[cle])
    const ib = ordre.indexOf(b[cle])
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
}

function Souhaits({ lignes }) {
  const annees = anneesDisponibles(lignes)
  const [grain, setGrain] = useState('ensemble')
  const [annee, setAnnee] = useState(annees[0])
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [masques, setMasques] = useState([])
  const [filtre, setFiltre] = useState(FILTRE_VIDE)
  const [exporting, setExporting] = useState(false)
  const prep = useMemo(() => lignes.map(l => {
    const row = preparerLigne(l)
    return { ...row, statutLabel: libelleStatut(row.statut) }
  }), [lignes])
  const periodeChoisie = { grain, annee, mois }
  const tousStatuts = useMemo(() => {
    const presents = new Set(prep.map(l => l.statut).filter(Boolean))
    const ordre = ORDRE_STATUT.filter(s => presents.has(s))
    for (const s of presents) if (!ordre.includes(s)) ordre.push(s)
    return ordre
  }, [prep])
  const selection = tousStatuts.filter(s => !masques.includes(s))
  const critere = { ...periodeChoisie, ...filtre, statuts: selection }
  const periode = useMemo(() => filtrerLignes(prep, critere), [prep, grain, annee, mois, filtre, selection.join('|')])
  const hors = useMemo(() => {
    const base = { ...periodeChoisie, ...filtre, statuts: selection }
    return {
      genre: filtrerLignes(prep, { ...base, genre: '' }),
      tranche: filtrerLignes(prep, { ...base, tranche: '' }),
      pathologie: filtrerLignes(prep, { ...base, pathologie: '' }),
      activite: filtrerLignes(prep, { ...base, activite: '' }),
      lieu: filtrerLignes(prep, { ...base, lieu: '' }),
      institution: filtrerLignes(prep, { ...base, institution: '', service: '' }),
      service: filtrerLignes(prep, { ...base, service: '' }),
      volontaire: filtrerLignes(prep, { ...base, volontaire: '' }),
      statut: filtrerLignes(prep, { ...base, statuts: null }),
    }
  }, [prep, grain, annee, mois, filtre, selection.join('|')])

  const statuts = trier(
    compter(periode, 'statut').map(r => ({ ...r, code: r.label, label: libelleStatut(r.label) })),
    ORDRE_STATUT,
    'code',
  )
  const lieux = compter(periode, 'lieu')
  const activites = compter(periode, 'activites')
  const pathologies = compter(periode, 'pathologies')
  const sexe = trier(compter(periode, 'genre'), ORDRE_SEXE)
  const ages = ordreTranches(compter(periode, 'tranche'))
  const volontaires = parVolontaire(periode).map(v => ({ label: v.nom, n: v.n, id: v.id }))
  const institutions = parInstitution(periode)
  const evoFiltre = evolutionAnnees(filtrerLignes(prep, { ...filtre, statuts: selection, grain: 'ensemble' }))
  const servicesPlat = institutions.flatMap(inst => inst.services.map(s => ({ ...s, institution: inst.institution })))
  const echelle = echelleCommune([statuts, lieux, activites, pathologies, sexe, ages, volontaires, institutions.map(i => ({ n: i.n })), servicesPlat, evoFiltre])
  const km = totalKm(periode)
  const titrePeriode = libellePeriode(periodeChoisie)
  const filtresActifs = Object.values(filtre).some(Boolean) || masques.length > 0 || grain !== 'ensemble'

  function choix(cle, source = hors[cle] || prep) {
    if (cle === 'volontaire') {
      return parVolontaire(source).map(v => ({ v: v.id || v.nom, l: v.nom }))
    }
    const champ = cle === 'activite' ? 'activites' : cle === 'pathologie' ? 'pathologies' : cle
    return valeursUniques(source, champ).map(v => ({ v, l: v }))
  }

  async function exporter() {
    setExporting(true)
    try {
      const morceaux = []
      if (grain !== 'ensemble') morceaux.push(titrePeriode)
      if (masques.length) morceaux.push(selection.map(libelleStatut).join(', ') || 'Aucun statut')
      for (const [k, label] of [
        ['genre', 'Sexe'], ['tranche', 'Âge'], ['pathologie', 'Pathologie'], ['activite', 'Activité'],
        ['lieu', 'Lieu'], ['institution', 'Institution'], ['service', 'Service'],
      ]) {
        if (filtre[k]) morceaux.push(`${label} : ${filtre[k]}`)
      }
      if (filtre.volontaire) {
        const nom = choix('volontaire', prep).find(o => o.v === filtre.volontaire)?.l || filtre.volontaire
        morceaux.push(`Volontaire : ${nom}`)
      }
      await exporterStatsExcel({
        filtre: morceaux.join(' · ') || 'Ensemble des souhaits',
        lignes: periode,
        km,
        blocs: {
          statuts, lieux, activites, pathologies, sexe, ages,
          institutions: institutions.map(i => ({ label: i.institution, n: i.n })),
          services: servicesPlat,
          volontaires: volontaires.map(v => ({ label: v.label, n: v.n })),
          annees: evoFiltre.map(r => ({ label: String(r.annee), n: r.n })),
        },
      })
    } catch (e) {
      alert(e?.message || 'Export impossible.')
    }
    setExporting(false)
  }

  const volontairesChoix = choix('volontaire')

  return (
    <div>
      <div className="ha-tabs" style={{ marginBottom: 12 }}>
        {GRAINS.map(g => (
          <button key={g.v} type="button" className={'ha-tab' + (grain === g.v ? ' is-on' : '')} onClick={() => setGrain(g.v)}>{g.l}</button>
        ))}
      </div>
      {grain !== 'ensemble' && (
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
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" className={'ha-tab' + (masques.length === 0 ? ' is-on' : '')} onClick={() => setMasques([])}>Tous les statuts</button>
        {tousStatuts.map(s => {
          const n = hors.statut.filter(l => l.statut === s).length
          const on = !masques.includes(s)
          return (
            <button key={s} type="button" className={'ha-tab' + (on ? ' is-on' : '')} onClick={() => setMasques(xs => on ? [...xs, s] : xs.filter(x => x !== s))}>
              {libelleStatut(s)} ({n})
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }}>
        <Filtre label="Sexe" value={filtre.genre} options={choix('genre')} onChange={v => setFiltre(s => ({ ...s, genre: v }))} />
        <Filtre label="Tranche d’âge" value={filtre.tranche} options={choix('tranche')} onChange={v => setFiltre(s => ({ ...s, tranche: v }))} />
        <Filtre label="Pathologie" value={filtre.pathologie} options={choix('pathologie')} onChange={v => setFiltre(s => ({ ...s, pathologie: v }))} />
        <Filtre label="Activité" value={filtre.activite} options={choix('activite')} onChange={v => setFiltre(s => ({ ...s, activite: v }))} />
        <Filtre label="Lieu" value={filtre.lieu} options={choix('lieu')} onChange={v => setFiltre(s => ({ ...s, lieu: v }))} />
        <Filtre label="Institution" value={filtre.institution} options={choix('institution')} onChange={v => setFiltre(s => ({ ...s, institution: v, service: '' }))} />
        <Filtre label="Service" value={filtre.service} options={choix('service')} onChange={v => setFiltre(s => ({ ...s, service: v }))} />
        <Filtre label="Volontaire" value={filtre.volontaire} options={volontairesChoix} onChange={v => setFiltre(s => ({ ...s, volontaire: v }))} />
        {filtresActifs && <Btn kind="soft" onClick={() => { setFiltre(FILTRE_VIDE); setMasques([]); setGrain('ensemble') }}>Tout réafficher</Btn>}
        <Btn kind="soft" onClick={exporter} disabled={exporting || periode.length === 0}>{exporting ? '…' : 'Exporter Excel'}</Btn>
      </div>
      <p style={{ fontWeight: 700 }}>{titrePeriode} · {periode.length} souhait{periode.length > 1 ? 's' : ''} · {km} km</p>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0 }}>Même échelle partout : la barre pleine, et la colonne la plus haute possible, valent {echelle}.</p>
      {!periode.length ? <Empty title="Aucun souhait pour ce filtre" hint="Réaffichez l’ensemble, ou élargissez un critère." /> : (
        <>
          <Colonnes titre="Évolution par année" rows={evoFiltre} echelle={echelle} />
          <div className="ha-graph-grille">
            <Barres titre="Statuts" rows={statuts} echelle={echelle} />
            <Barres titre="Lieux" rows={lieux} echelle={echelle} />
            <Barres titre="Types d’activités" rows={activites} echelle={echelle} />
            <Barres titre="Pathologies" rows={pathologies} echelle={echelle} />
            <Barres titre="Sexe" rows={sexe} echelle={echelle} />
            <Barres titre="Tranches d’âge" rows={ages} echelle={echelle} />
            <Barres titre="Volontaires" rows={volontaires} echelle={echelle} />
            <Barres titre="Institutions demandeuses" rows={institutions.map(i => ({ label: i.institution, n: i.n }))} echelle={echelle} />
            <Barres titre="Services" rows={servicesPlat.map(s => ({ label: `${s.institution} · ${s.label}`, n: s.n }))} echelle={echelle} />
          </div>
          <Card>
            <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Kilométrage</h2>
            <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{km} km</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Somme des écarts entre le kilométrage de départ et celui du retour, quand les deux sont encodés.</p>
          </Card>
        </>
      )}
    </div>
  )
}

function Filtre({ label, value, options, onChange }) {
  return (
    <label style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}
      <select value={value} onChange={e => onChange(e.target.value)} style={{ display: 'block', marginTop: 4, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'inherit' }}>
        <option value="">Tous</option>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
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
    <Page title="Statistiques" subtitle="Dans IT. Présidence et informatique. Tous les souhaits, sauf la formation. Les graphiques partagent la même échelle.">
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
