import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, AddressFields, fmtAdresse, inp, lbl, Tabs, Loading, Flash, Sel, F, LiensGps, Btn, AdresseAffichee } from '@/components/ui'
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
import { GenreIcon } from '@/modules/annuaire/genre'
import { formaterNiss, fmtTelephones, libelleGenre } from '@/modules/annuaire/annuaireSchema'
import { ficheVersBeneficiaire } from '@/modules/annuaire/annuaireApi'

const grp = id => GROUPES.find(g => g.id === id)
const ADMIN_MISSION = ['consentement', 'autorisation_photos', 'priorite_elevee', 'date_demande', 'date_rencontre', 'consignes_equipage']

const TABS = [
  { id:'administratif', label:'Administratif', groupes:['administratif'], zone:'patient' },
  { id:'trajet',        label:'Trajet', groupes:['base','prise_en_charge','destination','retour'], zone:'programme' },
  { id:'vecteurs',      label:'Vecteurs & équipages', zone:'programme' },
  { id:'materiel',      label:'Matériel & checklists', zone:'programme' },
  { id:'medical',       label:'Médical', groupes:['medical'], zone:'patient' },
  { id:'traitements',   label:'Traitements', zone:'patient' },
  { id:'suivi',         label:'Suivi interne', zone:'commun' },
]

export default function MissionForm({ souhaitId, souhait: souhaitProp }) {
  const { peutProgrammerSouhait, peutEncoderPatientSouhait } = useAuth()
  const programme = peutProgrammerSouhait()
  const patient = peutEncoderPatientSouhait()
  const tabs = TABS
  const [m, setM] = useState(null)
  const [souhait, setSouhait] = useState(souhaitProp || null)
  const [instDemandeuse, setInstDemandeuse] = useState(null)
  const [tab, setTab] = useState(() => sessionStorage.getItem(`encodage-tab-${souhaitId}`) || 'administratif')
  const [status, setStatus] = useState('')
  const chargee = useRef(false)
  const timer = useRef()

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
            if (gid === 'prise_en_charge') return <PriseEnCharge key={gid} m={m} set={set} lecture={lectureOnglet} instDemandeuse={instDemandeuse} />
            if (gid === 'base') return <BlocBase key={gid} m={m} set={set} lecture={lectureOnglet} />
            if (gid === 'administratif') return <BlocAdministratif key={gid} m={m} set={set} setM={setMSi} lecture={lectureOnglet} souhait={souhait} />
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

function BlocAdministratif({ m, set, setM, lecture, souhait }) {
  const g = grp('administratif')
  const [fiche, setFiche] = useState(null)
  useEffect(() => {
    if (!souhait?.beneficiaire_annuaire_id) { setFiche(null); return }
    supabase.from('annuaire').select('*').eq('id', souhait.beneficiaire_annuaire_id).maybeSingle()
      .then(({ data }) => setFiche(data || null))
  }, [souhait?.beneficiaire_annuaire_id])

  const b = fiche ? ficheVersBeneficiaire(fiche) : {}
  const prenom = souhait?.beneficiaire_prenom || b.prenom || ''
  const nom = souhait?.beneficiaire_nom || b.nom || ''
  const ddn = souhait?.beneficiaire_ddn || b.date_naissance || ''
  const genre = souhait?.beneficiaire_genre || b.genre || ''
  const niss = souhait?.beneficiaire_niss || b.niss || m.registre_national || ''
  const gsm = souhait?.beneficiaire_tel_gsm || b.tel_gsm || ''
  const fixe = souhait?.beneficiaire_tel_fixe || b.tel_fixe || ''
  const adresse = (fmtAdresse(souhait?.beneficiaire_adresse) && souhait.beneficiaire_adresse)
    || (fmtAdresse(b.adresse) && b.adresse)
    || m.patient_adresse
  const tels = fmtTelephones({ tel_gsm: gsm, tel_fixe: fixe })
  const manqueAdresse = adresseVide(adresse)
  const originLib = souhait?.origine === 'institution' ? 'Institution' : (souhait?.origine ? 'Demande privée' : (m.origine || ''))

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

      <div style={{ background:'var(--bg-alt)', borderRadius:10, padding:'12px 14px', margin:'4px 0 14px' }}>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>Repris de la fiche bénéficiaire</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
          {genre && <GenreIcon genre={genre} size={22} title={libelleGenre(genre)} />}
          <div style={{ fontWeight:700, fontSize:15, color:'var(--heading)' }}>{prenom} {nom}{!prenom && !nom ? '—' : ''}</div>
        </div>
        <div style={{ fontSize:13.5, color:'var(--text-2)', lineHeight:1.55 }}>
          {ddn && <div>Né(e) le {new Date(ddn).toLocaleDateString('fr-BE')}</div>}
          {niss && <div>Registre national {formaterNiss(niss)}</div>}
          {tels && <div>{tels}</div>}
          {originLib && <div>Origine : {originLib}</div>}
        </div>
        {fmtAdresse(adresse)
          ? <div style={{ marginTop:8 }}><AdresseAffichee label="Adresse légale" value={adresse} /></div>
          : <div style={{ marginTop:8, fontSize:13, color:'var(--text-muted)' }}>Aucune adresse sur la fiche — complétez-la ci-dessous.</div>}
      </div>

      {manqueAdresse && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:4 }}>Adresse du domicile du patient</div>
          <AddressFields value={m.patient_adresse} set={v => { if (!lecture) set('patient_adresse', v) }} />
        </div>
      )}
      {!niss && (
        <Champ f={grp('administratif').fields.find(f => f.k === 'registre_national')} val={m.registre_national} set={v => set('registre_national', v)} lecture={lecture} />
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
        {g.fields.filter(f => ADMIN_MISSION.includes(f.k)).map(f => <Champ key={f.k} f={f} val={m[f.k]} set={v=>set(f.k, v)} lecture={lecture} />)}
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

function PriseEnCharge({ m, set, lecture, instDemandeuse }) {
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
  function appliquerRecherche(hit) {
    if (lecture) return
    set('pec_inst_source', 'autre')
    set('pec_institution', hit.nom || '')
    if (hit.adresse) set('pec_adresse', hit.adresse)
  }

  return (
    <Card>
      <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--heading)', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>Prise en charge</div>
      <div style={{ maxWidth:320 }}><Champ f={champ('pec_type')} val={m.pec_type} set={choisirType} lecture={lecture} /></div>
      {dom && (
        <div style={{ background:'var(--bg-alt)', borderRadius:10, padding:'10px 12px', margin:'6px 0' }}>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>Adresse (domicile du patient — reprise de la fiche bénéficiaire)</div>
          <div style={{ fontSize:14, color:'var(--text)' }}>{fmtAdresse(m.patient_adresse) || '— à renseigner sur la fiche bénéficiaire —'}</div>
          {fmtAdresse(m.patient_adresse) && <div style={{ marginTop: 6 }}><LiensGps adresse={m.patient_adresse} /></div>}
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
          {!source && (
            <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8 }}>
              {instDemandeuse
                ? 'Indiquez s’il s’agit de l’institution qui a demandé le souhait, ou d’un autre établissement.'
                : 'Recherchez l’établissement de prise en charge (annuaire ou internet).'}
            </div>
          )}
          {aDemandeuse && (
            <div style={{ background:'var(--bg-alt)', borderRadius:10, padding:'10px 12px', marginBottom:10 }}>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Adresse de l’institution demandeuse</div>
              <div style={{ fontWeight:600, fontSize:14, color:'var(--text)', margin:'2px 0 4px' }}>{instDemandeuse.nom}</div>
              <div style={{ fontSize:14, color:'var(--text)' }}>{fmtAdresse(instDemandeuse.adresse) || fmtAdresse(m.pec_adresse) || '—'}</div>
              {instDemandeuse.tel && <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>{instDemandeuse.tel}</div>}
              {fmtAdresse(instDemandeuse.adresse || m.pec_adresse) && (
                <div style={{ marginTop:6 }}><LiensGps adresse={instDemandeuse.adresse || m.pec_adresse} /></div>
              )}
            </div>
          )}
          {source === 'autre' && (
            <RechercheInstitution lecture={lecture} onPick={appliquerRecherche} />
          )}
          {source === 'autre' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0 24px' }}>
              <Champ f={champ('pec_institution')} val={m.pec_institution} set={v=>set('pec_institution', v)} lecture={lecture} />
              <Champ f={champ('pec_adresse')} val={m.pec_adresse} set={v=>set('pec_adresse', v)} lecture={lecture} />
            </div>
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
        <Champ f={champ('arrivee_pec')} val={m.arrivee_pec} set={v=>set('arrivee_pec', v)} lecture={lecture} />
        <Champ f={champ('depart_pec')} val={m.depart_pec} set={v=>set('depart_pec', v)} lecture={lecture} />
      </div>
      <Champ f={champ('pec_precisions')} val={m.pec_precisions} set={v=>set('pec_precisions', v)} lecture={lecture} />
    </Card>
  )
}

function RechercheInstitution({ lecture, onPick }) {
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
    try {
      const { data } = await supabase.from('annuaire')
        .select('id,nom,telephone,data,categorie')
        .in('categorie', ['institution', 'externe_souhait'])
        .ilike('nom', `%${needle}%`)
        .limit(8)
      for (const r of data || []) {
        locaux.push({
          id: r.id,
          nom: r.nom,
          adresse: r.data?.adresse || null,
          tel: r.telephone || r.data?.telephone || '',
          via: 'Annuaire',
        })
      }
    } catch { /* annuaire optionnel */ }
    try {
      web = await chercherPhoton(needle)
    } catch {
      msg = 'La recherche internet n’a pas abouti. Essayez Google Maps ci-dessous, ou encodez l’adresse à la main.'
    }
    const vus = new Set(locaux.map(x => (x.nom || '').toLowerCase()))
    const fusion = [...locaux, ...web.filter(x => !vus.has((x.nom || '').toLowerCase()))]
    setHits(fusion)
    setBusy(false)
    if (!fusion.length) setErr(msg || 'Aucun résultat. Affinez le nom, ou ouvrez Google Maps.')
    else setErr(msg)
  }

  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.trim() || 'institution Belgique')}`

  return (
    <div style={{ marginBottom:12 }}>
      <form onSubmit={chercher} style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ flex:'1 1 220px' }}>
          <F label="Rechercher l’institution (annuaire + internet)" value={q} set={setQ} />
        </div>
        <Btn onClick={chercher} disabled={lecture || busy} style={{ marginBottom:10 }}>{busy ? 'Recherche…' : 'Rechercher'}</Btn>
        <a href={maps} target="_blank" rel="noopener noreferrer" className="ha-gps-btn" style={{ marginBottom:12, alignSelf:'center' }}>Google Maps</a>
      </form>
      {err && <div style={{ fontSize:13, color:'#8A6D1B', marginBottom:8 }}>{err}</div>}
      {hits.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
          {hits.map((h, i) => (
            <button
              key={h.id || `${h.nom}-${i}`}
              type="button"
              disabled={lecture}
              onClick={() => onPick(h)}
              style={{
                textAlign:'left', padding:'10px 12px', borderRadius:10, cursor:'pointer',
                border:'1px solid var(--border)', background:'var(--card)', fontFamily:'inherit',
              }}
            >
              <div style={{ fontWeight:600, color:'var(--text)' }}>{h.nom || 'Sans nom'}{h.via ? <span style={{ fontWeight:500, color:'var(--text-muted)', fontSize:12 }}> · {h.via}</span> : null}</div>
              <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2 }}>{fmtAdresse(h.adresse) || 'Adresse non renseignée'}</div>
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
