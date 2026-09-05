import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, AddressFields, fmtAdresse, inp, lbl, Tabs, Loading, Flash, Sel, F, LiensGps } from '@/components/ui'
import config from '@/app.config'
import { GROUPES, AUTORISATION_PHOTOS, normaliserAutorisationPhotos, lblAutorisationPhotos } from './missionSchema'
import Traitements from './Traitements'
import Vecteurs from './Vecteurs'
import Suivi from './Suivi'
import MaterielRequis from './MaterielRequis'
import { ProtocoleDetresseForm } from './ProtocoleDetresse'

const grp = id => GROUPES.find(g => g.id === id)

const TABS = [
  { id:'administratif', label:'Administratif', groupes:['administratif'] },
  { id:'trajet',        label:'Trajet', groupes:['base','prise_en_charge','destination','retour'] },
  { id:'vecteurs',      label:'Vecteurs & équipages' },
  { id:'materiel',      label:'Matériel & checklists' },
  { id:'medical',       label:'Médical', groupes:['medical'] },
  { id:'traitements',   label:'Traitements' },
  { id:'suivi',         label:'Suivi interne' },
]

export default function MissionForm({ souhaitId }) {
  const [m, setM] = useState(null)
  const [tab, setTab] = useState(() => sessionStorage.getItem(`encodage-tab-${souhaitId}`) || 'administratif')
  const [status, setStatus] = useState('')      // '', 'saving', 'saved'
  const chargee = useRef(false)
  const timer = useRef()

  useEffect(() => { sessionStorage.setItem(`encodage-tab-${souhaitId}`, tab) }, [souhaitId, tab])

  useEffect(() => { (async () => {
    const { data } = await supabase.from('souhaits').select('mission').eq('id', souhaitId).single()
    chargee.current = false
    const next = prefillBase(data?.mission || {})
    setM(next)
    const orig = data?.mission || {}
    if (next.base_nom !== orig.base_nom || fmtAdresse(next.base_adresse) !== fmtAdresse(orig.base_adresse)) {
      await supabase.from('souhaits').update({ mission: next }).eq('id', souhaitId)
    }
  })() }, [souhaitId])

  // Enregistrement automatique (débounce) à chaque modification
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

  const set = (k, v) => setM(o => ({ ...o, [k]: v }))
  if (!m) return <Loading />
  const cur = TABS.find(t => t.id === tab)

  return (
    <div>
      <Flash>Ici on encode et on prépare. Dans Matériel, vous pouvez ajouter des points aux checklists ; l’équipage les coche dans Mes missions.</Flash>
      <Tabs
        value={tab}
        onChange={setTab}
        items={TABS.map(t => ({ v:t.id, l:t.label }))}
        extra={<span style={{ fontSize:12, color: status==='saved'?'#3B6D11':'var(--text-faint)' }}>{status==='saving' ? 'Enregistrement…' : status==='saved' ? 'Enregistré' : 'Enregistrement automatique'}</span>}
      />

      {tab === 'vecteurs' && <Vecteurs souhaitId={souhaitId} m={m} setM={setM} />}
      {tab === 'materiel' && <MaterielRequis m={m} setM={setM} />}
      {tab === 'traitements' && (
        <div>
          <Flash>Encodez les traitements prévus. Les administrations se cochent dans Mes missions, le jour J.</Flash>
          <Traitements souhaitId={souhaitId} />
        </div>
      )}
      {tab === 'medical' && (
        <Flash>Ces infos sont lues par l'équipage médical sur le terrain. Le rapport de mission se rédige dans Mes missions.</Flash>
      )}
      {tab === 'suivi' && <Suivi souhaitId={souhaitId} />}

      {cur?.groupes && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {cur.groupes.map(gid => {
            if (gid === 'prise_en_charge') return <PriseEnCharge key={gid} m={m} set={set} />
            if (gid === 'base') return <BlocBase key={gid} m={m} set={set} />
            const g = grp(gid); if (!g) return null
            return (
              <Card key={gid}>
                <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>{g.label}</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
                  {g.fields.map(f => <Champ key={f.k} f={f} val={m[f.k]} set={v=>set(f.k, v)} />)}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'medical' && <ProtocoleDetresseForm m={m} setM={setM} />}

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

function BlocBase({ m, set }) {
  const bases = config.bases || []
  const nomMatch = bases.find(b => b.nom === m.base_nom)
  const valeurSel = nomMatch ? nomMatch.nom : (m.base_nom ? '__autre__' : (bases[0]?.nom || ''))
  function choisir(v) {
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
        options={[
          ...bases.map(b => ({ v: b.nom, l: b.nom })),
          { v: '__autre__', l: 'Autre (saisir l’adresse)' },
        ]}
      />
      {valeurSel === '__autre__' && (
        <F label="Nom de la base" value={m.base_nom || ''} set={v => set('base_nom', v)} />
      )}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>Adresse</div>
        <AddressFields value={m.base_adresse} set={v => set('base_adresse', v)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '0 24px' }}>
        <Champ f={grp('base').fields.find(f => f.k === 'rdv_base')} val={m.rdv_base} set={v => set('rdv_base', v)} />
        <Champ f={grp('base').fields.find(f => f.k === 'depart_base')} val={m.depart_base} set={v => set('depart_base', v)} />
      </div>
    </Card>
  )
}

function PriseEnCharge({ m, set }) {
  const dom = m.pec_type === 'Domicile du patient'
  const champ = k => grp('prise_en_charge').fields.find(f => f.k === k)
  return (
    <Card>
      <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>Prise en charge</div>
      <div style={{ maxWidth:320 }}><Champ f={champ('pec_type')} val={m.pec_type} set={v=>set('pec_type', v)} /></div>
      {dom ? (
        <div style={{ background:'var(--bg-alt)', borderRadius:10, padding:'10px 12px', margin:'6px 0' }}>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>Adresse (domicile du patient — reprise de l'Administratif)</div>
          <div style={{ fontSize:14, color:'var(--text)' }}>{fmtAdresse(m.patient_adresse) || '— à renseigner dans l\'onglet Administratif —'}</div>
          {fmtAdresse(m.patient_adresse) && <div style={{ marginTop: 6 }}><LiensGps adresse={m.patient_adresse} /></div>}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
          <Champ f={champ('pec_institution')} val={m.pec_institution} set={v=>set('pec_institution', v)} />
          <Champ f={champ('pec_adresse')} val={m.pec_adresse} set={v=>set('pec_adresse', v)} />
          <Champ f={champ('pec_service')} val={m.pec_service} set={v=>set('pec_service', v)} />
          <Champ f={champ('pec_etage')} val={m.pec_etage} set={v=>set('pec_etage', v)} />
          <Champ f={champ('pec_aile')} val={m.pec_aile} set={v=>set('pec_aile', v)} />
          <Champ f={champ('pec_chambre')} val={m.pec_chambre} set={v=>set('pec_chambre', v)} />
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
        <Champ f={champ('arrivee_pec')} val={m.arrivee_pec} set={v=>set('arrivee_pec', v)} />
        <Champ f={champ('depart_pec')} val={m.depart_pec} set={v=>set('depart_pec', v)} />
      </div>
      <Champ f={champ('pec_precisions')} val={m.pec_precisions} set={v=>set('pec_precisions', v)} />
    </Card>
  )
}

function Champ({ f, val, set }) {
  if (f.t === 'address') return <div style={{ gridColumn:'1 / -1', margin:'8px 0' }}><label style={lbl}>{f.l}</label><AddressFields value={val} set={set} /></div>
  if (f.t === 'sep') return <div style={{ gridColumn:'1 / -1', fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, margin:'14px 0 6px' }}>{f.l.replace(/—/g,'').trim()}</div>
  if (f.t === 'toggle') return (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'12px 0' }}>
      <button type="button" onClick={()=>set(!val)} style={{ width:44, height:26, borderRadius:99, border:'none', cursor:'pointer', background: val?'#3B6D11':'var(--border)', position:'relative', flexShrink:0 }}>
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
          onChange={e => set(AUTORISATION_PHOTOS[Number(e.target.value)].v)}
        />
        <div className="ha-photos-slider-stops">
          {AUTORISATION_PHOTOS.map(o => (
            <button type="button" key={o.v}
              className={'ha-photos-stop' + (cur === o.v ? ' is-on' : '') + (o.v === 'refus' ? ' is-refus' : '')}
              onClick={() => set(o.v)}>
              {o.l}
            </button>
          ))}
        </div>
      </div>
    )
  }
  const wrap = c => <div style={{ margin:'8px 0' }}><label style={lbl}>{f.l}</label>{c}</div>
  if (f.t === 'textarea') return <div style={{ gridColumn:'1 / -1' }}>{wrap(<textarea value={val||''} onChange={e=>set(e.target.value)} rows={f.rows||2} style={{ ...inp, resize:'vertical' }} />)}</div>
  if (f.t === 'select') return wrap(<select value={val||''} onChange={e=>set(e.target.value)} style={inp}>{f.options.map(o=><option key={o} value={o}>{o||'—'}</option>)}</select>)
  const type = f.t === 'datetime' ? 'datetime-local' : f.t
  return wrap(<input type={type} value={val||''} onChange={e=>set(e.target.value)} style={inp} />)
}
