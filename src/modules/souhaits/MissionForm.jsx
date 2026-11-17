import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, AddressFields, fmtAdresse, inp, lbl, Tabs, Loading, Flash, Sel, F, TA, LiensGps, LiensTrajet, Btn } from '@/components/ui'
import config from '@/app.config'
import { GROUPES, AUTORISATION_PHOTOS, normaliserAutorisationPhotos, lblAutorisationPhotos, equipePluri } from './missionSchema'
import Traitements from './Traitements'
import Vecteurs from './Vecteurs'
import Suivi from './Suivi'
import MaterielRequis from './MaterielRequis'
import DocumentsSejour from './DocumentsSejour'
import DocsAdresse, { fusionnerDocs } from './DocsAdresse'
import { ProtocoleDetresseForm } from './ProtocoleDetresse'
import EquipePluriForm, { LignesPluri } from './EquipePluri'
import { useAuth } from '@/hooks/useAuth'
import JournalDossier from './JournalDossier'
import InfosMedicales from './InfosMedicales'
import { journaliser, clesModifiees } from './journal'

const grp = id => GROUPES.find(g => g.id === id)

/** Champs mission tenus par la 1ʳᵉ partie (FormSouhait) — ne pas écraser depuis ce formulaire. */
const MISSION_PREMIERE_PARTIE = [
  'recolteurs', 'recolteur', 'date_demande', 'date_rencontre', 'consignes_equipage',
  'rencontre', 'consentement', 'autorisation_photos', 'categories',
]

const TABS = [
  { id:'trajet',        label:'Trajet', groupes:['base','prise_en_charge','destination','retour'], zone:'programme' },
  { id:'sejour',        label:'Séjour & documents', zone:'programme' },
  { id:'vecteurs',      label:'Vecteurs & équipages', zone:'programme' },
  { id:'materiel',      label:'Matériel & checklists', zone:'programme' },
  { id:'medical',       label:'Médical', groupes:['medical'], zone:'patient' },
  { id:'traitements',   label:'Traitements', zone:'patient' },
  { id:'timing',        label:'Timing', zone:'programme' },
  { id:'suivi',         label:'Suivi interne', zone:'commun' },
]

export default function MissionForm({ souhaitId, souhait: souhaitProp, onSouhait }) {
  const { peutProgrammerSouhait, peutEncoderPatientSouhait, profile } = useAuth()
  const programme = peutProgrammerSouhait()
  const patient = peutEncoderPatientSouhait()
  const tabs = TABS
  const [m, setM] = useState(null)
  const [souhait, setSouhait] = useState(souhaitProp || null)
  const [instDemandeuse, setInstDemandeuse] = useState(null)
  const [tab, setTab] = useState(() => {
    const saved = sessionStorage.getItem(`encodage-tab-${souhaitId}`)
    if (saved === 'administratif') return 'sejour'
    return saved || 'trajet'
  })
  const [status, setStatus] = useState('')
  const chargee = useRef(false)
  const timer = useRef()
  const precedent = useRef(null)

  useEffect(() => {
    if (tabs.length && !tabs.some(t => t.id === tab)) setTab(tabs[0].id)
  }, [tab])

  useEffect(() => { sessionStorage.setItem(`encodage-tab-${souhaitId}`, tab) }, [souhaitId, tab])

  useEffect(() => { (async () => {
    const { data } = await supabase.from('souhaits').select('*').eq('id', souhaitId).single()
    chargee.current = false
    const orig = data?.mission || {}
    let next = programme ? prefillBase(orig) : orig
    next = prefillDepuisBeneficiaire(next, data)
    setSouhait(data || null)
    setM(next)
    precedent.current = next
    setInstDemandeuse(await chargerInstitutionDemandeuse(data))
    if (JSON.stringify(next) !== JSON.stringify(orig)) {
      await supabase.from('souhaits').update({ mission: next }).eq('id', souhaitId)
    }
  })() }, [souhaitId])

  useEffect(() => {
    if (!souhaitProp) return
    setSouhait(souhaitProp)
    chargerInstitutionDemandeuse(souhaitProp).then(setInstDemandeuse)
    setM(o => o ? prefillDepuisBeneficiaire(o, souhaitProp) : o)
  }, [
    souhaitProp?.beneficiaire_adresse,
    souhaitProp?.beneficiaire_niss,
    souhaitProp?.beneficiaire_prenom,
    souhaitProp?.beneficiaire_nom,
    souhaitProp?.beneficiaire_tel_gsm,
    souhaitProp?.beneficiaire_tel_fixe,
    souhaitProp?.beneficiaire_genre,
    souhaitProp?.beneficiaire_ddn,
    souhaitProp?.origine,
    souhaitProp?.partenaire_id,
    souhaitProp?.annuaire_externe_id,
  ])

  // Resynchronise les champs tenus par FormSouhait pour ne pas les écraser à l’enregistrement.
  const missionPrepCle = JSON.stringify(
    Object.fromEntries(MISSION_PREMIERE_PARTIE.map(k => [k, souhaitProp?.mission?.[k]]))
  )
  useEffect(() => {
    const src = souhaitProp?.mission
    if (!src || !chargee.current) return
    setM(o => {
      if (!o) return o
      let changed = false
      const next = { ...o }
      for (const k of MISSION_PREMIERE_PARTIE) {
        if (JSON.stringify(next[k]) !== JSON.stringify(src[k])) {
          next[k] = src[k]
          changed = true
        }
      }
      return changed ? next : o
    })
  }, [missionPrepCle])

  useEffect(() => {
    if (m === null) return
    if (!chargee.current) { chargee.current = true; return }
    setStatus('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const avant = precedent.current
      // Préserver les champs 1ʳᵉ partie éventuellement plus frais en base.
      const { data: cur } = await supabase.from('souhaits').select('mission').eq('id', souhaitId).maybeSingle()
      const remote = (cur?.mission && typeof cur.mission === 'object') ? cur.mission : {}
      const mission = { ...m }
      for (const k of MISSION_PREMIERE_PARTIE) {
        if (remote[k] !== undefined) mission[k] = remote[k]
      }
      await supabase.from('souhaits').update({ mission }).eq('id', souhaitId)
      const cles = clesModifiees(avant, mission)
      if (cles.length) journaliser(souhaitId, 'modification', { cles }, profile)
      precedent.current = mission
      setStatus('saved'); setTimeout(() => setStatus(s => s === 'saved' ? '' : s), 1500)
    }, 600)
    return () => clearTimeout(timer.current)
  }, [m])

  useEffect(() => {
    if (!profile?.id) return
    const debut = new Date().toISOString()
    journaliser(souhaitId, 'entree', { a: debut }, profile)
    const sortie = () => journaliser(souhaitId, 'sortie', { de: debut, a: new Date().toISOString() }, profile)
    window.addEventListener('pagehide', sortie)
    return () => {
      window.removeEventListener('pagehide', sortie)
      sortie()
    }
  }, [souhaitId, profile?.id])

  const cur = tabs.find(t => t.id === tab) || tabs[0]
  const lecture = cur?.zone === 'programme' && !programme
  const lecturePatient = cur?.zone === 'patient' && !patient
  const lectureOnglet = lecture || lecturePatient
  const set = (k, v) => {
    if (lectureOnglet) return
    setM(o => ({ ...o, [k]: v }))
  }
  const setMSi = lectureOnglet ? (() => {}) : setM
  if (!m) return <Loading />
  if (!patient && !programme) return <Flash>Vous n’avez pas les droits pour encoder cette partie du dossier.</Flash>

  return (
    <div>
      {lecture && <Flash kind="warn">Lecture seule</Flash>}
      <Tabs
        value={cur.id}
        onChange={setTab}
        items={tabs.map(t => ({ v:t.id, l:t.label }))}
        extra={<span style={{ fontSize:12, color: status==='saved'?'#3B6D11':'var(--text-faint)' }}>{lectureOnglet ? 'Lecture seule' : status==='saving' ? 'Enregistrement…' : status==='saved' ? 'Enregistré' : 'Enregistrement automatique'}</span>}
      />

      {cur.id === 'sejour' && <DocumentsSejour souhaitId={souhaitId} m={m} setM={setMSi} lecture={lecture} />}
      {cur.id === 'vecteurs' && (
        <Vecteurs souhaitId={souhaitId} m={m} setM={setMSi} lecture={lecture} onJourRetenu={(periode, mission) => {
          const patch = { date_souhaitee: periode.debut, date_fin: periode.fin, dates_possibles: [periode], mission }
          setSouhait(s => ({ ...(s || {}), ...patch }))
          onSouhait?.(patch)
        }} />
      )}
      {cur.id === 'materiel' && <MaterielRequis m={m} setM={setMSi} lecture={lecture} />}
      {cur.id === 'traitements' && <Traitements souhaitId={souhaitId} readOnly={lecturePatient} />}
      {cur.id === 'timing' && <OngletTiming m={m} set={set} lecture={lecture} souhait={souhait} />}
      {cur.id === 'suivi' && <Suivi souhaitId={souhaitId} />}

      {cur?.groupes && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {cur.groupes.map(gid => {
            if (gid === 'prise_en_charge') return <PriseEnCharge key={gid} m={m} set={set} setM={setMSi} lecture={lectureOnglet} instDemandeuse={instDemandeuse} souhaitId={souhaitId} souhait={souhait} />
            if (gid === 'base') return <BlocBase key={gid} m={m} set={set} lecture={lectureOnglet} souhaitId={souhaitId} souhait={souhait} />
            if (gid === 'destination') return <BlocDestinations key={gid} m={m} set={set} setM={setMSi} lecture={lectureOnglet} souhaitId={souhaitId} souhait={souhait} />
            if (gid === 'retour') return <BlocRetour key={gid} m={m} set={set} lecture={lectureOnglet} souhait={souhait} />
            if (gid === 'medical') {
              return (
                <InfosMedicales
                  key={gid}
                  m={m}
                  set={set}
                  lecture={lectureOnglet}
                  souhait={souhait}
                  souhaitId={souhaitId}
                  onNotesMedicales={lectureOnglet ? null : (async (v) => {
                    setSouhait(s => ({ ...(s || {}), notes_medicales: v }))
                    onSouhait?.({ notes_medicales: v })
                    await supabase.from('souhaits').update({ notes_medicales: v || null }).eq('id', souhaitId)
                  })}
                />
              )
            }
            const g = grp(gid); if (!g) return null
            return (
              <Card key={gid}>
                <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>{g.label}</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
                  {g.fields.map(f => (
                    <Champ
                      key={f.k}
                      f={f}
                      val={m[f.k]}
                      set={v => set(f.k, v)}
                      lecture={lectureOnglet}
                      jourDefaut={jourSouhaitDefaut(souhait, m)}
                    />
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {cur.id === 'medical' && (programme
        ? <EquipePluriForm m={m} setM={setM} />
        : (
          <Card style={{ marginTop: 16 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading)', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              Équipe pluridisciplinaire
            </div>
            <LignesPluri rows={equipePluri(m)} />
          </Card>
        ))}
      {cur.id === 'medical' && <ProtocoleDetresseForm souhaitId={souhaitId} m={m} setM={lecturePatient ? (() => {}) : setM} />}
      <JournalDossier souhaitId={souhaitId} />
    </div>
  )
}

function adresseVide(a) {
  return !fmtAdresse(a)
}

function prefillDepuisBeneficiaire(mission, s) {
  if (!s || !mission) return mission
  const patch = {}
  if (adresseVide(mission.patient_adresse) && s.beneficiaire_adresse && fmtAdresse(s.beneficiaire_adresse)) {
    patch.patient_adresse = s.beneficiaire_adresse
  }
  if (!mission.registre_national && s.beneficiaire_niss) patch.registre_national = s.beneficiaire_niss
  if (!mission.date_demande && s.created_at) patch.date_demande = String(s.created_at).slice(0, 10)
  if (!mission.origine) {
    patch.origine = s.origine === 'institution' ? 'Institution' : (s.origine ? 'Demande privée' : '')
  }
  if (!Object.keys(patch).length) return mission
  return { ...mission, ...patch }
}

function prefillBase(m) {
  if (m.base_autre || m.base_nom || fmtAdresse(m.base_adresse)) return m
  const b = (config.bases || [])[0]
  if (!b) return m
  return { ...m, base_nom: b.nom, base_adresse: { ...b.adresse } }
}

async function chargerInstitutionDemandeuse(s) {
  if (!s) return null
  if (s.annuaire_externe_id) {
    const { data } = await supabase.from('annuaire').select('id,nom,telephone,data').eq('id', s.annuaire_externe_id).maybeSingle()
    if (data) {
      return {
        nom: data.nom,
        adresse: data.data?.adresse || null,
        tel: data.telephone || data.data?.telephone || '',
        id: data.id,
      }
    }
  }
  if (s.partenaire_id) {
    const { data: p } = await supabase.from('partenaires').select('id,nom,adresse,ville,tel_general,annuaire_id').eq('id', s.partenaire_id).maybeSingle()
    if (!p) return null
    let adresse = null
    if (p.annuaire_id) {
      const { data: a } = await supabase.from('annuaire').select('nom,data,telephone').eq('id', p.annuaire_id).maybeSingle()
      adresse = a?.data?.adresse || null
      return {
        nom: a?.nom || p.nom,
        adresse,
        tel: p.tel_general || a?.telephone || '',
        id: p.id,
      }
    }
    if (p.adresse) adresse = { rue: p.adresse, localite: p.ville || '', pays: 'Belgique' }
    else if (p.ville) adresse = { localite: p.ville, pays: 'Belgique' }
    return { nom: p.nom, adresse, tel: p.tel_general || '', id: p.id }
  }
  return null
}

function jourSouhaitDefaut(souhait, m) {
  return String(souhait?.date_souhaitee || m?.jour_retenu || '').slice(0, 10)
}

function sliceHeure(v) {
  const s = String(v || '')
  const m = s.match(/T(\d{2}:\d{2})/)
  if (m) return m[1]
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5)
  return ''
}

/** Jour (défaut = jour du souhait) + heure, stockés en datetime-local. */
function JourHeure({
  label = 'Horaire',
  labelJour = 'Jour',
  labelHeure = 'Heure',
  value,
  set,
  lecture = false,
  jourDefaut = '',
}) {
  const jourVal = String(value || '').slice(0, 10)
  const heureVal = sliceHeure(value)
  const jourAffiche = jourVal || String(jourDefaut || '').slice(0, 10)
  function maj(jour, heure) {
    if (lecture) return
    const j = String(jour || '').slice(0, 10)
    const h = String(heure || '').slice(0, 5)
    if (!j && !h) { set(''); return }
    const jj = j || String(jourDefaut || '').slice(0, 10)
    if (!jj) { set(h || ''); return }
    if (!h) { set(`${jj}T00:00`); return }
    set(`${jj}T${h}`)
  }
  return (
    <div style={{ margin: '8px 0' }}>
      {label && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
        <F label={labelJour} type="date" value={jourAffiche} set={v => maj(v, heureVal)} readOnly={lecture} />
        <F label={labelHeure} type="time" value={heureVal} set={v => maj(jourAffiche, v)} readOnly={lecture} />
      </div>
    </div>
  )
}

function BlocBase({ m, set, lecture, souhaitId, souhait }) {
  const [bases, setBases] = useState([])
  const jourDefaut = jourSouhaitDefaut(souhait, m)
  useEffect(() => {
    supabase.from('bases_depart').select('*').eq('actif', true).order('ordre').then(({ data }) => {
      const rows = (data || []).map(b => ({
        nom: b.nom,
        protocole: b.protocole || '',
        adresse: { rue: b.rue || '', numero: b.numero || '', cp: b.cp || '', localite: b.localite || '', pays: b.pays || 'Belgique' },
      }))
      setBases(rows.length ? rows : (config.bases || []).map(b => ({ nom: b.nom, adresse: b.adresse || {}, protocole: '' })))
    })
  }, [])
  const nomMatch = bases.find(b => b.nom === m.base_nom)
  const valeurSel = m.base_autre ? '__autre__' : (nomMatch ? nomMatch.nom : (m.base_nom ? '__autre__' : ''))
  function choisir(v) {
    if (lecture) return
    if (v === '__autre__') {
      set('base_autre', true)
      if (nomMatch) {
        set('base_nom', '')
        set('base_adresse', { rue: '', numero: '', cp: '', localite: '', pays: 'Belgique' })
        set('base_protocole', '')
      }
      return
    }
    const b = bases.find(x => x.nom === v)
    if (!b) return
    set('base_autre', false)
    set('base_nom', b.nom)
    set('base_adresse', { ...b.adresse })
    set('base_protocole', b.protocole || '')
  }
  return (
    <Card>
      <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>Base</div>
      <Sel
        label="Base"
        value={valeurSel}
        set={choisir}
        disabled={lecture}
        options={[
          { v: '', l: '—' },
          ...bases.map(b => ({ v: b.nom, l: b.nom })),
          { v: '__autre__', l: 'Autre' },
        ]}
      />
      {(valeurSel === '__autre__' || (m.base_autre && !nomMatch)) && (
        <F label="Nom de la base" value={m.base_nom || ''} set={v => set('base_nom', v)} readOnly={lecture} />
      )}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse</div>
        <AddressFields value={m.base_adresse} set={v => { if (!lecture) set('base_adresse', v) }} wazeMode="planifier" />
        <DocsAdresse
          souhaitId={souhaitId}
          slotId="base"
          docs={m.base_docs}
          onChange={v => { if (!lecture) set('base_docs', v) }}
          lecture={lecture}
        />
      </div>
      {(nomMatch?.protocole || m.base_protocole) && !m.base_autre && (
        <TA label="Protocole de mission" value={nomMatch?.protocole || m.base_protocole || ''} set={() => {}} rows={4} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '0 24px' }}>
        <JourHeure label="Rendez-vous" value={m.rdv_base} set={v => set('rdv_base', v)} lecture={lecture} jourDefaut={jourDefaut} />
        <JourHeure label="Départ" value={m.depart_base} set={v => set('depart_base', v)} lecture={lecture} jourDefaut={jourDefaut} />
      </div>
      <LiensTrajet
        etapes={[
          { label: 'Base', adresse: m.base_adresse },
          { label: 'Prise en charge', adresse: adressePec(m) },
        ]}
        wazeMode="planifier"
      />
    </Card>
  )
}

function OngletTiming({ m, set, lecture, souhait }) {
  const jour = jourSouhaitDefaut(souhait, m)
  const lib = jour
    ? new Date(jour + 'T12:00:00').toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '—'
  return (
    <Card>
      <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12 }}>Timing</div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Jour du souhait</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{lib}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '0 16px' }}>
        <JourHeure label="Rendez-vous base" value={m.rdv_base} set={v => set('rdv_base', v)} lecture={lecture} jourDefaut={jour} />
        <JourHeure label="Départ base" value={m.depart_base} set={v => set('depart_base', v)} lecture={lecture} jourDefaut={jour} />
        <JourHeure label="Prise en charge" value={m.arrivee_pec} set={v => set('arrivee_pec', v)} lecture={lecture} jourDefaut={jour} />
        <JourHeure label="Sur place" value={m.arrivee_destination} set={v => set('arrivee_destination', v)} lecture={lecture} jourDefaut={jour} />
        <JourHeure label="Retour" value={m.retour_heure} set={v => set('retour_heure', v)} lecture={lecture} jourDefaut={jour} />
      </div>
    </Card>
  )
}

function derniereEtapeAller(m) {
  const acts = Array.isArray(m.activites_sur_place) ? m.activites_sur_place : []
  if (acts.length) {
    const a = acts[acts.length - 1]
    return { label: a.nom || 'Dernière activité', adresse: a.adresse }
  }
  if (fmtAdresse(m.dest_adresse)) return { label: m.dest_nom || 'Destination', adresse: m.dest_adresse }
  return { label: 'Prise en charge', adresse: adressePec(m) }
}

function BlocRetour({ m, set, lecture, souhait }) {
  const jourDefaut = jourSouhaitDefaut(souhait, m)
  const derniere = derniereEtapeAller(m)
  const pec = { label: 'Prise en charge', adresse: adressePec(m) }
  const base = { label: 'Base', adresse: m.base_adresse }
  return (
    <Card>
      <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>Retour</div>
      <Champ f={grp('retour').fields.find(f => f.k === 'retour_type')} val={m.retour_type} set={v => set('retour_type', v)} lecture={lecture} />
      <JourHeure label="Heure attendue" value={m.retour_heure} set={v => set('retour_heure', v)} lecture={lecture} jourDefaut={jourDefaut} />
      <Champ f={grp('retour').fields.find(f => f.k === 'retour_precisions')} val={m.retour_precisions} set={v => set('retour_precisions', v)} lecture={lecture} />
      <LiensTrajet
        etapes={[derniere, pec, base]}
        wazeMode="planifier"
      />
    </Card>
  )
}

function adressePec(m) {
  return m.pec_type === 'Domicile du patient' ? m.patient_adresse : m.pec_adresse
}

function adresseDepuisLieu(src) {
  if (!src) return { pays: 'Belgique' }
  if (src.adresse && typeof src.adresse === 'object') {
    return {
      rue: src.adresse.rue || '',
      numero: src.adresse.numero || '',
      cp: src.adresse.cp || '',
      localite: src.adresse.localite || '',
      pays: src.adresse.pays || 'Belgique',
    }
  }
  return {
    rue: src.rue || '',
    numero: src.numero || '',
    cp: src.cp || '',
    localite: src.localite || '',
    pays: src.pays || 'Belgique',
  }
}

function docsDepuisLieu(src) {
  if (Array.isArray(src?.documents)) return src.documents
  if (Array.isArray(src?.data?.documents)) return src.data.documents
  return []
}

function BlocDestinations({ m, set, setM, lecture, souhaitId, souhait }) {
  const activites = Array.isArray(m.activites_sur_place) ? m.activites_sur_place : []
  const [connues, setConnues] = useState([])
  const jourDefaut = jourSouhaitDefaut(souhait, m)
  const destMode = m.dest_privee === false || m.dest_annuaire_id || m.dest_frequente_id ? 'connue' : 'privee'
  useEffect(() => {
    supabase.from('destinations_frequentes').select('*').eq('actif', true).order('nom').then(({ data }) => setConnues(data || []))
  }, [])
  function majAct(id, patch) {
    setM(o => ({
      ...o,
      activites_sur_place: (o.activites_sur_place || []).map(a => a.id === id ? { ...a, ...patch } : a),
    }))
  }
  function setDestMode(mode) {
    if (lecture) return
    if (mode === 'privee') {
      setM(o => ({ ...o, dest_privee: true, dest_annuaire_id: null, dest_frequente_id: null, dest_nom: o.dest_nom || '' }))
      return
    }
    setM(o => ({ ...o, dest_privee: false }))
  }
  function appliquerDestinationConnue(src) {
    if (lecture || !src) return
    const adresse = adresseDepuisLieu(src)
    const docs = fusionnerDocs(m.dest_docs, docsDepuisLieu(src))
    setM(o => ({
      ...o,
      dest_privee: false,
      dest_nom: src.nom || o.dest_nom || '',
      dest_adresse: adresse,
      dest_docs: docs,
      dest_annuaire_id: src.via === 'Annuaire' || src.categorie ? (src.id || null) : (src.annuaire_id || null),
      dest_frequente_id: src.via === 'Fréquente' || (!src.categorie && !src.via) ? (src.id || null) : null,
    }))
  }
  function ajouter(src) {
    const id = crypto.randomUUID ? crypto.randomUUID() : 'a' + Date.now()
    const row = {
      id,
      nom: src?.nom || '',
      heure: '',
      notes: src?.notes || '',
      telephone: src?.telephone || src?.tel || '',
      adresse: adresseDepuisLieu(src),
      documents: docsDepuisLieu(src),
      annuaire_id: src?.categorie || src?.via === 'Annuaire' ? src.id : (src?.annuaire_id || null),
      frequente_id: src?.via === 'Fréquente' || (!src?.categorie && src?.id && !src?.via) ? src.id : null,
    }
    setM(o => ({ ...o, activites_sur_place: [...(o.activites_sur_place || []), row] }))
  }
  async function memoriser(a, { dansAnnuaire = false } = {}) {
    const nom = String(a?.nom || '').trim()
    if (!nom) { alert('Indiquez un nom pour ce lieu.'); return }
    const adresse = a.adresse || {}
    const telephone = a.telephone || ''
    const notes = a.notes || ''
    const documents = Array.isArray(a.documents) ? a.documents : []
    if (dansAnnuaire) {
      const { data, error } = await supabase.from('annuaire').insert({
        categorie: 'institution',
        nom,
        telephone: telephone || null,
        data: { adresse, documents, notes },
      }).select('id').single()
      if (error) { alert(error.message); return }
      if (a.id) majAct(a.id, { annuaire_id: data.id, documents })
      else setM(o => ({ ...o, dest_annuaire_id: data.id, dest_privee: false, dest_nom: nom, dest_docs: documents }))
      alert('Lieu enregistré dans l’annuaire.')
      return
    }
    const deja = (connues || []).some(d =>
      String(d.nom || '').trim().toLowerCase() === nom.toLowerCase()
      && String(d.cp || '') === String(adresse?.cp || '')
      && String(d.localite || '').toLowerCase() === String(adresse?.localite || '').toLowerCase()
    )
    if (deja) { alert('Cette destination est déjà enregistrée.'); return }
    const { data, error } = await supabase.from('destinations_frequentes').insert({
      nom,
      rue: adresse?.rue || '',
      numero: adresse?.numero || '',
      cp: adresse?.cp || '',
      localite: adresse?.localite || '',
      pays: adresse?.pays || 'Belgique',
      telephone,
      notes,
      documents,
      annuaire_id: a.annuaire_id || null,
    }).select('*').single()
    if (error) { alert(error.message); return }
    if (data) setConnues(list => [...list, data])
    alert('Lieu connu enregistré.')
  }
  function ajouterSansDoublon(src) {
    if (src?.nom) {
      const existe = activites.some(x =>
        String(x.nom || '').trim().toLowerCase() === String(src.nom).trim().toLowerCase()
        && String(x.adresse?.cp || '') === String(src.cp || src.adresse?.cp || '')
      )
      if (existe) { alert('Cette activité est déjà dans le trajet.'); return }
    }
    ajouter(src)
  }
  const pec = adressePec(m)
  return (
    <Card>
      <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>Destination</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { v: 'privee', l: 'Privée' },
          { v: 'connue', l: 'Lieu connu (annuaire)' },
        ].map(o => (
          <button
            key={o.v}
            type="button"
            className={'ha-tab-like' + (destMode === o.v ? ' is-on' : '')}
            disabled={lecture}
            onClick={() => setDestMode(o.v)}
          >{o.l}</button>
        ))}
      </div>
      {destMode === 'connue' && !lecture && (
        <RechercheLieu
          label="Rechercher un lieu (annuaire + destinations connues)"
          onPick={appliquerDestinationConnue}
          connues={connues}
        />
      )}
      {destMode === 'connue' && (
        <F label="Nom du lieu" value={m.dest_nom || ''} set={v => set('dest_nom', v)} readOnly={lecture} />
      )}
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse</div>
      <AddressFields value={m.dest_adresse} set={v => { if (!lecture) set('dest_adresse', v) }} wazeMode="planifier" />
      <DocsAdresse
        souhaitId={souhaitId}
        slotId="destination"
        docs={m.dest_docs}
        onChange={v => { if (!lecture) set('dest_docs', v) }}
        lecture={lecture}
      />
      <TA label="Précisions" value={m.dest_precisions || ''} set={v => set('dest_precisions', v)} rows={2} />
      <JourHeure label="Sur place" value={m.arrivee_destination} set={v => set('arrivee_destination', v)} lecture={lecture} jourDefaut={jourDefaut} />
      {!lecture && destMode === 'connue' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <Btn kind="soft" onClick={() => memoriser({ nom: m.dest_nom, adresse: m.dest_adresse, documents: m.dest_docs, annuaire_id: m.dest_annuaire_id })}>
            Enregistrer comme lieu fréquent
          </Btn>
          <Btn kind="soft" onClick={() => memoriser({ nom: m.dest_nom, adresse: m.dest_adresse, documents: m.dest_docs }, { dansAnnuaire: true })}>
            Enregistrer dans l’annuaire
          </Btn>
        </div>
      )}
      <LiensTrajet
        etapes={[
          { label: 'Prise en charge', adresse: pec },
          { label: 'Destination', adresse: m.dest_adresse },
        ]}
        wazeMode="planifier"
      />
      <div style={{ fontWeight: 700, margin: '8px 0' }}>Sur place</div>
      {activites.map((a, i) => {
        const prev = i === 0
          ? { label: 'Destination', adresse: m.dest_adresse }
          : { label: activites[i - 1].nom || `Activité ${i}`, adresse: activites[i - 1].adresse }
        return (
          <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <F label="Activité" value={a.nom || ''} set={v => majAct(a.id, { nom: v })} readOnly={lecture} />
            <F label="Heure attendue" type="time" value={(a.heure || '').slice(0, 5)} set={v => majAct(a.id, { heure: v })} readOnly={lecture} />
            <F label="Téléphone" value={a.telephone || ''} set={v => majAct(a.id, { telephone: v })} readOnly={lecture} />
            <TA label="Notes" value={a.notes || ''} set={v => majAct(a.id, { notes: v })} rows={2} />
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse</div>
            <AddressFields value={a.adresse} set={v => { if (!lecture) majAct(a.id, { adresse: v }) }} wazeMode="planifier" />
            <DocsAdresse
              souhaitId={souhaitId}
              slotId={a.id}
              docs={a.documents}
              onChange={v => { if (!lecture) majAct(a.id, { documents: v }) }}
              lecture={lecture}
            />
            <LiensTrajet
              etapes={[prev, { label: a.nom || `Activité ${i + 1}`, adresse: a.adresse }]}
              wazeMode="planifier"
            />
            {!lecture && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn kind="soft" onClick={() => memoriser(a)}>Enregistrer comme lieu fréquent</Btn>
                <Btn kind="soft" onClick={() => memoriser(a, { dansAnnuaire: true })}>Enregistrer dans l’annuaire</Btn>
                <Btn kind="danger" onClick={() => setM(o => ({ ...o, activites_sur_place: (o.activites_sur_place || []).filter(x => x.id !== a.id) }))}>Retirer</Btn>
              </div>
            )}
          </div>
        )
      })}
      {!lecture && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Btn kind="soft" onClick={() => ajouterSansDoublon(null)}>+ Activité</Btn>
          {connues.length > 0 && (
            <Sel
              label="Lieu connu"
              value=""
              set={id => { const d = connues.find(x => x.id === id); if (d) ajouterSansDoublon({ ...d, via: 'Fréquente' }) }}
              options={[{ v: '', l: '—' }, ...connues.map(d => ({ v: d.id, l: d.nom }))]}
            />
          )}
        </div>
      )}
    </Card>
  )
}

function PriseEnCharge({ m, set, setM, lecture, instDemandeuse, souhaitId, souhait }) {
  const dom = m.pec_type === 'Domicile du patient'
  const inst = m.pec_type === 'Institution'
  const champ = k => grp('prise_en_charge').fields.find(f => f.k === k)
  const source = m.pec_inst_source || (inst && !instDemandeuse ? 'autre' : '')
  const aDemandeuse = instDemandeuse && source === 'demandeuse'

  function choisirType(v) {
    set('pec_type', v)
    if (v !== 'Institution') set('pec_inst_source', '')
  }
  function choisirDemandeuse() {
    if (lecture || !instDemandeuse) return
    set('pec_inst_source', 'demandeuse')
    set('pec_institution', instDemandeuse.nom || '')
    if (fmtAdresse(instDemandeuse.adresse)) set('pec_adresse', instDemandeuse.adresse)
  }
  function choisirAutre() {
    if (lecture) return
    set('pec_inst_source', 'autre')
    if (source === 'demandeuse') {
      set('pec_institution', '')
      set('pec_adresse', null)
    }
  }
  async function appliquerRecherche(hit) {
    if (lecture) return
    set('pec_inst_source', 'autre')
    set('pec_institution', hit.nom || '')
    if (hit.adresse) set('pec_adresse', hit.adresse)
    let docsInst = docsDepuisLieu(hit)
    if (!docsInst.length && hit.via === 'Référentiel' && hit.id) {
      const { data } = await supabase.from('referentiel_institutions').select('documents').eq('id', hit.id).maybeSingle()
      docsInst = Array.isArray(data?.documents) ? data.documents : []
    }
    if (!docsInst.length && hit.via === 'Annuaire' && hit.id) {
      const { data } = await supabase.from('annuaire').select('data').eq('id', hit.id).maybeSingle()
      docsInst = Array.isArray(data?.data?.documents) ? data.data.documents : []
    }
    if (docsInst.length) {
      setM?.(o => ({ ...o, pec_docs: fusionnerDocs(o.pec_docs, docsInst) }))
    }
  }

  return (
    <Card>
      <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>Prise en charge</div>
      <div style={{ maxWidth:320 }}><Champ f={champ('pec_type')} val={m.pec_type} set={choisirType} lecture={lecture} /></div>
      {dom && (
        <div style={{ background:'var(--bg-alt)', borderRadius:10, padding:'10px 12px', margin:'6px 0' }}>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>Adresse (domicile du patient — reprise de la fiche bénéficiaire)</div>
          <div style={{ fontSize:14, color:'var(--text)' }}>{fmtAdresse(m.patient_adresse) || '— À renseigner sur la fiche bénéficiaire —'}</div>
          {fmtAdresse(m.patient_adresse) && <div style={{ marginTop: 6 }}><LiensGps adresse={m.patient_adresse} wazeMode="planifier" /></div>}
          <DocsAdresse
            souhaitId={souhaitId}
            slotId="pec-domicile"
            docs={m.pec_docs}
            onChange={v => { if (!lecture) set('pec_docs', v) }}
            lecture={lecture}
          />
        </div>
      )}
      {inst && (
        <div style={{ margin:'8px 0 12px' }}>
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:8 }}>Quelle institution ?</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            {instDemandeuse && (
              <button
                type="button"
                className={'ha-tab-like' + (source === 'demandeuse' ? ' is-on' : '')}
                disabled={lecture}
                onClick={choisirDemandeuse}
              >Institution demandeuse{instDemandeuse.nom ? ` · ${instDemandeuse.nom}` : ''}</button>
            )}
            <button
              type="button"
              className={'ha-tab-like' + (source === 'autre' ? ' is-on' : '')}
              disabled={lecture}
              onClick={choisirAutre}
            >Autre institution</button>
          </div>
          {aDemandeuse && (
            <div style={{ background:'var(--bg-alt)', borderRadius:10, padding:'10px 12px', marginBottom:10 }}>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Adresse de l’institution demandeuse</div>
              <div style={{ fontWeight:600, fontSize:14, color:'var(--text)', margin:'2px 0 4px' }}>{instDemandeuse.nom}</div>
              <div style={{ fontSize:14, color:'var(--text)' }}>{fmtAdresse(instDemandeuse.adresse) || fmtAdresse(m.pec_adresse) || '—'}</div>
              {instDemandeuse.tel && <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>{instDemandeuse.tel}</div>}
              {fmtAdresse(instDemandeuse.adresse || m.pec_adresse) && (
                <div style={{ marginTop:6 }}><LiensGps adresse={instDemandeuse.adresse || m.pec_adresse} wazeMode="planifier" /></div>
              )}
            </div>
          )}
          {source === 'autre' && (
            <RechercheInstitution lecture={lecture} onPick={appliquerRecherche} />
          )}
          {source === 'autre' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
              <Champ f={champ('pec_institution')} val={m.pec_institution} set={v=>set('pec_institution', v)} lecture={lecture} />
              <Champ f={{ ...champ('pec_adresse'), l: 'Adresse' }} val={m.pec_adresse} set={v=>set('pec_adresse', v)} lecture={lecture} souhaitId={souhaitId} slotId="pec-adresse" docs={m.pec_adresse_docs} onDocs={v => set('pec_adresse_docs', v)} />
            </div>
          )}
          {(source === 'demandeuse' || source === 'autre') && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Plans du site & documents d’accès</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                Plans, accès parking, consignes — visibles par l’équipe terrain.
              </div>
              <DocsAdresse
                souhaitId={souhaitId}
                slotId="pec"
                docs={m.pec_docs}
                onChange={v => { if (!lecture) set('pec_docs', v) }}
                lecture={lecture}
              />
            </div>
          )}
          {(source === 'demandeuse' || source === 'autre') && (
            <ServicesInstitution m={m} set={set} lecture={lecture} />
          )}
          {(source === 'demandeuse' || source === 'autre') && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
              <Champ f={champ('pec_service')} val={m.pec_service} set={v=>set('pec_service', v)} lecture={lecture} />
              <Champ f={champ('pec_etage')} val={m.pec_etage} set={v=>set('pec_etage', v)} lecture={lecture} />
              <Champ f={champ('pec_aile')} val={m.pec_aile} set={v=>set('pec_aile', v)} lecture={lecture} />
              <Champ f={champ('pec_chambre')} val={m.pec_chambre} set={v=>set('pec_chambre', v)} lecture={lecture} />
            </div>
          )}
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
        <JourHeure label="Prise en charge souhaitée" value={m.arrivee_pec} set={v => set('arrivee_pec', v)} lecture={lecture} jourDefaut={jourSouhaitDefaut(souhait, m)} />
        <JourHeure label="Départ souhaité" value={m.depart_pec} set={v => set('depart_pec', v)} lecture={lecture} jourDefaut={jourSouhaitDefaut(souhait, m)} />
      </div>
      <Champ f={champ('pec_precisions')} val={m.pec_precisions} set={v=>set('pec_precisions', v)} lecture={lecture} />
      <LiensTrajet
        etapes={[
          { label: 'Prise en charge', adresse: adressePec(m) },
          { label: m.dest_nom || 'Destination', adresse: m.dest_adresse },
        ]}
        wazeMode="planifier"
      />
    </Card>
  )
}

function ServicesInstitution({ m, set, lecture }) {
  const [svcs, setSvcs] = useState([])
  useEffect(() => {
    const nom = (m.pec_institution || '').trim()
    if (nom.length < 2) { setSvcs([]); return }
    let stop = false
    supabase.from('referentiel_institutions').select('id,nom').ilike('nom', nom).limit(1).then(async ({ data }) => {
      const inst = data?.[0]
      if (!inst || stop) { if (!stop) setSvcs([]); return }
      const { data: rows } = await supabase.from('referentiel_services').select('nom,telephone').eq('institution_id', inst.id).eq('actif', true).order('ordre')
      if (!stop) setSvcs(rows || [])
    })
    return () => { stop = true }
  }, [m.pec_institution])
  if (!svcs.length) return null
  return (
    <Sel
      label="Service de l’institution"
      value={svcs.some(s => s.nom === m.pec_service) ? m.pec_service : ''}
      set={v => { if (v) set('pec_service', v) }}
      disabled={lecture}
      options={[{ v: '', l: '—' }, ...svcs.map(s => ({ v: s.nom, l: s.telephone ? `${s.nom} · ${s.telephone}` : s.nom }))]}
    />
  )
}

function RechercheInstitution({ lecture, onPick }) {
  return (
    <RechercheLieu
      lecture={lecture}
      onPick={onPick}
      label="Rechercher l’institution (annuaire + internet)"
      categories={['institution', 'externe_souhait']}
      avecReferentiel
      avecPhoton
    />
  )
}

function RechercheLieu({
  lecture = false,
  onPick,
  label = 'Rechercher un lieu',
  categories = ['institution', 'externe_souhait'],
  connues = [],
  avecReferentiel = false,
  avecPhoton = false,
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function chercher(e) {
    e?.preventDefault?.()
    const needle = q.trim()
    if (needle.length < 2) { setErr('Indiquez au moins 2 lettres.'); return }
    setBusy(true); setErr(null); setHits([])
    const locaux = []
    let web = []
    let msg = null
    const needleLow = needle.toLowerCase()
    for (const r of connues || []) {
      if (!String(r.nom || '').toLowerCase().includes(needleLow)) continue
      locaux.push({
        ...r,
        adresse: adresseDepuisLieu(r),
        documents: Array.isArray(r.documents) ? r.documents : [],
        via: 'Fréquente',
      })
    }
    try {
      const { data } = await supabase.from('annuaire')
        .select('id,nom,telephone,data,categorie')
        .in('categorie', categories)
        .ilike('nom', `%${needle}%`)
        .limit(8)
      for (const r of data || []) {
        locaux.push({
          id: r.id,
          nom: r.nom,
          categorie: r.categorie,
          adresse: r.data?.adresse || null,
          documents: Array.isArray(r.data?.documents) ? r.data.documents : [],
          tel: r.telephone || r.data?.telephone || '',
          via: 'Annuaire',
        })
      }
      if (avecReferentiel) {
        const { data: refs } = await supabase.from('referentiel_institutions')
          .select('id,nom,telephone,rue,numero,cp,localite,pays,documents')
          .ilike('nom', `%${needle}%`)
          .eq('actif', true)
          .limit(8)
        for (const r of refs || []) {
          locaux.push({
            id: r.id,
            nom: r.nom,
            adresse: { rue: r.rue || '', numero: r.numero || '', cp: r.cp || '', localite: r.localite || '', pays: r.pays || 'Belgique' },
            documents: Array.isArray(r.documents) ? r.documents : [],
            tel: r.telephone || '',
            via: 'Référentiel',
          })
        }
      }
    } catch { /* annuaire optionnel */ }
    if (avecPhoton) {
      try {
        web = await chercherPhoton(needle)
      } catch {
        msg = 'La recherche internet n’a pas abouti. Essayez Google Maps ci-dessous, ou encodez l’adresse à la main.'
      }
    }
    const vus = new Set(locaux.map(x => `${(x.nom || '').toLowerCase()}|${x.via}`))
    const fusion = [
      ...locaux,
      ...web.filter(x => !vus.has(`${(x.nom || '').toLowerCase()}|${x.via || 'Internet'}`)),
    ]
    setHits(fusion)
    setBusy(false)
    if (!fusion.length) setErr(msg || 'Aucun résultat. Affinez le nom, ou encodez l’adresse à la main.')
    else setErr(msg)
  }

  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.trim() || 'Belgique')}`

  return (
    <div style={{ marginBottom: 12 }}>
      <form onSubmit={chercher} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <F label={label} value={q} set={setQ} />
        </div>
        <Btn onClick={chercher} disabled={lecture || busy} style={{ marginBottom: 10 }}>{busy ? 'Recherche…' : 'Rechercher'}</Btn>
        {avecPhoton && (
          <a href={maps} target="_blank" rel="noopener noreferrer" className="ha-gps-btn" style={{ marginBottom: 12, alignSelf: 'center' }}>Google Maps</a>
        )}
      </form>
      {err && <div style={{ fontSize: 13, color: '#8A6D1B', marginBottom: 8 }}>{err}</div>}
      {hits.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {hits.map((h, i) => (
            <button
              key={h.id || `${h.nom}-${h.via}-${i}`}
              type="button"
              disabled={lecture}
              onClick={() => onPick(h)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--card)', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                {h.nom || 'Sans nom'}
                {h.via ? <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 12 }}> · {h.via}</span> : null}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {fmtAdresse(h.adresse) || 'Adresse non renseignée'}
                {docsDepuisLieu(h).length ? ` · ${docsDepuisLieu(h).length} document(s)` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

async function chercherPhoton(q) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=fr&limit=8&lat=50.5&lon=4.47`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error('photon')
  const j = await r.json()
  return (j.features || []).map(f => {
    const p = f.properties || {}
    return {
      nom: p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || 'Résultat carte',
      adresse: {
        rue: p.street || '',
        numero: p.housenumber || '',
        cp: p.postcode || '',
        localite: p.city || p.town || p.village || p.district || p.locality || '',
        pays: p.country || 'Belgique',
      },
      via: 'Internet',
    }
  }).filter(x => fmtAdresse(x.adresse) || x.nom)
}

function Champ({ f, val, set, lecture, souhaitId, slotId, docs, onDocs, jourDefaut = '' }) {
  if (!f) return null
  const lock = !!lecture
  if (f.t === 'address') {
    return (
      <div style={{ gridColumn:'1 / -1', margin:'8px 0' }}>
        <label style={lbl}>{f.l}</label>
        <AddressFields value={val} set={lock ? (()=>{}) : set} wazeMode="planifier" />
        {(souhaitId && slotId) && (
          <DocsAdresse
            souhaitId={souhaitId}
            slotId={slotId}
            docs={docs}
            onChange={v => { if (!lock) onDocs?.(v) }}
            lecture={lock}
          />
        )}
      </div>
    )
  }
  if (f.t === 'sep') return <div style={{ gridColumn:'1 / -1', fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, margin:'14px 0 6px' }}>{f.l.replace(/—/g,'').trim()}</div>
  if (f.t === 'toggle') return (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'12px 0' }}>
      <button type="button" onClick={()=>{ if (!lock) set(!val) }} disabled={lock} style={{ width:44, height:26, borderRadius:99, border:'none', cursor: lock ? 'default' : 'pointer', background: val?'#3B6D11':'var(--border)', position:'relative', flexShrink:0, opacity: lock ? .85 : 1 }}>
        <span style={{ position:'absolute', top:2, left: val?20:2, width:22, height:22, borderRadius:99, background:'#fff', transition:'left .15s' }} />
      </button>
      <span style={{ fontSize:14, color:'var(--text)' }}>{f.l}</span>
    </div>
  )
  if (f.t === 'photos') {
    const cur = normaliserAutorisationPhotos(val)
    const idx = Math.max(0, AUTORISATION_PHOTOS.findIndex(o => o.v === (cur || 'oui')))
    return (
      <div className="ha-photos-slider">
        <div className="ha-photos-slider-label">{f.l}</div>
        <input
          type="range" min="0" max="2" step="1"
          value={cur ? idx : 1}
          aria-valuetext={lblAutorisationPhotos(cur || 'oui')}
          disabled={lock}
          onChange={e => { if (!lock) set(AUTORISATION_PHOTOS[Number(e.target.value)].v) }}
        />
        <div className="ha-photos-slider-stops">
          {AUTORISATION_PHOTOS.map(o => (
            <button type="button" key={o.v}
              className={'ha-photos-stop' + (cur === o.v ? ' is-on' : '') + (o.v === 'refus' ? ' is-refus' : '')}
              onClick={() => { if (!lock) set(o.v) }}>
              {o.l}
            </button>
          ))}
        </div>
      </div>
    )
  }
  const wrap = c => <div style={{ margin:'8px 0' }}><label style={lbl}>{f.l}</label>{c}</div>
  if (f.t === 'textarea') return <div style={{ gridColumn:'1 / -1' }}>{wrap(<textarea value={val||''} onChange={e=>{ if (!lock) set(e.target.value) }} readOnly={lock} rows={f.rows||2} style={{ ...inp, resize:'vertical' }} />)}</div>
  if (f.t === 'select') return wrap(<select value={val||''} onChange={e=>{ if (!lock) set(e.target.value) }} disabled={lock} style={inp}>{f.options.map(o=><option key={o} value={o}>{o||'—'}</option>)}</select>)
  if (f.t === 'datetime') {
    return (
      <JourHeure
        label={f.l}
        value={val}
        set={v => { if (!lock) set(v) }}
        lecture={lock}
        jourDefaut={jourDefaut}
      />
    )
  }
  return wrap(<input type={f.t || 'text'} value={val||''} onChange={e=>{ if (!lock) set(e.target.value) }} readOnly={lock} style={inp} />)
}
