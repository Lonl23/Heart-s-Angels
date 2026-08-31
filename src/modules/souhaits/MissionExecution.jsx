import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Btn, inp, fmtAdresse, Loading, Flash, Pill } from '@/components/ui'
import { CHECKLISTS } from './missionSchema'
import { stInfo } from './Souhaits'
import MedicamentsMAR from './MedicamentsMAR'
import { COTES, CoinPhotos, PhotoAnnotator, TicketPhoto, uploadMissionPhoto } from './TerrainPhotos'

const fmtDt = v => v ? new Date(v).toLocaleString('fr-BE', { dateStyle:'short', timeStyle:'short' }) : '—'

const ETAPES = [
  { id:'vehicule',    l:'Véhicule',        sous:'Prise à la base' },
  { id:'pec',         l:'Prise en charge', sous:'Sur place' },
  { id:'retour_pec',  l:'Retour patient',  sous:'Fin de PEC' },
  { id:'retour_base', l:'Retour base',     sous:'Rentrée' },
]

function etapeDefaut(statut, saved) {
  if (saved && ETAPES.some(e => e.id === saved)) return saved
  if (statut === 'realise') return 'retour_base'
  if (statut === 'en_cours') return 'pec'
  return 'vehicule'
}

export default function MissionExecution({ souhaitId, onBack }) {
  const { user, peutVoirSouhaitComplet, estMedical } = useAuth()
  const complet = peutVoirSouhaitComplet()
  const medical = estMedical()
  const [sh, setSh] = useState(null)
  const [m, setM] = useState(null)
  const [rpc, setRpc] = useState(null)
  const [aff, setAff] = useState(null)
  const [meds, setMeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)
  const [etape, setEtape] = useState('vehicule')
  const [annot, setAnnot] = useState(null) // { slot, meta, extra }

  useEffect(() => { load() }, [souhaitId, complet, user?.id])

  async function load() {
    if (!user?.id) return
    setLoading(true); setErr(null)
    let { data: me } = await supabase.from('souhait_personnel')
      .select('vecteur_id, role_mission').eq('souhait_id', souhaitId).eq('user_id', user.id).maybeSingle()

    if (complet) {
      const { data: full, error } = await supabase.from('souhaits').select('*').eq('id', souhaitId).single()
      if (error) { setErr(error.message); setLoading(false); return }
      const vs = full?.mission?.vecteurs || []
      if (me && !me.vecteur_id && vs.length === 1) {
        await supabase.rpc('choisir_mon_vecteur', { p_souhait: souhaitId, p_vecteur: vs[0].id })
        me = { ...me, vecteur_id: vs[0].id }
      }
      setAff(me)
      setSh(full)
      setM(full?.mission || {})
      setEtape(etapeDefaut(full?.statut, full?.mission?.etape_terrain))
      if (medical) {
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
      setSh({
        statut: data.statut,
        beneficiaire_prenom: data.beneficiaire_prenom,
        description: data.description,
        date_souhaitee: data.date_souhaitee,
      })
      setEtape(etapeDefaut(data.statut, data.etape_terrain))
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

  async function choisirVecteur(id) {
    const { data, error } = await supabase.rpc('choisir_mon_vecteur', { p_souhait: souhaitId, p_vecteur: id })
    if (error || data?.ok === false) { setErr(error?.message || data?.error); return }
    setAff(x => ({ ...(x || {}), vecteur_id: id }))
    await load()
  }

  async function aller(next) {
    setEtape(next)
    if (complet) await saveMission({ ...(m || {}), etape_terrain: next })
    else await supabase.rpc('set_etape_terrain', { p_souhait: souhaitId, p_etape: next })
  }

  async function avancer(statut) {
    setErr(null)
    if (complet) {
      const patch = { statut }
      if (statut === 'realise') patch.date_realisee = new Date().toISOString().slice(0,10)
      const nextM = { ...(m || {}), [statut==='en_cours'?'demarre_le':'cloture_le']: new Date().toISOString() }
      patch.mission = nextM
      const { error } = await supabase.from('souhaits').update(patch).eq('id', souhaitId)
      if (error) { setErr(error.message); return }
      setM(nextM)
      setSh(x => ({ ...x, ...patch }))
      flash()
      return
    }
    const { data, error } = await supabase.rpc('avancer_mission', { p_souhait: souhaitId, p_statut: statut })
    if (error || data?.ok === false) { setErr(error?.message || data?.error || 'Impossible de changer le statut.'); return }
    setSh(x => ({ ...x, statut }))
    setRpc(x => x ? { ...x, statut } : x)
    flash()
  }

  async function toggleCheck(section, item, cur) {
    const nextVal = !cur
    if (complet) {
      const next = { ...(m || {}) }
      if (vecteurId && (section === 'base' || section === 'retour_base')) {
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
    if (sh?.statut !== 'en_cours' && sh?.statut !== 'realise') await avancer('en_cours')
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
  const checks = {
    base: complet ? (m?.vecteur_checklists?.[vecteurId]?.base || {}) : (rpc?.check_base || {}),
    pec: complet ? (m?.checklists?.pec || {}) : (rpc?.check_pec || {}),
    retour_pec: complet ? (m?.checklists?.retour_pec || {}) : (rpc?.check_retour_pec || {}),
    retour_base: complet ? (m?.vecteur_checklists?.[vecteurId]?.retour_base || {}) : (rpc?.check_retour_base || {}),
  }
  const cta = {
    vehicule: { l: 'Véhicule pris — on part', go: partir, kind: 'start' },
    pec: { l: 'Prise en charge faite', go: () => aller('retour_pec'), kind: 'start' },
    retour_pec: { l: 'Retour patient fait — rentrer', go: () => aller('retour_base'), kind: 'start' },
    retour_base: { l: 'Terminer la mission', go: terminer, kind: 'done' },
  }[etape]
  const locked = statut === 'realise'

  return (
    <div className="ha-terrain" style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px 110px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:8 }}>
        <Btn kind="soft" onClick={onBack}>← Mes missions</Btn>
        <span style={{ fontSize:12.5, color: saved ? '#3B6D11' : 'var(--text-faint)' }}>{saved ? '✓ Enregistré' : 'Enregistrement auto'}</span>
      </div>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
        <h1 style={{ fontSize:'1.45rem', color:'var(--heading)', margin:'4px 0 2px' }}>{titre || 'Mission'}</h1>
        <Pill color={st.c} bg={st.bg}>{st.l}</Pill>
      </div>
      <p style={{ color:'var(--text-muted)', fontSize:14, margin:'4px 0 8px', lineHeight:1.45 }}>{sh?.description}</p>
      {(aff?.role_mission || rpc?.role_mission) && (
        <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:8 }}>Votre rôle : <strong>{aff?.role_mission || rpc?.role_mission}</strong></div>
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
              <button key={e.id} type="button" className={'ha-etape' + (etape===e.id ? ' is-on' : '')} onClick={()=>aller(e.id)}>
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
          </Section>

          {etape === 'vehicule' && (
            <>
              <Section titre="Itinéraire du jour"><Itineraire d={itin} compact /></Section>
              <Section titre="Photos des 4 côtés — prise du véhicule">
                <CoinPhotos coins={photos.coins || {}} onCapture={(slot, f)=>captureCoin(slot, f, 'coins')} onAnnotate={(slot, meta)=>setAnnot({ slot, meta, extra:false, groupe:'coins' })} disabled={locked || !vecteurId} />
                {!cotesOk && <div style={{ fontSize:13, color:'#BA7517', marginTop:8 }}>Les 4 côtés sont demandés avant de quitter la base.</div>}
              </Section>
              <Section titre="Checklist départ">
                <CheckBlock items={CHECKLISTS.base.items} etat={checks.base} onToggle={(it,on)=>toggleCheck('base', it, on)} />
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
              <Section titre="Checklist prise en charge">
                <CheckBlock items={CHECKLISTS.pec.items} etat={checks.pec} onToggle={(it,on)=>toggleCheck('pec', it, on)} />
              </Section>
              {medical && complet && <MedicamentsMAR meds={meds} onSavePrises={saveMed} />}
            </>
          )}

          {etape === 'retour_pec' && (
            <>
              <Section titre="Destination / retour"><Itineraire d={itin} only="retour" /></Section>
              <Section titre="Checklist retour patient">
                <CheckBlock items={CHECKLISTS.retour_pec.items} etat={checks.retour_pec} onToggle={(it,on)=>toggleCheck('retour_pec', it, on)} />
              </Section>
              {medical && complet && <MedicamentsMAR meds={meds} onSavePrises={saveMed} />}
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
                  disabled={locked || !vecteurId}
                />
              </Section>
              <Section titre="Ticket de caisse carburant">
                <TicketPhoto meta={photos.ticket_carburant} onCapture={captureTicket} disabled={locked || !vecteurId} />
              </Section>
              <Section titre="Checklist retour base">
                <CheckBlock items={CHECKLISTS.retour_base.items} etat={checks.retour_base} onToggle={(it,on)=>toggleCheck('retour_base', it, on)} />
                <MiniNum l="KMs retour" v={vecteur.kms_retour} set={val=>saveKms({ kms_retour: val })} />
              </Section>
              {medical && complet && <RapportMedical m={m} onSave={saveMission} />}
              <RapportLogistique value={complet ? (m?.rapport_observations || '') : (rpc?.rapport_observations || '')} onSave={saveObs} />
            </>
          )}
        </>
      )}

      {!complet && <div style={{ fontSize:12, color:'var(--text-faint)', marginTop:12 }}>Aucune information médicale n'est accessible depuis cette vue.</div>}

      {vecteur && cta && statut !== 'realise' && (
        <div className="ha-terrain-bar">
          <button type="button" className={'ha-terrain-cta ' + cta.kind} onClick={cta.go}>{cta.l}</button>
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
