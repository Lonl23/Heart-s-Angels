import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Btn, inp, fmtAdresse, Loading, Flash, Pill } from '@/components/ui'
import { STATUTS_BASE, lblStatutBase, itemsChecklistVisibles, itemsChecklistManquants } from './missionSchema'
import { personneEstMedicale, vecteurAEquipageMedical, lblRoleMission } from '@/modules/fiche/ficheSchema'
import { stInfo } from './Souhaits'
import MedicamentsMAR from './MedicamentsMAR'
import { COTES, CoinPhotos, PhotoAnnotator, TicketPhoto, uploadMissionPhoto } from './TerrainPhotos'
import ScanConso from '@/modules/stock/ScanConso'
import ScanEmport from '@/modules/stock/ScanEmport'

const fmtDt = v => v ? new Date(v).toLocaleString('fr-BE', { dateStyle:'short', timeStyle:'short' }) : '—'

const ETAPES = [
  { id:'vehicule',    l:'Véhicule',        sous:'Prise à la base' },
  { id:'pec',         l:'Prise en charge', sous:'Sur place' },
  { id:'retour_pec',  l:'Retour patient',  sous:'Fin de PEC' },
  { id:'retour_base', l:'Retour base',     sous:'Rentrée' },
]

const ETAPE_IDX = Object.fromEntries(ETAPES.map((e, i) => [e.id, i]))

function etapeDefaut(saved, vecteurStatut) {
  if (saved && ETAPES.some(e => e.id === saved)) return saved
  if (vecteurStatut === 'realise') return 'retour_base'
  if (vecteurStatut === 'en_cours') return 'pec'
  return 'vehicule'
}

function lblEtapeVehicule(etape, vecteurStatut) {
  if (vecteurStatut === 'realise') return 'Rentrée'
  return ({
    vehicule: 'À la base',
    pec: 'Prise en charge',
    retour_pec: 'Retour patient',
    retour_base: 'Retour base',
  })[etape] || 'À la base'
}

export default function MissionExecution({ souhaitId, onBack }) {
  const { user, profile, peutVoirSouhaitComplet, estMedical } = useAuth()
  const complet = peutVoirSouhaitComplet()
  const [sh, setSh] = useState(null)
  const [m, setM] = useState(null)
  const [rpc, setRpc] = useState(null)
  const [aff, setAff] = useState(null)
  const [equipe, setEquipe] = useState([])
  const [meds, setMeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)
  const [etape, setEtape] = useState('vehicule')
  const [annot, setAnnot] = useState(null)

  useEffect(() => { load() }, [souhaitId, complet, user?.id])

  async function load() {
    if (!user?.id) return
    setLoading(true); setErr(null)
    let { data: me } = await supabase.from('souhait_personnel')
      .select('*').eq('souhait_id', souhaitId).eq('user_id', user.id).maybeSingle()

    if (complet) {
      const [{ data: full, error }, { data: eq }] = await Promise.all([
        supabase.from('souhaits').select('*').eq('id', souhaitId).single(),
        supabase.from('souhait_personnel').select('*, profiles(prenom, role, fiche)').eq('souhait_id', souhaitId),
      ])
      if (error) { setErr(error.message); setLoading(false); return }
      const vs = full?.mission?.vecteurs || []
      if (me && !me.vecteur_id && vs.length === 1) {
        await supabase.rpc('choisir_mon_vecteur', { p_souhait: souhaitId, p_vecteur: vs[0].id })
        me = { ...me, vecteur_id: vs[0].id }
      }
      setAff(me)
      setEquipe(eq || [])
      setSh(full)
      setM(full?.mission || {})
      const vid = me?.vecteur_id || (vs.length === 1 ? vs[0].id : null)
      const savedEtape = (vid && full?.mission?.vecteur_etapes?.[vid]) || full?.mission?.etape_terrain
      const vstat = vid ? full?.mission?.vecteur_statuts?.[vid] : null
      setEtape(etapeDefaut(savedEtape, vstat))
      if (estMedical()) {
        const { data: ints } = await supabase.from('souhait_medicaments').select('*').eq('souhait_id', souhaitId)
        let all = ints || []
        const { data: dem } = await supabase.from('demandes_souhaits').select('id').eq('souhait_id', souhaitId).limit(1)
        if (dem?.[0]) {
          const { data: pm } = await supabase.from('souhait_medicaments').select('*').eq('demande_id', dem[0].id)
          all = [...all, ...(pm || [])]
        }
        setMeds(all)
      }
    } else {
      setAff(me)
      const { data, error } = await supabase.rpc('ma_mission', { p_souhait: souhaitId })
      if (error || !data?.ok) { setErr(error?.message || 'Mission inaccessible.'); setLoading(false); return }
      if (me && !me.vecteur_id && data.vecteur?.id) {
        await supabase.rpc('choisir_mon_vecteur', { p_souhait: souhaitId, p_vecteur: data.vecteur.id })
        me = { ...me, vecteur_id: data.vecteur.id }
        setAff(me)
      }
      setRpc(data)
      setEquipe([])
      setSh({
        statut: data.statut,
        beneficiaire_prenom: data.beneficiaire_prenom,
        description: data.description,
        date_souhaitee: data.date_souhaitee,
      })
      setEtape(etapeDefaut(data.etape_terrain, data.vecteur_statut))
    }
    setLoading(false)
  }

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 1400) }

  async function saveMission(next) {
    setM(next)
    const { error } = await supabase.from('souhaits').update({ mission: next }).eq('id', souhaitId)
    if (error) setErr(error.message); else flash()
  }

  const vecteursAll = complet ? (m?.vecteurs || []) : (rpc?.vecteurs_dispo || [])
  const vecteurId = aff?.vecteur_id || rpc?.vecteur_id || rpc?.vecteur?.id
    || (vecteursAll.length === 1 ? vecteursAll[0].id : null)
  const vecteur = complet
    ? (m?.vecteurs || []).find(v => v.id === vecteurId)
    : rpc?.vecteur
  const aChoisir = !vecteur && vecteursAll.length > 1
  const choix = vecteursAll
  const photos = complet
    ? (vecteurId ? (m?.terrain_photos?.[vecteurId] || {}) : {})
    : (rpc?.photos || {})

  const crewVecteur = complet
    ? equipe.filter(e => e.vecteur_id === vecteurId)
    : (rpc?.equipage || [])
  const vecteurMedical = complet
    ? vecteurAEquipageMedical(crewVecteur)
    : (rpc?.equipage_medical != null ? !!rpc.equipage_medical : vecteurAEquipageMedical(crewVecteur))
  const userMedical = estMedical() || personneEstMedicale({
    role_mission: aff?.role_mission || rpc?.role_mission,
    role: profile?.role,
    fiche: profile?.fiche,
  })
  const clOpts = {
    userMedical,
    vecteurMedical,
    mission: complet ? m : { checklist_extras: rpc?.checklist_extras },
  }
  const vecteurStatut = (vecteurId && m?.vecteur_statuts?.[vecteurId]) || rpc?.vecteur_statut || null
  const vecteursEquipes = new Set(
    complet
      ? equipe.map(e => e.vecteur_id).filter(Boolean)
      : (vecteurId ? [vecteurId] : [])
  )
  if (vecteurId) vecteursEquipes.add(vecteurId)
  const plusieursVecteurs = complet
    ? (m?.vecteurs || []).filter(v => vecteursEquipes.has(v.id)).length > 1
    : (rpc?.nb_vecteurs_equipes || rpc?.nb_vecteurs || 1) > 1

  async function choisirVecteur(id) {
    const { data, error } = await supabase.rpc('choisir_mon_vecteur', { p_souhait: souhaitId, p_vecteur: id })
    if (error || data?.ok === false) { setErr(error?.message || data?.error); return }
    setAff(x => ({ ...(x || {}), vecteur_id: id }))
    await load()
  }

  async function aller(next) {
    setEtape(next)
    if (complet) {
      const nextM = { ...(m || {}), etape_terrain: next }
      if (vecteurId) nextM.vecteur_etapes = { ...(nextM.vecteur_etapes || {}), [vecteurId]: next }
      await saveMission(nextM)
    } else {
      await supabase.rpc('set_etape_terrain', { p_souhait: souhaitId, p_etape: next })
      setRpc(x => x ? { ...x, etape_terrain: next } : x)
    }
  }

  async function avancer(statut) {
    setErr(null)
    const maintenant = new Date().toISOString()
    if (complet) {
      const nextM = { ...(m || {}) }
      const vs = { ...(nextM.vecteur_statuts || {}) }
      if (vecteurId) {
        vs[vecteurId] = statut
        nextM.vecteur_statuts = vs
        nextM.vecteur_etapes = {
          ...(nextM.vecteur_etapes || {}),
          [vecteurId]: statut === 'en_cours' ? 'pec' : 'retour_base',
        }
        if (statut === 'realise') {
          nextM.vecteur_clotures = { ...(nextM.vecteur_clotures || {}), [vecteurId]: maintenant }
        }
      }
      if (statut === 'en_cours' && !nextM.demarre_le) nextM.demarre_le = maintenant
      const ids = [...vecteursEquipes]
      const tousRentes = statut === 'realise' && (ids.length === 0 || ids.every(id => (id === vecteurId ? 'realise' : vs[id]) === 'realise'))
      const patch = { mission: nextM }
      if (statut === 'en_cours' && sh?.statut !== 'realise') patch.statut = 'en_cours'
      if (tousRentes) {
        patch.statut = 'realise'
        patch.date_realisee = new Date().toISOString().slice(0, 10)
        nextM.cloture_le = maintenant
        patch.mission = nextM
      }
      const { error } = await supabase.from('souhaits').update(patch).eq('id', souhaitId)
      if (error) { setErr(error.message); return }
      setM(nextM)
      setSh(x => ({ ...x, ...patch, mission: nextM }))
      flash()
      return
    }
    const { data, error } = await supabase.rpc('avancer_mission', { p_souhait: souhaitId, p_statut: statut })
    if (error || data?.ok === false) { setErr(error?.message || data?.error || 'Impossible de changer le statut.'); return }
    setSh(x => ({ ...x, statut: data?.statut || statut }))
    setRpc(x => x ? { ...x, statut: data?.statut || statut, vecteur_statut: data?.vecteur_statut || statut } : x)
    flash()
  }

  async function toggleCheck(section, item, cur) {
    const nextVal = !cur
    if (complet) {
      const next = { ...(m || {}) }
      if (vecteurId) {
        const vc = { ...(next.vecteur_checklists || {}) }
        const curV = vc[vecteurId] || {}
        vc[vecteurId] = { ...curV, [section]: { ...(curV[section] || {}), [item]: nextVal } }
        next.vecteur_checklists = vc
      } else {
        next.checklists = { ...(next.checklists || {}), [section]: { ...((next.checklists || {})[section] || {}), [item]: nextVal } }
      }
      await saveMission(next)
      return
    }
    const key = section === 'base' ? 'check_base' : section === 'retour_base' ? 'check_retour_base' : section === 'pec' ? 'check_pec' : 'check_retour_pec'
    setRpc(x => ({ ...x, [key]: { ...(x[key] || {}), [item]: nextVal } }))
    const { data, error } = await supabase.rpc('cocher_terrain', { p_souhait: souhaitId, p_section: section, p_item: item, p_val: nextVal })
    if (error || data?.ok === false) {
      setRpc(x => ({ ...x, [key]: { ...(x[key] || {}), [item]: cur } }))
      setErr(error?.message || data?.error || 'Enregistrement impossible.')
    } else flash()
  }

  async function setMonStatutBase(val) {
    setErr(null)
    const prev = aff?.statut_base
    setAff(x => ({ ...(x || {}), statut_base: val }))
    if (complet) {
      const next = {
        ...(m || {}),
        personnel_statuts: { ...(m?.personnel_statuts || {}), [user.id]: val },
      }
      const { error: colErr } = await supabase.from('souhait_personnel')
        .update({ statut_base: val }).eq('souhait_id', souhaitId).eq('user_id', user.id)
      if (colErr && !/statut_base|schema cache|column/i.test(colErr.message)) {
        setAff(x => ({ ...(x || {}), statut_base: prev }))
        setErr(colErr.message)
        return
      }
      await saveMission(next)
      setEquipe(list => list.map(e => e.user_id === user.id ? { ...e, statut_base: val } : e))
      return
    }
    const { data, error } = await supabase.rpc('set_statut_base', { p_souhait: souhaitId, p_statut: val })
    if (error || data?.ok === false) {
      setAff(x => ({ ...(x || {}), statut_base: prev }))
      setErr(error?.message || data?.error || 'Statut non enregistré.')
      return
    }
    setRpc(x => {
      if (!x) return x
      const equipage = (x.equipage || []).map(e => e.user_id === user.id ? { ...e, statut_base: val } : e)
      return { ...x, statut_base: val, equipage }
    })
    flash()
  }

  async function saveKms(patch) {
    if (!vecteurId) return
    if (complet) {
      await saveMission({ ...m, vecteurs: (m.vecteurs || []).map(v => v.id === vecteurId ? { ...v, ...patch } : v) })
      return
    }
    setRpc(x => x?.vecteur ? { ...x, vecteur: { ...x.vecteur, ...patch } } : x)
    const { error } = await supabase.rpc('maj_releves_vehicule', { p_souhait: souhaitId, p_patch: patch })
    if (error) setErr(error.message); else flash()
  }

  async function persistPhoto(slot, meta, action = 'set', groupe = 'coins') {
    if (complet) {
      const next = { ...(m || {}) }
      const tp = { ...(next.terrain_photos || {}) }
      const cur = { ...(tp[vecteurId] || {}) }
      if (groupe === 'ticket') cur.ticket_carburant = meta
      else cur[groupe] = { ...(cur[groupe] || {}), [slot]: meta }
      tp[vecteurId] = cur
      await saveMission({ ...next, terrain_photos: tp })
      return
    }
    const rpcSlot = groupe === 'ticket' ? 'ticket_carburant' : (groupe === 'coins_retour' ? ('r_' + slot) : slot)
    const { data, error } = await supabase.rpc('sauver_photo_terrain', {
      p_souhait: souhaitId, p_vecteur: vecteurId, p_slot: rpcSlot, p_meta: meta, p_action: action,
    })
    if (error || data?.ok === false) { setErr(error?.message || data?.error); return }
    setRpc(x => {
      const photos = { ...(x.photos || {}) }
      if (groupe === 'ticket') photos.ticket_carburant = meta
      else photos[groupe] = { ...(photos[groupe] || {}), [slot]: meta }
      return { ...x, photos }
    })
    flash()
  }

  async function captureCoin(slot, file, groupe = 'coins') {
    try {
      const meta = await uploadMissionPhoto(souhaitId, vecteurId, `${groupe}/${slot}`, file)
      await persistPhoto(slot, meta, 'set', groupe)
      setAnnot({ slot, meta, extra: false, groupe })
    } catch (e) { setErr(e.message || 'Photo impossible.') }
  }
  async function removeCoin(slot, groupe = 'coins') {
    const prev = photos?.[groupe]?.[slot]
    try {
      if (prev?.path) await supabase.storage.from('mission-photos').remove([prev.path])
      await persistPhoto(slot, null, 'set', groupe)
    } catch (e) { setErr(e.message || 'Suppression impossible.') }
  }
  async function captureTicket(file) {
    try {
      const meta = await uploadMissionPhoto(souhaitId, vecteurId, 'ticket_carburant', file)
      await persistPhoto('ticket_carburant', meta, 'set', 'ticket')
    } catch (e) { setErr(e.message || 'Photo impossible.') }
  }
  async function saveAnnot(nextMeta) {
    await persistPhoto(annot.slot, nextMeta, 'set', annot.groupe || 'coins')
    setAnnot(null)
  }

  async function saveObs(txt) {
    if (complet) { await saveMission({ ...m, rapport_observations: txt }); return }
    setRpc(x => ({ ...x, rapport_observations: txt }))
    const { error } = await supabase.rpc('noter_mission', { p_souhait: souhaitId, p_observations: txt })
    if (error) setErr(error.message); else flash()
  }

  async function saveMed(med, prises) {
    setMeds(list => list.map(x => x.id === med.id ? { ...x, prises } : x))
    await supabase.from('souhait_medicaments').update({ prises }).eq('id', med.id)
    flash()
  }

  const cotesOk = COTES.every(c => photos?.coins?.[c.id]?.path)
  async function partir() {
    if (!cotesOk) { setErr('Photographiez les 4 côtés du véhicule avant de partir.'); return }
    if (vecteurStatut !== 'en_cours' && vecteurStatut !== 'realise' && sh?.statut !== 'realise') {
      await avancer('en_cours')
    }
    await aller('pec')
  }
  async function terminer() {
    await avancer('realise')
  }

  if (loading) return <div style={{ padding:24 }}><Loading /></div>
  if (err && !sh) return <div style={{ padding:24 }}><Flash kind="err">{err}</Flash><Btn kind="soft" onClick={onBack}>← Retour</Btn></div>

  const statut = sh?.statut
  const st = stInfo(statut)
  const titre = complet
    ? `${sh?.beneficiaire_prenom || ''} ${sh?.beneficiaire_nom || ''}`.trim()
    : (sh?.beneficiaire_prenom || 'Mission')
  const itin = complet ? itineraryFromMission(m) : rpc
  const vc = complet ? (m?.vecteur_checklists?.[vecteurId] || {}) : {}
  const cl = m?.checklists || {}
  const checks = {
    base: complet ? (vc.base || {}) : (rpc?.check_base || {}),
    pec: complet ? (vc.pec || cl.pec || {}) : (rpc?.check_pec || {}),
    retour_pec: complet ? (vc.retour_pec || cl.retour_pec || {}) : (rpc?.check_retour_pec || {}),
    retour_base: complet ? (vc.retour_base || {}) : (rpc?.check_retour_base || {}),
  }
  const itemsVis = {
    base: itemsChecklistVisibles('base', clOpts),
    pec: itemsChecklistVisibles('pec', clOpts),
    retour_pec: itemsChecklistVisibles('retour_pec', clOpts),
    retour_base: itemsChecklistVisibles('retour_base', clOpts),
  }
  const pecMedicalACharge = vecteurMedical && !userMedical
  const pecSansMedical = !vecteurMedical
  const cta = {
    vehicule: { l: 'Véhicule pris — on part', go: partir, kind: 'start' },
    pec: {
      l: pecSansMedical || pecMedicalACharge ? 'C’est bon — on continue' : 'Prise en charge faite',
      go: () => aller('retour_pec'),
      kind: 'start',
    },
    retour_pec: {
      l: pecSansMedical || pecMedicalACharge ? 'On rentre à la base' : 'Retour patient fait — rentrer',
      go: () => aller('retour_base'),
      kind: 'start',
    },
    retour_base: {
      l: plusieursVecteurs ? 'Ce véhicule est rentré' : 'Terminer la mission',
      go: terminer,
      kind: 'done',
    },
  }[etape]
  const locked = statut === 'realise' || vecteurStatut === 'realise'
  const monStatut = aff?.statut_base || m?.personnel_statuts?.[user?.id] || rpc?.statut_base || ''
  const roleAff = aff?.role_mission || rpc?.role_mission

  const manquantsHint = (() => {
    if (etape === 'vehicule') {
      const miss = itemsChecklistManquants('base', checks.base, clOpts)
      return miss.length ? miss.join(', ') : null
    }
    if (etape === 'pec' && userMedical && vecteurMedical) {
      const miss = itemsChecklistManquants('pec', checks.pec, clOpts)
      return miss.length ? miss.join(', ') : null
    }
    if (etape === 'retour_pec' && userMedical && vecteurMedical) {
      const miss = itemsChecklistManquants('retour_pec', checks.retour_pec, clOpts)
      return miss.length ? miss.join(', ') : null
    }
    if (etape === 'retour_base') {
      const miss = itemsChecklistManquants('retour_base', checks.retour_base, clOpts)
      return miss.length ? miss.join(', ') : null
    }
    return null
  })()

  return (
    <div className="ha-terrain" style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px 110px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:8 }}>
        <Btn kind="soft" onClick={onBack}>← Mes missions</Btn>
        <span style={{ fontSize:12.5, color: saved ? '#3B6D11' : 'var(--text-faint)' }}>{saved ? '✓ Enregistré' : 'Enregistrement auto'}</span>
      </div>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
        <h1 style={{ fontSize:'1.45rem', color:'var(--heading)', margin:'4px 0 2px' }}>{titre || 'Mission'}</h1>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <Pill color={st.c} bg={st.bg}>{st.l}</Pill>
          {vecteur && (
            <Pill color="#185FA5" bg="#E6F1FB">{lblEtapeVehicule(etape, vecteurStatut)}</Pill>
          )}
        </div>
      </div>
      <p style={{ color:'var(--text-muted)', fontSize:14, margin:'4px 0 8px', lineHeight:1.45 }}>{sh?.description}</p>
      {roleAff && (
        <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:8 }}>
          Votre rôle : <strong>{lblRoleMission(roleAff) || roleAff}</strong>
          {userMedical ? '' : ' · logistique'}
        </div>
      )}
      {err && <Flash kind="err">{err}</Flash>}

      {aChoisir && (
        <Section titre="Quel véhicule prenez-vous ?">
          <p style={{ fontSize:13.5, color:'var(--text-muted)', marginTop:0 }}>Vous ne cochez que le véhicule de votre équipage.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {choix.map(v => (
              <button key={v.id} type="button" className="ha-check-btn" onClick={()=>choisirVecteur(v.id)}>
                <span>{v.nom || 'Vecteur'}{v.plaque ? ` · ${v.plaque}` : ''}{v.type_transport ? ` · ${v.type_transport}` : ''}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {!aChoisir && !vecteur && (
        <Flash kind="warn">Aucun véhicule ne vous est affecté. Demandez à la coordination de vous placer sur un vecteur.</Flash>
      )}

      {vecteur && (
        <>
          <div className="ha-etapes">
            {ETAPES.map((e, i) => (
              <button
                key={e.id}
                type="button"
                className={'ha-etape' + (etape===e.id ? ' is-on' : '') + ((ETAPE_IDX[etape] ?? 0) > i ? ' is-done' : '')}
                onClick={()=>aller(e.id)}
              >
                <span className="ha-etape-n">{i+1}</span>
                <span>
                  <span className="ha-etape-l">{e.l}</span>
                  <span className="ha-etape-s">{e.sous}</span>
                </span>
              </button>
            ))}
          </div>

          <Section titre={vecteur.nom ? `Votre véhicule — ${vecteur.nom}` : 'Votre véhicule'}>
            <div style={{ fontSize:14, color:'var(--text)' }}>
              {[vecteur.type_transport, vecteur.plaque].filter(Boolean).join(' · ') || 'Véhicule de votre équipage'}
            </div>
            {crewVecteur.length > 0 && (
              <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:8, lineHeight:1.45 }}>
                {crewVecteur.map(e => {
                  const stb = e.statut_base || m?.personnel_statuts?.[e.user_id] || ''
                  const nom = e.profiles?.prenom || e.prenom || 'Volontaire'
                  return `${nom}${stb ? ` · ${lblStatutBase(stb)}` : ''}`
                }).join('  ·  ')}
              </div>
            )}
          </Section>

          {etape === 'vehicule' && (
            <>
              <Section titre="Mon statut à la base">
                <div className="ha-statuts-base">
                  {STATUTS_BASE.map(s => (
                    <button
                      key={s.v}
                      type="button"
                      disabled={locked}
                      className={'ha-check-btn' + (monStatut === s.v ? ' is-on' : '')}
                      onClick={()=>setMonStatutBase(s.v)}
                    >
                      <span className="ha-check-mark">{monStatut === s.v ? '✓' : ''}</span>
                      <span>{s.l}</span>
                    </button>
                  ))}
                </div>
              </Section>
              <Section titre="Itinéraire du jour"><Itineraire d={itin} compact /></Section>
              <Section titre="Photos des 4 côtés — prise du véhicule">
                <CoinPhotos coins={photos.coins || {}} onCapture={(slot, f)=>captureCoin(slot, f, 'coins')} onAnnotate={(slot, meta)=>setAnnot({ slot, meta, extra:false, groupe:'coins' })} onDelete={slot=>removeCoin(slot, 'coins')} disabled={locked || !vecteurId} />
                {!cotesOk && <div style={{ fontSize:13, color:'#BA7517', marginTop:8 }}>Les 4 côtés sont demandés avant de quitter la base.</div>}
              </Section>
              <Section titre="Checklist départ">
                <ScanEmport souhaitId={souhaitId} locked={locked} onFlash={flash} onErr={setErr}
                  checksBase={checks.base} onToggleLibre={(it,on)=>toggleCheck('base', it, on)} />
                <CheckBlock items={itemsVis.base} etat={checks.base} onToggle={(it,on)=>toggleCheck('base', it, on)} />
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  <MiniNum l="KMs départ" v={vecteur.kms_depart} set={val=>saveKms({ kms_depart: val })} />
                  <MiniNum l="Essence %" v={vecteur.essence_pct} set={val=>saveKms({ essence_pct: val })} />
                </div>
              </Section>
            </>
          )}

          {etape === 'pec' && (
            <>
              <Section titre="Lieu de prise en charge"><Itineraire d={itin} only="pec" /></Section>
              {itemsVis.pec.length > 0 && (
                <Section titre="Checklist prise en charge">
                  <CheckBlock items={itemsVis.pec} etat={checks.pec} onToggle={(it,on)=>toggleCheck('pec', it, on)} />
                </Section>
              )}
              {pecMedicalACharge && (
                <p style={{ fontSize:13.5, color:'var(--text-muted)', margin:'12px 0 0' }}>Checklist patient : à charge du médical de ce véhicule.</p>
              )}
              {pecSansMedical && (
                <p style={{ fontSize:13.5, color:'var(--text-muted)', margin:'12px 0 0' }}>Pas de checklist patient sur ce véhicule — équipage non médical.</p>
              )}
              {userMedical && vecteurMedical && complet && <MedicamentsMAR meds={meds} onSavePrises={saveMed} />}
              {userMedical && vecteurMedical && (
                <Section titre="Matériel utilisé">
                  <ScanConso souhaitId={souhaitId} locked={locked} onFlash={flash} onErr={setErr} />
                </Section>
              )}
            </>
          )}

          {etape === 'retour_pec' && (
            <>
              <Section titre="Destination / retour"><Itineraire d={itin} only="retour" /></Section>
              {itemsVis.retour_pec.length > 0 && (
                <Section titre={vecteurMedical && userMedical ? 'Checklist retour patient' : 'Checklist retour'}>
                  <CheckBlock items={itemsVis.retour_pec} etat={checks.retour_pec} onToggle={(it,on)=>toggleCheck('retour_pec', it, on)} />
                </Section>
              )}
              {pecMedicalACharge && itemsVis.retour_pec.length === 0 && (
                <p style={{ fontSize:13.5, color:'var(--text-muted)', margin:'12px 0 0' }}>Retour patient : à charge du médical de ce véhicule.</p>
              )}
              {userMedical && vecteurMedical && complet && <MedicamentsMAR meds={meds} onSavePrises={saveMed} />}
              {userMedical && vecteurMedical && (
                <Section titre="Matériel utilisé">
                  <ScanConso souhaitId={souhaitId} locked={locked} onFlash={flash} onErr={setErr} />
                </Section>
              )}
            </>
          )}

          {etape === 'retour_base' && (
            <>
              <Section titre="Photos des 4 côtés — remise du véhicule">
                <CoinPhotos
                  coins={photos.coins_retour || {}}
                  hint="Photographiez à nouveau les 4 côtés. Marquez tout dégât apparu pendant la mission."
                  onCapture={(slot, f)=>captureCoin(slot, f, 'coins_retour')}
                  onAnnotate={(slot, meta)=>setAnnot({ slot, meta, extra:false, groupe:'coins_retour' })}
                  onDelete={slot=>removeCoin(slot, 'coins_retour')}
                  disabled={locked || !vecteurId}
                />
              </Section>
              <Section titre="Ticket de caisse carburant">
                <TicketPhoto meta={photos.ticket_carburant} onCapture={captureTicket} disabled={locked || !vecteurId} />
              </Section>
              <Section titre="Checklist retour base">
                <CheckBlock items={itemsVis.retour_base} etat={checks.retour_base} onToggle={(it,on)=>toggleCheck('retour_base', it, on)} />
                <MiniNum l="KMs retour" v={vecteur.kms_retour} set={val=>saveKms({ kms_retour: val })} />
              </Section>
              {userMedical && vecteurMedical && complet && <RapportMedical m={m} onSave={saveMission} />}
              <Section titre="Matériel utilisé">
                <ScanConso souhaitId={souhaitId} locked={locked} onFlash={flash} onErr={setErr} />
              </Section>
              <RapportLogistique value={complet ? (m?.rapport_observations || '') : (rpc?.rapport_observations || '')} onSave={saveObs} />
            </>
          )}
        </>
      )}

      {!complet && <div style={{ fontSize:12, color:'var(--text-faint)', marginTop:12 }}>Aucune information médicale n'est accessible depuis cette vue.</div>}

      {vecteur && cta && !locked && statut !== 'realise' && (
        <div className="ha-terrain-bar">
          {manquantsHint && (
            <div style={{ fontSize:12.5, color:'#BA7517', marginBottom:8, textAlign:'center' }}>
              Encore à cocher : {manquantsHint}.
            </div>
          )}
          <button type="button" className={'ha-terrain-cta ' + cta.kind} onClick={cta.go}>{cta.l}</button>
        </div>
      )}
      {vecteurStatut === 'realise' && statut !== 'realise' && (
        <div className="ha-terrain-bar">
          <div style={{ fontWeight:700, color:'#3B6D11', textAlign:'center', padding:'10px' }}>
            Ce véhicule est rentré — d’autres équipages sont encore en mission.
          </div>
        </div>
      )}
      {statut === 'realise' && <div className="ha-terrain-bar"><div style={{ fontWeight:700, color:'#3B6D11', textAlign:'center', padding:'10px' }}>Mission clôturée</div></div>}

      {annot && <PhotoAnnotator meta={annot.meta} onSave={saveAnnot} onClose={()=>setAnnot(null)} />}
    </div>
  )
}

function itineraryFromMission(m) {
  if (!m) return {}
  const pecAdr = m.pec_type === 'Domicile du patient' ? m.patient_adresse : m.pec_adresse
  return {
    base: { nom: m.base_nom, adresse: m.base_adresse, rdv: m.rdv_base, depart: m.depart_base },
    pec: { type: m.pec_type, institution: m.pec_institution, adresse: pecAdr, service: m.pec_service, etage: m.pec_etage, aile: m.pec_aile, chambre: m.pec_chambre, heure: m.arrivee_pec, depart: m.depart_pec, precisions: m.pec_precisions },
    destination: { adresse: m.dest_adresse, precisions: m.dest_precisions, heure: m.arrivee_destination },
    retour: { type: m.retour_type, heure: m.retour_heure, precisions: m.retour_precisions },
    consignes_equipage: m.consignes_equipage,
  }
}

function Itineraire({ d, compact, only }) {
  if (!d) return <div style={{ fontSize:13.5, color:'var(--text-muted)' }}>Trajet non renseigné.</div>
  const show = k => !only || only === k || (only === 'retour' && (k === 'destination' || k === 'retour'))
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: compact ? 8 : 12 }}>
      {show('base') && <Bloc titre="Base">
        <Ligne k="Lieu" v={[d.base?.nom, fmtAdresse(d.base?.adresse)].filter(Boolean).join(' — ')} />
        <Ligne k="Rendez-vous" v={fmtDt(d.base?.rdv)} />
        <Ligne k="Départ" v={fmtDt(d.base?.depart)} />
        {d.consignes_equipage && <Ligne k="Consignes" v={d.consignes_equipage} />}
      </Bloc>}
      {show('pec') && <Bloc titre="Prise en charge">
        <Ligne k="Lieu" v={d.pec?.type} />
        {d.pec?.institution && <Ligne k="Institution" v={d.pec.institution} />}
        <Ligne k="Adresse" v={fmtAdresse(d.pec?.adresse)} />
        {(d.pec?.service || d.pec?.etage || d.pec?.aile || d.pec?.chambre) &&
          <Ligne k="Localisation" v={[d.pec?.service && `Service ${d.pec.service}`, d.pec?.etage && `Étage ${d.pec.etage}`, d.pec?.aile && `Aile ${d.pec.aile}`, d.pec?.chambre && `Ch. ${d.pec.chambre}`].filter(Boolean).join(' · ')} />}
        <Ligne k="Heure souhaitée" v={fmtDt(d.pec?.heure)} />
        <Ligne k="Départ souhaité" v={fmtDt(d.pec?.depart)} />
        {d.pec?.precisions && <Ligne k="Précisions" v={d.pec.precisions} />}
      </Bloc>}
      {show('destination') && <Bloc titre="Destination">
        <Ligne k="Adresse" v={fmtAdresse(d.destination?.adresse)} />
        {d.destination?.precisions && <Ligne k="Précisions" v={d.destination.precisions} />}
        <Ligne k="Heure souhaitée" v={fmtDt(d.destination?.heure)} />
      </Bloc>}
      {show('retour') && <Bloc titre="Retour">
        <Ligne k="Type" v={d.retour?.type} />
        {d.retour?.heure && <Ligne k="Heure attendue" v={fmtDt(d.retour.heure)} />}
        {d.retour?.precisions && <Ligne k="Précisions" v={d.retour.precisions} />}
      </Bloc>}
    </div>
  )
}

function CheckBlock({ items, etat, onToggle }) {
  if (!items?.length) return null
  const faits = items.filter(it => etat[it]).length
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ textAlign:'right', fontSize:12.5, fontWeight:700, color:'var(--text-muted)', marginBottom:8 }}>{faits}/{items.length}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {items.map(it => {
          const on = !!etat[it]
          return (
            <button key={it} type="button" onClick={()=>onToggle(it, on)} className={'ha-check-btn' + (on ? ' is-on' : '')}>
              <span className="ha-check-mark">{on ? '✓' : ''}</span>
              <span>{it}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RapportMedical({ m, onSave }) {
  const [txt, setTxt] = useState(m?.rapport_medical || '')
  useEffect(() => { setTxt(m?.rapport_medical || '') }, [m?.rapport_medical])
  return (
    <Section titre="Rapport médical">
      <textarea value={txt} onChange={e=>setTxt(e.target.value)} onBlur={()=>onSave({ ...m, rapport_medical: txt })}
        rows={4} style={{ ...inp, resize:'vertical' }} placeholder="Déroulement, observations cliniques…" />
    </Section>
  )
}

function RapportLogistique({ value, onSave }) {
  const [txt, setTxt] = useState(value || '')
  useEffect(() => { setTxt(value || '') }, [value])
  return (
    <Section titre="Notes de terrain">
      <textarea value={txt} onChange={e=>setTxt(e.target.value)} onBlur={()=>onSave(txt)}
        rows={3} style={{ ...inp, resize:'vertical' }} placeholder="Véhicule, matériel, incidents logistiques…" />
    </Section>
  )
}

function Section({ titre, children }) {
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 16px 18px', marginTop:14 }}>
      <div style={{ fontSize:'1.05rem', fontWeight:700, color:'var(--heading)', marginBottom:12 }}>{titre}</div>
      {children}
    </div>
  )
}
function Bloc({ titre, children }) {
  return (
    <div>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.4, marginBottom:6 }}>{titre}</div>
      {children}
    </div>
  )
}
function Ligne({ k, v }) {
  if (!v || v === '—') return null
  return <div style={{ marginBottom:6 }}><div style={{ fontSize:12, color:'var(--text-muted)' }}>{k}</div><div style={{ fontSize:15, color:'var(--text)', lineHeight:1.4 }}>{v}</div></div>
}
function MiniNum({ l, v, set }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>{l}</label>
      <input type="number" inputMode="decimal" value={v??''} onChange={e=>set(e.target.value)}
        style={{ ...inp, width:120, minHeight:44, fontSize:16 }} />
    </div>
  )
}
