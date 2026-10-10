import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, F, Sel, inp, lbl } from '@/components/ui'
import {
  ROLES_MISSION, lblRoleMission, teinteDepuisQuals, roleSuggere, qualsImplicites,
  rolesRequisEffectifs, rolesRequisVecteur, phraseIlManque, rolesEncoreManquants,
  rolesManquantsMultiset, couvertureMission, countRole, withRoleCount,
} from '@/modules/fiche/ficheSchema'
import {
  fmtDatesSouhait, joursDesPeriodes, periodesDepuisSouhait, plageGlobale,
  normaliserPeriodes, clePeriode, asJours, fmtPeriode, fmtPeriodeCourt, annoterPeriodes,
} from './datesSouhait'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'v' + Date.now() + Math.random().toString(16).slice(2))
const TYPES = ['', 'Ambulance', 'VSL', 'Voiture', 'Autre']

export default function Vecteurs({ souhaitId, m, setM, lecture=false }) {
  const vecteurs = m.vecteurs || []
  const [equipe, setEquipe] = useState([])
  const [pool, setPool] = useState([])
  const [dates, setDates] = useState({ label: '', jours: [], d0: null, d1: null, periodes: [] })
  const [periodeSel, setPeriodeSel] = useState(null)

  useEffect(() => { charger() }, [souhaitId])

  async function charger() {
    const [{ data: sh }, { data: eq }, rpc] = await Promise.all([
      supabase.from('souhaits').select('date_souhaitee,date_fin,dates_possibles').eq('id', souhaitId).single(),
      supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role,fiche)').eq('souhait_id', souhaitId),
      supabase.rpc('personnel_disponible_souhait', { p_souhait: souhaitId }),
    ])
    const periodes = normaliserPeriodes(periodesDepuisSouhait(sh))
    const plage = plageGlobale(periodes)
    const jours = joursDesPeriodes(periodes)
    setDates({
      label: fmtDatesSouhait(sh),
      jours,
      d0: plage.date_souhaitee,
      d1: plage.date_fin,
      periodes,
    })
    setEquipe(eq || [])
    let pers = normaliserPool(rpc.data)
    if (!pers.length) pers = await poolDepuisProfils(jours, plage.date_souhaitee, plage.date_fin)
    const joursByUser = {}
    if (plage.date_souhaitee) {
      const { data: dispos } = await supabase.from('disponibilites')
        .select('user_id,date_debut,date_fin')
        .lte('date_debut', plage.date_fin).gte('date_fin', plage.date_souhaitee)
      for (const d of dispos || []) {
        const set = joursByUser[d.user_id] || new Set()
        for (const j of joursDesPeriodes([{ debut: d.date_debut, fin: d.date_fin || d.date_debut }])) set.add(j)
        joursByUser[d.user_id] = set
      }
    }
    pers = pers.map(p => {
      const joursDispo = asJours(p.jours_dispo).length ? asJours(p.jours_dispo) : [...(joursByUser[p.user_id] || [])]
      const conflitPrecis = Array.isArray(p.jours_conflit)
      const joursConflit = asJours(p.jours_conflit)
      const ann = annoterPeriodes(joursDispo, joursConflit, periodes)
      const conflitPeriode = { ...ann.conflitPeriode }
      if (!conflitPrecis && p.conflit && periodes.length === 1) {
        conflitPeriode[clePeriode(periodes[0])] = true
      }
      return {
        ...p,
        quals: asQuals(p.quals),
        jours_dispo: joursDispo,
        jours_conflit: joursConflit,
        conflitPrecis,
        parPeriode: ann.parPeriode,
        conflitPeriode,
        dispo: ann.dispo,
        conflit: conflitPrecis ? ann.conflit : !!p.conflit,
      }
    })
    setPool(pers)
    setPeriodeSel(prev => {
      if (prev && periodes.some(p => clePeriode(p) === clePeriode(prev))) {
        return periodes.find(p => clePeriode(p) === clePeriode(prev))
      }
      return meilleurePeriode(periodes, pers)
    })
  }

  function majVecteur(id, patch) { setM(o => ({ ...o, vecteurs: (o.vecteurs||[]).map(v => v.id===id ? { ...v, ...patch } : v) })) }
  function ajouterVecteur() { setM(o => ({ ...o, vecteurs: [...(o.vecteurs||[]), { id:uid(), nom:'', type_transport:'', plaque:'', roles_requis:[] }] })) }
  function retirerVecteur(id) {
    setM(o => {
      const vc = { ...(o.vecteur_checklists||{}) }
      delete vc[id]
      return { ...o, vecteurs:(o.vecteurs||[]).filter(v=>v.id!==id), vecteur_checklists:vc }
    })
  }

  async function flushMission() { await supabase.from('souhaits').update({ mission: m }).eq('id', souhaitId) }

  const dejaIds = new Set(equipe.map(e => e.user_id))

  async function affecter(vid, userId) {
    if (!userId) return
    const p = pool.find(x => x.user_id === userId)
    const st = statutSur(p, periodeSel)
    const conf = conflitSur(p, periodeSel)
    if (st === 'non') {
      if (!confirm(periodeSel
        ? `Cette personne n’est pas disponible le ${fmtPeriode(periodeSel)}. L’affecter quand même ?`
        : 'Cette personne n’a pas indiqué de disponibilité sur ces dates. L’affecter quand même ?')) return
    } else if (st === 'partiel') {
      if (!confirm(periodeSel
        ? `Disponibilité partielle sur ${fmtPeriode(periodeSel)}. L’affecter quand même ?`
        : 'Disponibilité partielle sur la période. L’affecter quand même ?')) return
    }
    if (conf) {
      if (!confirm(periodeSel
        ? `Déjà affectée à une autre mission le ${fmtPeriode(periodeSel)}. L’affecter quand même ?`
        : 'Déjà affectée à une autre mission sur ces dates. L’affecter quand même ?')) return
    }
    await flushMission()
    const v = (m.vecteurs||[]).find(x => x.id === vid)
    const requisV = rolesRequisVecteur(v, m.roles_requis)
    const membresV = equipe.filter(e => e.vecteur_id === vid)
    const rolesDejaV = membresV.map(e => e.role_mission).filter(Boolean)
    const personnesV = membresV.map(e => {
      const px = pool.find(x => x.user_id === e.user_id)
      return { quals: px?.quals || qualsImplicites(e.profiles?.role, e.profiles?.fiche) }
    })
    const remaining = rolesEncoreManquants(requisV, personnesV)
    const role = roleSuggere(p?.quals || [], remaining.length ? remaining : requisV, rolesDejaV)
    const { error } = await supabase.from('souhait_personnel')
      .upsert({
        souhait_id: souhaitId,
        user_id: userId,
        vecteur_id: vid,
        vehicule: [v?.nom, v?.plaque].filter(Boolean).join(' · ') || null,
        role_mission: role || null,
      }, { onConflict: 'souhait_id,user_id' })
    if (error) { alert("Impossible d'ajouter cet équipier : " + error.message); return }
    await charger()
  }
  async function retirerMembre(id) {
    await supabase.from('souhait_personnel').delete().eq('id', id)
    await flushMission()
    charger()
  }

  function toggleRoleVecteur(vid, role) {
    setM(o => ({
      ...o,
      vecteurs: (o.vecteurs || []).map(v => {
        if (v.id !== vid) return v
        const cur = Array.isArray(v.roles_requis) ? v.roles_requis : (o.roles_requis || [])
        if (role === 'ambulancier') {
          const n = countRole(cur, 'ambulancier')
          return { ...v, roles_requis: n > 0 ? cur.filter(x => x !== 'ambulancier') : [...cur, 'ambulancier'] }
        }
        return { ...v, roles_requis: cur.includes(role) ? cur.filter(x => x !== role) : [...cur, role] }
      }),
    }))
  }
  function setRoleCountVecteur(vid, role, n) {
    setM(o => ({
      ...o,
      vecteurs: (o.vecteurs || []).map(v => {
        if (v.id !== vid) return v
        const cur = Array.isArray(v.roles_requis) ? v.roles_requis : (o.roles_requis || [])
        return { ...v, roles_requis: withRoleCount(cur, role, n) }
      }),
    }))
  }

  const alternatives = (dates.periodes || []).length >= 2
  const requisTous = rolesTousVecteurs(m)
  const libres = pool.filter(p => !dejaIds.has(p.user_id) && statutSur(p, periodeSel) === 'plein' && !conflitSur(p, periodeSel))
  const periode = dates.label && dates.label !== 'Date à définir' ? dates.label : null

  return (
    <div>
      {!dates.d0 && (
        <div className="ha-flash ha-flash-warn" style={{ marginBottom:14 }}>Indiquez les dates du souhait (fiche bénéficiaire) pour croiser avec les disponibilités.</div>
      )}
      {dates.d0 && alternatives && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:8 }}>
            Dates possibles — <strong>l’une ou l’autre</strong>, pas les deux. Choisissez le jour où vous bouclez l’équipage.
          </div>
          <div className="ha-date-opts">
            {dates.periodes.map(p => {
              const on = clePeriode(p) === clePeriode(periodeSel)
              const manques = manquesSurPeriode(m, equipe, pool, p)
              const noms = nomsDispoPeriode(pool, p, requisTous)
              const ok = !manques.length
              return (
                <button key={clePeriode(p)} type="button" className={'ha-date-opt' + (on ? ' is-on' : '')}
                  onClick={() => setPeriodeSel(p)}>
                  <div className="ha-date-opt-titre">{fmtPeriodeCourt(p)}</div>
                  <div className={'ha-date-opt-meta' + (ok ? ' is-ok' : ' is-no')}>
                    {ok ? 'équipage possible ce jour-là' : (phraseIlManque(manques) || 'personne disponible')}
                  </div>
                  {!!noms.length && (
                    <div className="ha-date-opt-noms">
                      {noms.map(n => n.txt).join(' · ')}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize:13, color:'var(--text-2)' }}>
            Pour le {fmtPeriode(periodeSel) || 'jour choisi'} : {libres.length === 0
              ? 'personne n’est disponible et libre.'
              : `${libres.length} volontaire${libres.length>1?'s':''} disponible${libres.length>1?'s':''}.`}
          </div>
        </div>
      )}
      {dates.d0 && !alternatives && (
        <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:12 }}>
          Période : <strong>{periode}</strong>
          {libres.length === 0
            ? ' — personne n’est entièrement disponible et libre.'
            : ` — ${libres.length} volontaire${libres.length>1?'s':''} disponible${libres.length>1?'s':''}.`}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, gap:10, flexWrap:'wrap' }}>
        <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Un vecteur = un véhicule et son équipage. Cochez les qualifications sur chaque véhicule — vous pouvez demander 1 ou 2 ambulanciers. Les personnes affectées voient la mission dans Mes missions. Le rôle (infi / ambulancier) se pose tout seul selon le besoin de ce vecteur.</div>
        {!lecture && <Btn onClick={ajouterVecteur}>+ Vecteur</Btn>}
      </div>

      {vecteurs.length === 0 && <div style={{ fontSize:13.5, color:'var(--text-muted)' }}>Aucun vecteur. Ajoutez-en un pour constituer l'équipage.</div>}

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {vecteurs.map((v, i) => {
          const membres = equipe.filter(e => e.vecteur_id === v.id)
          const rolesAffiches = Array.isArray(v.roles_requis) ? v.roles_requis : (m.roles_requis || [])
          const requisEffectifsV = rolesRequisVecteur(v, m.roles_requis)
          const rolesDejaV = membres.map(e => e.role_mission).filter(Boolean)
          const personnes = membres.map(e => {
            const p = pool.find(x => x.user_id === e.user_id)
            return { quals: p?.quals || qualsImplicites(e.profiles?.role, e.profiles?.fiche) }
          })
          const phraseManque = phraseIlManque(rolesEncoreManquants(requisEffectifsV, personnes))
          const remaining = rolesEncoreManquants(requisEffectifsV, personnes)
          return (
            <div key={v.id} style={{ border:'1.5px solid var(--border)', borderRadius:14, padding:'14px 16px', background:'var(--card)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontWeight:700, color:'var(--heading)' }}>🚐 Vecteur {i+1}{v.nom?` — ${v.nom}`:''}</div>
                {!lecture && <Btn kind="danger" onClick={()=>retirerVecteur(v.id)} style={{ padding:'4px 10px' }}>Retirer</Btn>}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'0 14px' }}>
                <F label="Nom / identifiant" value={v.nom} set={val=>majVecteur(v.id,{nom:val})} placeholder="Ambulance 1" readOnly={lecture} />
                <Sel label="Type de transport" value={v.type_transport} set={val=>majVecteur(v.id,{type_transport:val})} options={TYPES.map(t=>({v:t,l:t||'—'}))} disabled={lecture} />
                <F label="Plaque" value={v.plaque} set={val=>majVecteur(v.id,{plaque:val})} readOnly={lecture} />
              </div>

              <CardRoles roles={rolesAffiches} onToggle={role => toggleRoleVecteur(v.id, role)} onCount={(role, n) => setRoleCountVecteur(v.id, role, n)} compact lecture={lecture} />

              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>Équipage</div>
                {!lecture && <AjoutMembre pool={pool} dejaIds={dejaIds} requis={requisEffectifsV} remaining={remaining} rolesDeja={rolesDejaV}
                  phraseManque={phraseManque} onAdd={u => affecter(v.id, u)}
                  periodeSel={periodeSel} alternatives={alternatives} />}
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
                  {membres.filter(e => e.user_id && (e.profiles?.prenom || e.profiles?.nom)).map(e => {
                    const info = pool.find(p => p.user_id === e.user_id)
                    const teinte = teinteDepuisQuals(info?.quals || qualsImplicites(e.profiles?.role, e.profiles?.fiche))
                    const st = statutSur(info, periodeSel)
                    const conf = conflitSur(info, periodeSel)
                    const dispoTxt = libelleDispoMembre(info, dates.periodes, periodeSel, alternatives)
                    return (
                      <div key={e.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, fontSize:13.5, background:'var(--bg-alt)', borderRadius:8, padding:'6px 10px' }}>
                        <span>
                          {e.profiles?.prenom} {e.profiles?.nom}
                          {e.role_mission && <span style={{ color:'var(--text-muted)' }}> — {lblRoleMission(e.role_mission) || e.role_mission}</span>}
                          {dispoTxt && <span style={{ fontSize:11.5, color: st === 'plein' ? '#3B6D11' : '#C62828', marginLeft:8 }}>{dispoTxt}</span>}
                          {conf && <span style={{ fontSize:11.5, color:'#C62828', marginLeft:6 }}>autre mission</span>}
                        </span>
                        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <i className={'ha-cal-dot ' + (teinte === 'dual' ? 'dual' : teinte === 'infi' ? 'infi' : teinte === 'ambu' ? 'ambu' : 'nonmed')} />
                          {!lecture && <button type="button" onClick={()=>retirerMembre(e.id)} style={{ background:'none', border:'none', color:'#C8435A', cursor:'pointer' }}>✕</button>}
                        </span>
                      </div>
                    )
                  })}
                  {membres.filter(e => e.user_id && (e.profiles?.prenom || e.profiles?.nom)).length === 0 && (
                    phraseManque
                      ? <div style={{ fontSize:12.5, color:'#C62828' }}>{phraseManque}</div>
                      : <div style={{ fontSize:12.5, color:'var(--text-faint)' }}>Aucun équipier.</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function asQuals(q) {
  if (Array.isArray(q)) return q
  if (typeof q === 'string') {
    try { const p = JSON.parse(q); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

function statutSur(p, periode) {
  if (!p) return 'non'
  if (!periode?.debut) return p.dispo || 'non'
  return p.parPeriode?.[clePeriode(periode)] || 'non'
}

function conflitSur(p, periode) {
  if (!p) return false
  if (!periode?.debut) return !!p.conflit
  if (p.conflitPrecis) return !!p.conflitPeriode?.[clePeriode(periode)]
  return !!p.conflit
}

function rolesTousVecteurs(m) {
  const vs = m?.vecteurs || []
  if (!vs.length) return rolesRequisEffectifs(m?.roles_requis)
  return vs.flatMap(v => rolesRequisVecteur(v, m?.roles_requis))
}

function manquesSurPeriode(m, equipe, pool, periode) {
  const extras = []
  const equipeOk = (equipe || []).filter(e => statutSur(pool.find(p => p.user_id === e.user_id), periode) === 'plein')
  for (const p of pool || []) {
    if (statutSur(p, periode) !== 'plein') continue
    if (conflitSur(p, periode)) continue
    extras.push({ user_id: p.user_id, quals: p.quals })
  }
  const cov = couvertureMission(m || {}, equipeOk, extras)
  return rolesManquantsMultiset(cov.requis, cov.couverts)
}

function nomsDispoPeriode(pool, periode, requis) {
  const need = rolesRequisEffectifs(requis)
  const out = []
  for (const p of pool || []) {
    if (statutSur(p, periode) !== 'plein') continue
    if (need.length && !(p.quals || []).some(q => need.includes(q))) continue
    const role = roleSuggere(p.quals || [], need, [])
    const tag = conflitSur(p, periode) ? ' (autre mission)' : ''
    out.push({
      id: p.user_id,
      txt: `${p.prenom} ${p.nom}${role ? ' · ' + lblRoleMission(role) : ''}${tag}`,
    })
  }
  return out
}

function meilleurePeriode(periodes, pool) {
  if (!periodes?.length) return null
  let best = periodes[0]
  let score = -1
  for (const p of periodes) {
    const n = (pool || []).filter(x => statutSur(x, p) === 'plein' && !conflitSur(x, p)).length
    if (n > score) { score = n; best = p }
  }
  return best
}

function libelleDispoMembre(p, periodes, periodeSel, alternatives) {
  if (!p) return ''
  if (periodeSel) {
    const st = statutSur(p, periodeSel)
    if (st === 'plein') return 'disponible'
    if (st === 'partiel') return 'dispo. partielle'
    if (st === 'non') return 'pas de dispo ce jour'
    return ''
  }
  if (alternatives && periodes?.length) {
    const ok = periodes.filter(per => statutSur(p, per) === 'plein')
    if (ok.length === periodes.length) return 'disponible'
    if (ok.length) return 'dispo ' + ok.map(fmtPeriodeCourt).join(', ')
    if (periodes.some(per => statutSur(p, per) === 'partiel')) return 'dispo. partielle'
    return 'pas de dispo'
  }
  if (p.dispo === 'plein') return 'disponible'
  if (p.dispo === 'partiel') return 'dispo. partielle'
  if (p.dispo === 'non') return 'pas de dispo'
  return ''
}

function normaliserPool(data) {
  if (data == null) return []
  let v = data
  if (typeof v === 'string') {
    try { v = JSON.parse(v) } catch { return [] }
  }
  if (Array.isArray(v)) {
    if (v.length && Array.isArray(v[0])) return v.flat().filter(x => x && x.user_id)
    const wrapped = v[0] && v[0].personnel_disponible_souhait
    if (Array.isArray(wrapped)) return v.flatMap(x => x.personnel_disponible_souhait || [])
    return v.filter(x => x && x.user_id)
  }
  if (Array.isArray(v.personnel_disponible_souhait)) return v.personnel_disponible_souhait
  return []
}

function joursCouverts(d0, d1) {
  const out = []
  if (!d0) return out
  let d = d0
  const fin = d1 || d0
  while (d <= fin) {
    out.push(d)
    const t = new Date(d + 'T12:00:00')
    t.setDate(t.getDate() + 1)
    const y = t.getFullYear(), m = String(t.getMonth() + 1).padStart(2, '0'), day = String(t.getDate()).padStart(2, '0')
    d = `${y}-${m}-${day}`
  }
  return out
}

function statutDispo(disposUser, jours) {
  if (!jours?.length) return 'inconnu'
  const need = new Set(jours)
  const covered = new Set()
  for (const dis of disposUser) {
    for (const j of joursCouverts(dis.date_debut, dis.date_fin)) {
      if (need.has(j)) covered.add(j)
    }
  }
  if (covered.size >= need.size) return 'plein'
  if (covered.size > 0) return 'partiel'
  return 'non'
}

async function poolDepuisProfils(jours, d0, d1) {
  const [{ data: profils }, { data: dispos }] = await Promise.all([
    supabase.from('profiles').select('id,prenom,nom,role,fiche').neq('role', 'partenaire').eq('actif', true).order('nom'),
    d0
      ? supabase.from('disponibilites').select('user_id,date_debut,date_fin').lte('date_debut', d1).gte('date_fin', d0)
      : Promise.resolve({ data: [] }),
  ])
  const byUser = {}
  for (const d of dispos || []) (byUser[d.user_id] ||= []).push(d)
  return (profils || []).map(p => ({
    user_id: p.id,
    prenom: p.prenom,
    nom: p.nom,
    role: p.role,
    quals: qualsImplicites(p.role, p.fiche),
    dispo: statutDispo(byUser[p.id] || [], jours),
    conflit: false,
  }))
}

function AjoutMembre({ pool, dejaIds, requis, remaining, rolesDeja, phraseManque, onAdd, periodeSel, alternatives }) {
  const [u, setU] = useState('')
  const needAll = rolesRequisEffectifs(requis)
  const needNow = (remaining && remaining.length) ? remaining : needAll
  const matchNeed = p => (p.quals || []).some(q => needAll.includes(q))
  const candidats = pool.filter(p => !dejaIds.has(p.user_id) && matchNeed(p))
  const autres = pool.filter(p => !dejaIds.has(p.user_id) && !matchNeed(p))
  const st = p => statutSur(p, periodeSel)
  const conf = p => conflitSur(p, periodeSel)
  const libellePlein = alternatives && periodeSel
    ? `Disponibles le ${fmtPeriode(periodeSel)}`
    : 'Disponibles sur toute la période'
  const groupes = [
    { k:'plein', l: libellePlein, items: candidats.filter(p => st(p) === 'plein' && !conf(p)) },
    { k:'autre-jour', l:'Disponibles un autre jour', items: alternatives ? candidats.filter(p => st(p) !== 'plein' && p.dispo === 'plein' && !conf(p)) : [] },
    { k:'partiel', l:'Disponibilité partielle', items: candidats.filter(p => st(p) === 'partiel' && !conf(p)) },
    { k:'conflit', l: alternatives && periodeSel ? `Déjà sur une autre mission le ${fmtPeriode(periodeSel)}` : 'Déjà sur une autre mission', items: candidats.filter(p => conf(p)) },
    { k:'non', l:'Pas de disponibilité indiquée', items: candidats.filter(p => st(p) === 'non' && !conf(p) && p.dispo !== 'plein') },
    { k:'inconnu', l:'Autres volontaires', items: candidats.filter(p => st(p) === 'inconnu' && !conf(p)) },
  ]
  const places = new Set(groupes.flatMap(g => g.items.map(p => p.user_id)))
  const rest = candidats.filter(p => !places.has(p.user_id))
  if (rest.length) groupes.push({ k:'autre', l:'Autres volontaires', items: rest })
  if (autres.length) groupes.push({ k:'hors-qual', l:'Autres (qualification différente)', items: autres })
  const groupesVisibles = groupes.filter(g => g.items.length > 0)
  const rapides = (groupes.find(g => g.k === 'plein')?.items || []).filter(p => {
    const q = p.quals || []
    return needNow.some(r => q.includes(r))
  })

  return (
    <div>
      {rapides.length > 0 && (
        <div className="ha-aff-rapides">
          {rapides.map(p => {
            const teinte = teinteDepuisQuals(p.quals)
            const role = roleSuggere(p.quals, needNow, rolesDeja)
            const quals = (p.quals || []).map(lblRoleMission).join(' · ')
            return (
              <button key={p.user_id} type="button" className={'ha-aff-p dispo-' + teinte}
                onClick={() => onAdd(p.user_id)}
                title={quals}>
                {p.prenom} {p.nom}{role ? ` · ${lblRoleMission(role)}` : ''}
              </button>
            )
          })}
        </div>
      )}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ flex:1, minWidth:180 }}>
          <label style={lbl}>{phraseManque || 'Autre volontaire'}</label>
          <select value={u} onChange={e=>setU(e.target.value)} style={inp}>
            <option value="">— Choisir —</option>
            {groupesVisibles.map(g => (
              <optgroup key={g.k} label={g.l}>
                {g.items.map(p => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.prenom} {p.nom}{(p.quals||[]).length ? ` · ${(p.quals).map(lblRoleMission).join(', ')}` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <Btn kind="soft" onClick={()=>{ if (u) { onAdd(u); setU('') } }}>+ Ajouter</Btn>
      </div>
    </div>
  )
}

function CardRoles({ roles, onToggle, onCount, compact, lecture }) {
  const nAmbu = countRole(roles, 'ambulancier')
  return (
    <div style={{
      border: compact ? '1px solid var(--border)' : '1.5px solid var(--border)',
      borderRadius: compact ? 10 : 14,
      padding: compact ? '10px 12px' : '14px 16px',
      background: compact ? 'var(--bg-alt)' : 'var(--card)',
      marginTop: compact ? 12 : 0,
      marginBottom: compact ? 0 : 16,
    }}>
      <div style={{ fontWeight:700, color:'var(--heading)', marginBottom:6, fontSize: compact ? 13 : undefined }}>Équipage requis</div>
      <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:10 }}>
        {compact
          ? 'Cochez les qualifications de ce véhicule. Pour les ambulanciers, choisissez 1 ou 2. Rien de coché = un ambulancier et un infirmier. Un infi+ambu n’occupe qu’un côté (celui où il manque le plus de monde).'
          : 'Cochez les qualifications nécessaires. Pour les ambulanciers, choisissez 1 ou 2. Rien de coché = un ambulancier et un infirmier. Si seul chauffeur est coché, on ne rajoute pas le défaut. Un infi+ambu n’occupe qu’un côté (celui où il manque le plus de monde).'}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
        {ROLES_MISSION.map(o => {
          if (o.v === 'ambulancier') {
            const on = nAmbu > 0
            return (
              <span key={o.v} className="ha-role-ambu">
                <button type="button" onClick={() => { if (!lecture) onToggle(o.v) }}
                  style={{ padding:'7px 12px', borderRadius:99, border:`1.5px solid ${on?'var(--accent)':'var(--border)'}`, background:on?'var(--accent)':'var(--card)', color:on?'#fff':'var(--text-2)', fontSize:13, fontWeight:600, cursor: lecture ? 'default' : 'pointer' }}>
                  {on ? '✓ ' : ''}{o.l}{nAmbu > 1 ? ' ×2' : ''}
                </button>
                {on && onCount && !lecture && [1, 2].map(n => (
                  <button key={n} type="button" className={'ha-role-n' + (nAmbu === n ? ' is-on' : '')}
                    onClick={e => { e.stopPropagation(); onCount('ambulancier', n) }}
                    aria-label={`${n} ambulancier${n > 1 ? 's' : ''}`}>
                    {n}
                  </button>
                ))}
              </span>
            )
          }
          const on = roles.includes(o.v)
          return (
            <button key={o.v} type="button" onClick={() => { if (!lecture) onToggle(o.v) }}
              style={{ padding:'7px 12px', borderRadius:99, border:`1.5px solid ${on?'var(--accent)':'var(--border)'}`, background:on?'var(--accent)':'var(--card)', color:on?'#fff':'var(--text-2)', fontSize:13, fontWeight:600, cursor: lecture ? 'default' : 'pointer' }}>
              {on ? '✓ ' : ''}{o.l}
            </button>
          )
        })}
      </div>
      {roles.length === 0 && (
        <div style={{ fontSize:12.5, color:'var(--text-2)', marginTop:10 }}>
          Rien n’est coché : l’équipage par défaut est un ambulancier et un infirmier.
        </div>
      )}
      {nAmbu === 2 && (
        <div style={{ fontSize:12.5, color:'var(--text-2)', marginTop:10 }}>
          Deux ambulanciers demandés{roles.includes('infirmier') ? ' (plus un infirmier).' : '.'}
        </div>
      )}
    </div>
  )
}
