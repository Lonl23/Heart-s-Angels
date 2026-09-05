import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, F, Sel, inp, lbl } from '@/components/ui'
import {
  ROLES_MISSION, lblRoleMission, teinteDepuisQuals, roleSuggere, qualsImplicites,
  rolesRequisEffectifs, rolesRequisVecteur, phraseIlManque, rolesEncoreManquants,
} from '@/modules/fiche/ficheSchema'
import { fmtDatesSouhait, joursDesPeriodes, periodesDepuisSouhait, plageGlobale } from './datesSouhait'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'v' + Date.now() + Math.random().toString(16).slice(2))
const TYPES = ['', 'Ambulance', 'VSL', 'Voiture', 'Autre']

export default function Vecteurs({ souhaitId, m, setM }) {
  const vecteurs = m.vecteurs || []
  const [equipe, setEquipe] = useState([])
  const [pool, setPool] = useState([])
  const [dates, setDates] = useState({ label: '', jours: [], d0: null, d1: null })

  useEffect(() => { charger() }, [souhaitId])

  async function charger() {
    const [{ data: sh }, { data: eq }, rpc] = await Promise.all([
      supabase.from('souhaits').select('date_souhaitee,date_fin,dates_possibles').eq('id', souhaitId).single(),
      supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role,fiche)').eq('souhait_id', souhaitId),
      supabase.rpc('personnel_disponible_souhait', { p_souhait: souhaitId }),
    ])
    const periodes = periodesDepuisSouhait(sh)
    const plage = plageGlobale(periodes)
    const jours = joursDesPeriodes(periodes)
    setDates({
      label: fmtDatesSouhait(sh),
      jours,
      d0: plage.date_souhaitee,
      d1: plage.date_fin,
    })
    setEquipe(eq || [])
    let pers = normaliserPool(rpc.data)
    if (!pers.length) pers = await poolDepuisProfils(jours, plage.date_souhaitee, plage.date_fin)
    setPool(pers.map(p => ({ ...p, quals: asQuals(p.quals) })))
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
    if (p?.dispo === 'non') {
      if (!confirm('Cette personne n’a pas indiqué de disponibilité sur ces dates. L’affecter quand même ?')) return
    } else if (p?.dispo === 'partiel') {
      if (!confirm('Disponibilité partielle sur la période. L’affecter quand même ?')) return
    }
    if (p?.conflit) {
      if (!confirm('Déjà affectée à une autre mission sur ces dates. L’affecter quand même ?')) return
    }
    await flushMission()
    const v = (m.vecteurs||[]).find(x => x.id === vid)
    const requisV = rolesRequisVecteur(v, m.roles_requis)
    const rolesDejaV = equipe.filter(e => e.vecteur_id === vid).map(e => e.role_mission).filter(Boolean)
    const role = roleSuggere(p?.quals || [], requisV, rolesDejaV)
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
        return { ...v, roles_requis: cur.includes(role) ? cur.filter(x => x !== role) : [...cur, role] }
      }),
    }))
  }

  const libres = pool.filter(p => !dejaIds.has(p.user_id) && p.dispo === 'plein' && !p.conflit)
  const periode = dates.label && dates.label !== 'Date à définir' ? dates.label : null

  return (
    <div>
      {!dates.d0 && (
        <div className="ha-flash ha-flash-warn" style={{ marginBottom:14 }}>Indiquez les dates du souhait (fiche bénéficiaire) pour croiser avec les disponibilités.</div>
      )}
      {dates.d0 && (
        <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:12 }}>
          Période : <strong>{periode}</strong>
          {libres.length === 0
            ? ' — personne n’est entièrement disponible et libre.'
            : ` — ${libres.length} volontaire${libres.length>1?'s':''} disponible${libres.length>1?'s':''}.`}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, gap:10, flexWrap:'wrap' }}>
        <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Un vecteur = un véhicule et son équipage. Cochez les qualifications sur chaque véhicule. Les personnes affectées voient la mission dans Mes missions. Le rôle (infi / ambulancier) se pose tout seul selon le besoin de ce vecteur.</div>
        <Btn onClick={ajouterVecteur}>+ Vecteur</Btn>
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
          return (
            <div key={v.id} style={{ border:'1.5px solid var(--border)', borderRadius:14, padding:'14px 16px', background:'var(--card)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontWeight:700, color:'var(--heading)' }}>🚐 Vecteur {i+1}{v.nom?` — ${v.nom}`:''}</div>
                <Btn kind="danger" onClick={()=>retirerVecteur(v.id)} style={{ padding:'4px 10px' }}>Retirer</Btn>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'0 14px' }}>
                <F label="Nom / identifiant" value={v.nom} set={val=>majVecteur(v.id,{nom:val})} placeholder="Ambulance 1" />
                <Sel label="Type de transport" value={v.type_transport} set={val=>majVecteur(v.id,{type_transport:val})} options={TYPES.map(t=>({v:t,l:t||'—'}))} />
                <F label="Plaque" value={v.plaque} set={val=>majVecteur(v.id,{plaque:val})} />
              </div>

              <CardRoles roles={rolesAffiches} onToggle={role => toggleRoleVecteur(v.id, role)} compact />

              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>Équipage</div>
                <AjoutMembre pool={pool} dejaIds={dejaIds} requis={requisEffectifsV} rolesDeja={rolesDejaV}
                  phraseManque={phraseManque} onAdd={u => affecter(v.id, u)} />
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
                  {membres.filter(e => e.user_id && (e.profiles?.prenom || e.profiles?.nom)).map(e => {
                    const info = pool.find(p => p.user_id === e.user_id)
                    const teinte = teinteDepuisQuals(info?.quals || qualsImplicites(e.profiles?.role, e.profiles?.fiche))
                    const dispoTxt = info?.dispo === 'plein' ? 'disponible' : info?.dispo === 'partiel' ? 'dispo. partielle' : info?.dispo === 'non' ? 'pas de dispo' : ''
                    return (
                      <div key={e.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, fontSize:13.5, background:'var(--bg-alt)', borderRadius:8, padding:'6px 10px' }}>
                        <span>
                          {e.profiles?.prenom} {e.profiles?.nom}
                          {e.role_mission && <span style={{ color:'var(--text-muted)' }}> — {lblRoleMission(e.role_mission) || e.role_mission}</span>}
                          {dispoTxt && <span style={{ fontSize:11.5, color: info?.dispo === 'plein' ? '#3B6D11' : '#C62828', marginLeft:8 }}>{dispoTxt}</span>}
                          {info?.conflit && <span style={{ fontSize:11.5, color:'#C62828', marginLeft:6 }}>autre mission</span>}
                        </span>
                        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <i className={'ha-cal-dot ' + (teinte === 'dual' ? 'dual' : teinte === 'infi' ? 'infi' : teinte === 'ambu' ? 'ambu' : 'nonmed')} />
                          <button type="button" onClick={()=>retirerMembre(e.id)} style={{ background:'none', border:'none', color:'#C8435A', cursor:'pointer' }}>✕</button>
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

function AjoutMembre({ pool, dejaIds, requis, rolesDeja, phraseManque, onAdd }) {
  const [u, setU] = useState('')
  const need = rolesRequisEffectifs(requis)
  const matchNeed = p => (p.quals || []).some(q => need.includes(q))
  const candidats = pool.filter(p => !dejaIds.has(p.user_id) && matchNeed(p))
  const autres = pool.filter(p => !dejaIds.has(p.user_id) && !matchNeed(p))
  const groupes = [
    { k:'plein', l:'Disponibles sur toute la période', items: candidats.filter(p => p.dispo === 'plein' && !p.conflit) },
    { k:'partiel', l:'Disponibilité partielle', items: candidats.filter(p => p.dispo === 'partiel' && !p.conflit) },
    { k:'conflit', l:'Déjà sur une autre mission', items: candidats.filter(p => p.conflit) },
    { k:'non', l:'Pas de disponibilité indiquée', items: candidats.filter(p => p.dispo === 'non' && !p.conflit) },
    { k:'inconnu', l:'Autres volontaires', items: candidats.filter(p => p.dispo === 'inconnu' && !p.conflit) },
  ]
  const places = new Set(groupes.flatMap(g => g.items.map(p => p.user_id)))
  const rest = candidats.filter(p => !places.has(p.user_id))
  if (rest.length) groupes.push({ k:'autre', l:'Autres volontaires', items: rest })
  if (autres.length) groupes.push({ k:'hors-qual', l:'Autres (qualification différente)', items: autres })
  const groupesVisibles = groupes.filter(g => g.items.length > 0)
  const rapides = (groupes.find(g => g.k === 'plein')?.items || []).filter(p => {
    const q = p.quals || []
    return need.some(r => q.includes(r))
  })

  return (
    <div>
      {rapides.length > 0 && (
        <div className="ha-aff-rapides">
          {rapides.map(p => {
            const teinte = teinteDepuisQuals(p.quals)
            const role = roleSuggere(p.quals, need, rolesDeja)
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

function CardRoles({ roles, onToggle, compact }) {
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
          ? 'Cochez les qualifications de ce véhicule. Rien de coché = un ambulancier et un infirmier. Un infi+ambu n’occupe qu’un côté (celui où il manque le plus de monde).'
          : 'Cochez les qualifications nécessaires. Rien de coché = un ambulancier et un infirmier. Si seul chauffeur est coché, on ne rajoute pas le défaut. Un ambulancier avec permis et sélection médicale couvre aussi chauffeur. Un infi+ambu n’occupe qu’un côté (celui où il manque le plus de monde).'}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {ROLES_MISSION.map(o => {
          const on = roles.includes(o.v)
          return (
            <button key={o.v} type="button" onClick={() => onToggle(o.v)}
              style={{ padding:'7px 12px', borderRadius:99, border:`1.5px solid ${on?'var(--accent)':'var(--border)'}`, background:on?'var(--accent)':'var(--card)', color:on?'#fff':'var(--text-2)', fontSize:13, fontWeight:600 }}>
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
    </div>
  )
}
