import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, F, TA, Flash } from '@/components/ui'
import { ChoixMultiple } from './ChoixPopup'
import {
  CHAMPS_CLINIQUES, INTERFACES_O2_DEFAUT, commeListe,
} from './listesCliniques'
import { analyserDocumentMedical } from './analyserDocumentMedical'

const CLIN = Object.fromEntries(CHAMPS_CLINIQUES.map(c => [c.k, c]))

function LigneParams({ titre, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 6,
      }}>{titre}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0 14px' }}>
        {children}
      </div>
    </div>
  )
}

function ChampClinique({ champ, m, set, lecture }) {
  return (
    <ChoixMultiple
      label={champ.l}
      options={champ.options}
      value={m[champ.k]}
      onChange={v => set(champ.k, v)}
      lecture={lecture}
    />
  )
}

function PathologiesNomsChamp({ val, set, lecture }) {
  const [opts, setOpts] = useState([])
  useEffect(() => {
    supabase.from('pathologies_referentiel').select('libelle').eq('actif', true).order('ordre')
      .then(({ data }) => setOpts((data || []).map(r => r.libelle)))
  }, [])
  return (
    <ChoixMultiple
      label="Pathologies (noms — ex. glioblastome, SLA…)"
      options={opts}
      value={val}
      onChange={set}
      lecture={lecture}
    />
  )
}

function AllergiesChamp({ val, set, lecture }) {
  const [opts, setOpts] = useState([])
  useEffect(() => {
    supabase.from('allergies_referentiel').select('libelle').eq('actif', true).order('ordre')
      .then(({ data }) => setOpts((data || []).map(r => r.libelle)))
  }, [])
  return <ChoixMultiple label="Allergies" options={opts} value={val} onChange={set} lecture={lecture} />
}

function InterfaceO2Champ({ val, set, lecture }) {
  const [opts, setOpts] = useState(INTERFACES_O2_DEFAUT)
  useEffect(() => {
    supabase.from('interfaces_o2_referentiel').select('libelle').eq('actif', true).order('ordre')
      .then(({ data }) => {
        const list = (data || []).map(r => r.libelle)
        if (list.length) setOpts(list)
      })
      .catch(() => {})
  }, [])
  // Compat : ancien champ texte apport_o2
  const value = val ?? ''
  return (
    <ChoixMultiple
      label="Interface O₂"
      options={opts}
      value={value}
      onChange={set}
      lecture={lecture}
      allowCustom
    />
  )
}

function Toggle({ label, val, set, lecture }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
      <button
        type="button"
        onClick={() => { if (!lecture) set(!val) }}
        disabled={lecture}
        style={{
          width: 44, height: 26, borderRadius: 99, border: 'none',
          cursor: lecture ? 'default' : 'pointer',
          background: val ? '#3B6D11' : 'var(--border)',
          position: 'relative', flexShrink: 0, opacity: lecture ? 0.85 : 1,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: val ? 20 : 2,
          width: 22, height: 22, borderRadius: 99, background: '#fff', transition: 'left .15s',
        }} />
      </button>
      <span style={{ fontSize: 14, color: 'var(--text)' }}>{label}</span>
    </div>
  )
}

/** Infos médicales : pathologies, notes, paramètres en 5 lignes. */
export default function InfosMedicales({ m, set, lecture, souhait, onNotesMedicales }) {
  const [busyDoc, setBusyDoc] = useState(false)
  const [msg, setMsg] = useState(null)
  const [notes, setNotes] = useState(souhait?.notes_medicales || '')
  useEffect(() => { setNotes(souhait?.notes_medicales || '') }, [souhait?.id, souhait?.notes_medicales])
  useEffect(() => {
    if (lecture || !onNotesMedicales) return
    if (notes === (souhait?.notes_medicales || '')) return
    const t = setTimeout(() => onNotesMedicales(notes), 500)
    return () => clearTimeout(t)
  }, [notes])

  async function importerFiche(file) {
    if (!file || lecture) return
    setBusyDoc(true)
    setMsg(null)
    try {
      const data = await analyserDocumentMedical(file, 'infos_medicales')
      if (Array.isArray(data.pathologies_noms) && data.pathologies_noms.length) {
        set('pathologies_noms', [...new Set([...commeListe(m.pathologies_noms), ...data.pathologies_noms.map(String)])])
      }
      for (const k of [
        'antecedents', 'douleurs', 'precisions_continences',
        'cible_saturation_o2', 'debit_o2', 'cible_ta', 'cible_fc',
      ]) {
        if (data[k]) set(k, String(data[k]))
      }
      for (const k of [
        'allergies', 'continence_urinaire', 'continence_fecale',
        'alimentation', 'deglutition', 'voie_acces', 'mobilisations', 'communication', 'interface_o2',
      ]) {
        if (Array.isArray(data[k]) && data[k].length) {
          set(k, [...new Set([...commeListe(m[k]), ...data[k].map(String)])])
        }
      }
      if (data.notes_medicales) setNotes(String(data.notes_medicales))
      // Ancien champ : si interface renvoyée, aussi remplir apport_o2 pour fiches legacy
      if (Array.isArray(data.interface_o2) && data.interface_o2.length) {
        set('apport_o2', data.interface_o2.join(', '))
      }
      setMsg({ ok: true, t: 'Document analysé — champs complétés. Vérifiez avant de valider.' })
    } catch (e) {
      setMsg({ ok: false, t: e.message || 'Analyse impossible.' })
    }
    setBusyDoc(false)
  }

  const interfaceVal = m.interface_o2 ?? (m.apport_o2 ? commeListe(m.apport_o2) : [])

  return (
    <Card>
      <div style={{
        fontSize: '1rem', fontWeight: 700, color: 'var(--heading)',
        marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)',
      }}>Infos médicales</div>

      <PathologiesNomsChamp
        val={m.pathologies_noms}
        set={v => set('pathologies_noms', v)}
        lecture={lecture}
      />

      <TA
        label="Notes médicales (confidentiel)"
        value={notes}
        set={setNotes}
        rows={3}
        readOnly={lecture || !onNotesMedicales}
      />

      <div style={{ margin: '10px 0 14px' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>
          Importer une fiche / courrier médical (analyse locale du PDF texte)
        </div>
        <input
          type="file"
          accept="application/pdf,image/*"
          disabled={lecture || busyDoc}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importerFiche(f) }}
        />
        {busyDoc && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>Analyse en cours…</div>}
        {msg && <div style={{ marginTop: 8 }}><Flash kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Flash></div>}
      </div>

      <Toggle label="Ne pas réanimer" val={!!m.ne_pas_reanimer} set={v => set('ne_pas_reanimer', v)} lecture={lecture} />
      <TA label="Détails acharnement" value={m.details_acharnement || ''} set={v => set('details_acharnement', v)} rows={2} readOnly={lecture} />
      <TA label="Antécédents" value={m.antecedents || ''} set={v => set('antecedents', v)} rows={2} readOnly={lecture} />
      <TA label="Douleurs" value={m.douleurs || ''} set={v => set('douleurs', v)} rows={2} readOnly={lecture} />

      <div style={{
        fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: 0.5, margin: '18px 0 10px',
      }}>Paramètres</div>

      <LigneParams titre="Respiration (O₂)">
        <F label="Cible saturation O₂" value={m.cible_saturation_o2 || ''} set={v => set('cible_saturation_o2', v)} readOnly={lecture} />
        <F label="Débit O₂ (L/min)" value={m.debit_o2 || ''} set={v => set('debit_o2', v)} readOnly={lecture} />
        <InterfaceO2Champ
          val={interfaceVal}
          set={v => { set('interface_o2', v); set('apport_o2', commeListe(v).join(', ')) }}
          lecture={lecture}
        />
      </LigneParams>

      <LigneParams titre="Circulation">
        <F label="Cible TA" value={m.cible_ta || ''} set={v => set('cible_ta', v)} readOnly={lecture} />
        <F label="Cible FC" value={m.cible_fc || ''} set={v => set('cible_fc', v)} readOnly={lecture} />
      </LigneParams>

      <LigneParams titre="Continence">
        <ChampClinique champ={CLIN.continence_fecale} m={m} set={set} lecture={lecture} />
        <ChampClinique champ={CLIN.continence_urinaire} m={m} set={set} lecture={lecture} />
        <div style={{ gridColumn: '1 / -1' }}>
          <TA
            label="Précisions continences / incontinence"
            value={m.precisions_continences || ''}
            set={v => set('precisions_continences', v)}
            rows={2}
            readOnly={lecture}
          />
        </div>
      </LigneParams>

      <LigneParams titre="Alimentation & allergies">
        <ChampClinique champ={CLIN.alimentation} m={m} set={set} lecture={lecture} />
        <ChampClinique champ={CLIN.deglutition} m={m} set={set} lecture={lecture} />
        <AllergiesChamp val={m.allergies} set={v => set('allergies', v)} lecture={lecture} />
      </LigneParams>

      <LigneParams titre="Mobilisation, communication & accès">
        <ChampClinique champ={CLIN.mobilisations} m={m} set={set} lecture={lecture} />
        <ChampClinique champ={CLIN.communication} m={m} set={set} lecture={lecture} />
        <ChampClinique champ={CLIN.voie_acces} m={m} set={set} lecture={lecture} />
      </LigneParams>

      {!lecture && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
          Les choix d’interface O₂ se configurent aussi dans IT → Configuration souhaits.
        </div>
      )}
    </Card>
  )
}
