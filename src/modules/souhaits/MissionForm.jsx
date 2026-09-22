import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, AddressFields, fmtAdresse, inp, lbl, Tabs, Loading, Flash, Sel, F, LiensGps } from '@/components/ui'
import config from '@/app.config'
import { GROUPES, AUTORISATION_PHOTOS, normaliserAutorisationPhotos, lblAutorisationPhotos, equipePluri, nomsRecolteurs } from './missionSchema'
import Traitements from './Traitements'
import Vecteurs from './Vecteurs'
import Suivi from './Suivi'
import MaterielRequis from './MaterielRequis'
import { ProtocoleDetresseForm } from './ProtocoleDetresse'
import EquipePluriForm, { LignesPluri } from './EquipePluri'
import { RecolteursPicker } from './Recolteurs'
import { useAuth } from '@/hooks/useAuth'

const grp = id => GROUPES.find(g => g.id === id)

const TABS = [
  { id:'administratif', label:'Administratif', groupes:['administratif'], zone:'patient' },
  { id:'trajet',        label:'Trajet', groupes:['base','prise_en_charge','destination','retour'], zone:'programme' },
  { id:'vecteurs',      label:'Vecteurs & équipages', zone:'programme' },
  { id:'materiel',      label:'Matériel & checklists', zone:'programme' },
  { id:'medical',       label:'Médical', groupes:['medical'], zone:'patient' },
  { id:'traitements',   label:'Traitements', zone:'patient' },
  { id:'suivi',         label:'Suivi interne', zone:'commun' },
]

export default function MissionForm({ souhaitId }) {
  const { peutProgrammerSouhait, peutEncoderPatientSouhait } = useAuth()
  const programme = peutProgrammerSouhait()
  const patient = peutEncoderPatientSouhait()
  const tabs = TABS
  const [m, setM] = useState(null)
  const [tab, setTab] = useState(() => sessionStorage.getItem(`encodage-tab-${souhaitId}`) || 'administratif')
  const [status, setStatus] = useState('')
  const chargee = useRef(false)
  const timer = useRef()

  useEffect(() => {
    if (tabs.length && !tabs.some(t => t.id === tab)) setTab(tabs[0].id)
  }, [tab])

  useEffect(() => { sessionStorage.setItem(`encodage-tab-${souhaitId}`, tab) }, [souhaitId, tab])

  useEffect(() => { (async () => {
    const { data } = await supabase.from('souhaits').select('mission').eq('id', souhaitId).single()
    chargee.current = false
    const orig = data?.mission || {}
    const next = programme ? prefillBase(orig) : orig
    setM(next)
    if (programme && (next.base_nom !== orig.base_nom || fmtAdresse(next.base_adresse) !== fmtAdresse(orig.base_adresse))) {
      await supabase.from('souhaits').update({ mission: next }).eq('id', souhaitId)
    }
  })() }, [souhaitId])

  useEffect(() => {
    if (m === null) return
    if (!chargee.current) { chargee.current = true; return }
    setStatus('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await supabase.from('souhaits').update({ mission: m }).eq('id', souhaitId)
      setStatus('saved'); setTimeout(() => setStatus(s => s === 'saved' ? '' : s), 1500)
    }, 600)
    return () => clearTimeout(timer.current)
  }, [m])

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
      <Flash>
        {programme
          ? 'Ici on encode et on prépare. Dans Matériel, vous pouvez ajouter des points aux checklists ; l’équipage les coche dans Mes missions.'
          : 'Vous voyez tout le dossier pour informer le patient. Vous encodez la partie patient (identité, souhait, médical). Les équipages, horaires et ambulances sont saisis par la coordination transport, la présidence ou l’informatique.'}
      </Flash>
      {lecture && (
        <Flash kind="warn">Lecture seule sur cet onglet — horaires, équipages et ambulances à transmettre au patient. L’encodage se fait par la coordination transport.</Flash>
      )}
      <Tabs
        value={cur.id}
        onChange={setTab}
        items={tabs.map(t => ({ v:t.id, l:t.label }))}
        extra={<span style={{ fontSize:12, color: status==='saved'?'#3B6D11':'var(--text-faint)' }}>{lectureOnglet ? 'Lecture seule' : status==='saving' ? 'Enregistrement…' : status==='saved' ? 'Enregistré' : 'Enregistrement automatique'}</span>}
      />

      {cur.id === 'vecteurs' && <Vecteurs souhaitId={souhaitId} m={m} setM={setMSi} lecture={lecture} />}
      {cur.id === 'materiel' && <MaterielRequis m={m} setM={setMSi} lecture={lecture} />}
      {cur.id === 'traitements' && (
        <div>
          {!lecturePatient && <Flash>Encodez les traitements prévus. Les administrations se cochent dans Mes missions, le jour J.</Flash>}
          <Traitements souhaitId={souhaitId} readOnly={lecturePatient} />
        </div>
      )}
      {cur.id === 'medical' && (
        <Flash>Ces infos sont lues par l'équipage médical sur le terrain. Le rapport de mission se rédige dans Mes missions.</Flash>
      )}
      {cur.id === 'suivi' && <Suivi souhaitId={souhaitId} />}

      {cur?.groupes && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {cur.groupes.map(gid => {
            if (gid === 'prise_en_charge') return <PriseEnCharge key={gid} m={m} set={set} lecture={lectureOnglet} />
            if (gid === 'base') return <BlocBase key={gid} m={m} set={set} lecture={lectureOnglet} />
            if (gid === 'administratif') return <BlocAdministratif key={gid} m={m} set={set} setM={setMSi} lecture={lectureOnglet} />
            const g = grp(gid); if (!g) return null
            return (
              <Card key={gid}>
                <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>{g.label}</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
                  {g.fields.map(f => <Champ key={f.k} f={f} val={m[f.k]} set={v=>set(f.k, v)} lecture={lectureOnglet} />)}
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
      {cur.id === 'medical' && <ProtocoleDetresseForm m={m} setM={lecturePatient ? (() => {}) : setM} />}

    </div>
  )
}

function prefillBase(m) {
  const b = (config.bases || [])[0]
  if (!b) return m
  if (m.base_nom || fmtAdresse(m.base_adresse)) {
    if (estSolumob(m.base_nom) && (!fmtAdresse(m.base_adresse) || localiteIncomplete(m.base_adresse))) {
      return { ...m, base_nom: b.nom, base_adresse: { ...b.adresse } }
    }
    return m
  }
  return { ...m, base_nom: b.nom, base_adresse: { ...b.adresse } }
}

function estSolumob(nom) {
  const n = String(nom || '').toLowerCase()
  return n.includes('solumob') || n.includes('jemeppe')
}

function localiteIncomplete(a) {
  if (!a || typeof a !== 'object') return true
  const loc = String(a.localite || '').toLowerCase()
  return loc.includes('jemeppe') && !loc.includes('seraing')
}

function BlocAdministratif({ m, set, setM, lecture }) {
  const g = grp('administratif')
  return (
    <Card>
      <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>{g.label}</div>
      {lecture ? (
        <div style={{ margin: '8px 0 12px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Récolteurs de souhait</div>
          <div style={{ fontSize: 14, color: 'var(--text)' }}>{nomsRecolteurs(m) || '—'}</div>
        </div>
      ) : (
        <RecolteursPicker m={m} setM={setM} />
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
        {g.fields.map(f => <Champ key={f.k} f={f} val={m[f.k]} set={v=>set(f.k, v)} lecture={lecture} />)}
      </div>
    </Card>
  )
}

function BlocBase({ m, set, lecture }) {
  const bases = config.bases || []
  const nomMatch = bases.find(b => b.nom === m.base_nom)
  const valeurSel = nomMatch ? nomMatch.nom : (m.base_nom ? '__autre__' : (bases[0]?.nom || ''))
  function choisir(v) {
    if (lecture) return
    if (v === '__autre__') { set('base_nom', m.base_nom && !nomMatch ? m.base_nom : ''); return }
    const b = bases.find(x => x.nom === v)
    if (!b) return
    set('base_nom', b.nom)
    set('base_adresse', { ...b.adresse })
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
          ...bases.map(b => ({ v: b.nom, l: b.nom })),
          { v: '__autre__', l: 'Autre (saisir l’adresse)' },
        ]}
      />
      {valeurSel === '__autre__' && (
        <F label="Nom de la base" value={m.base_nom || ''} set={v => set('base_nom', v)} readOnly={lecture} />
      )}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse</div>
        <AddressFields value={m.base_adresse} set={v => { if (!lecture) set('base_adresse', v) }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '0 24px' }}>
        <Champ f={grp('base').fields.find(f => f.k === 'rdv_base')} val={m.rdv_base} set={v => set('rdv_base', v)} lecture={lecture} />
        <Champ f={grp('base').fields.find(f => f.k === 'depart_base')} val={m.depart_base} set={v => set('depart_base', v)} lecture={lecture} />
      </div>
    </Card>
  )
}

function PriseEnCharge({ m, set, lecture }) {
  const dom = m.pec_type === 'Domicile du patient'
  const champ = k => grp('prise_en_charge').fields.find(f => f.k === k)
  return (
    <Card>
      <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>Prise en charge</div>
      <div style={{ maxWidth:320 }}><Champ f={champ('pec_type')} val={m.pec_type} set={v=>set('pec_type', v)} lecture={lecture} /></div>
      {dom ? (
        <div style={{ background:'var(--bg-alt)', borderRadius:10, padding:'10px 12px', margin:'6px 0' }}>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>Adresse (domicile du patient — reprise de l'Administratif)</div>
          <div style={{ fontSize:14, color:'var(--text)' }}>{fmtAdresse(m.patient_adresse) || '— à renseigner dans l\'onglet Administratif —'}</div>
          {fmtAdresse(m.patient_adresse) && <div style={{ marginTop: 6 }}><LiensGps adresse={m.patient_adresse} /></div>}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
          <Champ f={champ('pec_institution')} val={m.pec_institution} set={v=>set('pec_institution', v)} lecture={lecture} />
          <Champ f={champ('pec_adresse')} val={m.pec_adresse} set={v=>set('pec_adresse', v)} lecture={lecture} />
          <Champ f={champ('pec_service')} val={m.pec_service} set={v=>set('pec_service', v)} lecture={lecture} />
          <Champ f={champ('pec_etage')} val={m.pec_etage} set={v=>set('pec_etage', v)} lecture={lecture} />
          <Champ f={champ('pec_aile')} val={m.pec_aile} set={v=>set('pec_aile', v)} lecture={lecture} />
          <Champ f={champ('pec_chambre')} val={m.pec_chambre} set={v=>set('pec_chambre', v)} lecture={lecture} />
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
        <Champ f={champ('arrivee_pec')} val={m.arrivee_pec} set={v=>set('arrivee_pec', v)} lecture={lecture} />
        <Champ f={champ('depart_pec')} val={m.depart_pec} set={v=>set('depart_pec', v)} lecture={lecture} />
      </div>
      <Champ f={champ('pec_precisions')} val={m.pec_precisions} set={v=>set('pec_precisions', v)} lecture={lecture} />
    </Card>
  )
}

function Champ({ f, val, set, lecture }) {
  if (!f) return null
  const lock = !!lecture
  if (f.t === 'address') return <div style={{ gridColumn:'1 / -1', margin:'8px 0' }}><label style={lbl}>{f.l}</label><AddressFields value={val} set={lock ? (()=>{}) : set} /></div>
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
  const type = f.t === 'datetime' ? 'datetime-local' : f.t
  return wrap(<input type={type} value={val||''} onChange={e=>{ if (!lock) set(e.target.value) }} readOnly={lock} style={inp} />)
}
