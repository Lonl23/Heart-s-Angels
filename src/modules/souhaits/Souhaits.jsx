import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, Pill, Tabs, Empty, Loading, Flash, TA } from '@/components/ui'
import FormSouhait from './FormSouhait'
import DetailSouhait from './DetailSouhait'
import { fmtDatesSouhait } from './datesSouhait'
import { upsertBeneficiaire, upsertContactRattache } from '@/modules/annuaire/annuaireApi'
import {
  STATUTS, PIPELINE, PIPELINE_ENCODE, ATTENTE_RAISONS, DEMANDE_STATUTS,
  stInfo, peutPasserNonRealise, peutChangerStatut, statutFige,
} from './statuts'

export {
  STATUTS, PIPELINE, PIPELINE_ENCODE, ATTENTE_RAISONS, DEMANDE_STATUTS,
  stInfo, peutPasserNonRealise, statutFige, peutChangerStatut,
}
export { statutsDisponibles } from './statuts'

export default function Souhaits() {
  const nav = useNavigate()
  const { id } = useParams()
  const loc = useLocation()
  const [tab, setTab] = useState('souhaits')
  const [nbDemandes, setNbDemandes] = useState(0)
  const nouveau = loc.pathname.endsWith('/nouveau')
  const preparer = loc.pathname.endsWith('/preparer')

  function ouvrirSouhait(s) {
    const id = typeof s === 'string' ? s : s?.id
    const statut = typeof s === 'string' ? null : s?.statut
    if (!id) return
    if (statut === 'realise') nav(`/app/souhaits/${id}`)
    else nav(`/app/souhaits/${id}/preparer`)
  }

  useEffect(() => {
    supabase.from('demandes_souhaits').select('id', { count:'exact', head:true }).in('statut', ['nouvelle','en_cours'])
      .then(({ count }) => setNbDemandes(count || 0))
  }, [id, nouveau, tab, loc.pathname])

  if (nouveau) return (
    <FormSouhait onDone={(nid) => {
      if (typeof nid === 'string') nav(`/app/souhaits/${nid}/preparer`)
      else nav('/app/souhaits')
    }} />
  )
  if (id) return (
    <DetailSouhait id={id} preparer={preparer}
      onBack={() => nav('/app/souhaits')}
      onPreparer={() => nav(`/app/souhaits/${id}/preparer`)}
      onVoir={() => nav(`/app/souhaits/${id}`)}
    />
  )

  return (
    <Page title="Souhaits" subtitle="Encodez les dossiers ici. Le terrain (checklists, MAR, démarrer / terminer) se fait dans Mes missions."
      action={tab==='souhaits' ? <Btn onClick={()=>nav('/app/souhaits/nouveau')}>+ Nouveau souhait</Btn> : null}>
      <Tabs value={tab} onChange={setTab} items={[
        { v:'souhaits', l:'Tableau des souhaits' },
        { v:'demandes', l:'Demandes reçues', badge: nbDemandes },
      ]} />
      {tab === 'souhaits' ? <Kanban onOpen={ouvrirSouhait} /> : <Demandes onOpen={sid => nav(`/app/souhaits/${sid}/preparer`)} />}
    </Page>
  )
}

function hitCol(x, y) {
  const els = document.elementsFromPoint?.(x, y) || [document.elementFromPoint(x, y)].filter(Boolean)
  for (const el of els) {
    if (el?.closest?.('.ha-kanban-ghost')) continue
    const col = el?.closest?.('[data-col]')?.getAttribute('data-col')
    if (col) return col
  }
  return null
}

function Kanban({ onOpen }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [over, setOver] = useState(null)
  const [drag, setDrag] = useState(null)       // { id, x, y, w, ox, oy }
  const [msg, setMsg] = useState(null)
  const [motif, setMotif] = useState(null)     // { id, from }
  const [motifTxt, setMotifTxt] = useState('')
  const origin = useRef(null)
  const itemsRef = useRef([])
  const onOpenRef = useRef(onOpen)
  itemsRef.current = items
  onOpenRef.current = onOpen

  useEffect(() => { (async () => {
    const { data } = await supabase.from('souhaits').select('*').order('date_souhaitee', { ascending:true, nullsFirst:false })
    setItems(data || []); setLoading(false)
  })() }, [])

  function flash(t, kind='ok') { setMsg({ t, kind }); setTimeout(()=>setMsg(null), 3200) }
  const flashRef = useRef(flash)
  flashRef.current = flash

  async function appliquer(id, col, extra={}) {
    const item = itemsRef.current.find(s => s.id === id)
    if (!item || item.statut === col) return
    if (!peutChangerStatut(item.statut, col)) {
      if (statutFige(item.statut)) flash('Un souhait réalisé ne peut plus changer de statut.', 'warn')
      else if (col === 'non_realise') flash('Une fois en cours, le souhait ne peut plus passer en non réalisé.', 'warn')
      return
    }
    const patch = { statut: col, ...extra }
    if (col === 'realise' && !item.date_realisee) patch.date_realisee = new Date().toISOString().slice(0,10)
    setItems(list => list.map(s => s.id === id ? { ...s, ...patch } : s))
    const { error } = await supabase.from('souhaits').update(patch).eq('id', id)
    if (error) {
      setItems(list => list.map(s => s.id === id ? item : s))
      flash(error.message, 'err')
    } else {
      flash(`Statut : ${stInfo(col).l}`)
    }
  }
  const appliquerRef = useRef(appliquer)
  appliquerRef.current = appliquer

  function deposer(s, col) {
    const item = typeof s === 'string' ? itemsRef.current.find(x => x.id === s) : s
    if (!item || !col || item.statut === col) return
    if (!peutChangerStatut(item.statut, col)) {
      if (statutFige(item.statut)) flash('Un souhait réalisé ne peut plus changer de statut.', 'warn')
      else if (col === 'non_realise') flash('Une fois en cours, le souhait ne peut plus passer en non réalisé.', 'warn')
      return
    }
    if (col === 'non_realise') {
      setMotif({ id: item.id, from: item.statut })
      setMotifTxt(item.mission?.motif_non_realise || '')
      return
    }
    appliquer(item.id, col)
  }
  const deposerRef = useRef(deposer)
  deposerRef.current = deposer

  function onPointerDown(e, s) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target?.closest?.('a,button')) return
    const r = e.currentTarget.getBoundingClientRect()
    origin.current = {
      s, x: e.clientX, y: e.clientY, r,
      started: false,
      touch: e.pointerType === 'touch',
      el: e.currentTarget, pid: e.pointerId,
    }
    if (e.pointerType !== 'touch') {
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* */ }
    }
  }

  useEffect(() => {
    function onMove(e) {
      const o = origin.current
      if (!o || o.touch) return
      const dist = Math.hypot(e.clientX - o.x, e.clientY - o.y)
      if (!o.started && dist < 8) return
      if (statutFige(o.s.statut)) {
        if (!o.started) {
          o.started = true
          flashRef.current('Un souhait réalisé ne peut plus changer de statut.', 'warn')
        }
        return
      }
      if (!o.started) {
        o.started = true
        try { o.el.setPointerCapture(o.pid) } catch { /* */ }
      }
      if (e.cancelable) e.preventDefault()
      setDrag({ id: o.s.id, x: e.clientX, y: e.clientY, w: o.r.width, ox: o.x - o.r.left, oy: o.y - o.r.top })
      setOver(hitCol(e.clientX, e.clientY))
    }
    function onUp(e) {
      const o = origin.current
      if (!o) return
      origin.current = null
      try { o.el.releasePointerCapture?.(o.pid) } catch { /* */ }
      const started = o.started
      const col = started ? hitCol(e.clientX, e.clientY) : null
      setDrag(null)
      setOver(null)
      if (started) {
        if (col && col !== o.s.statut) deposerRef.current(o.s, col)
        return
      }
      if (e.type === 'pointercancel') return
      if (e.target?.closest?.('a,button')) return
      if (!o.touch) onOpenRef.current(o.s)
    }
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
    return () => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
    }
  }, [])

  async function confirmerMotif() {
    const t = motifTxt.trim()
    if (!t) { flash('Indiquez le motif de non-réalisation.', 'warn'); return }
    const id = motif.id
    const item = items.find(s => s.id === id)
    setMotif(null)
    await appliquer(id, 'non_realise', { mission: { ...(item?.mission || {}), motif_non_realise: t } })
  }

  if (loading) return <Loading />
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? items.filter(s => `${s.beneficiaire_prenom} ${s.beneficiaire_nom} ${s.description||''} ${s.localisation||''}`.toLowerCase().includes(needle))
    : items
  const autres = filtered.filter(s => !PIPELINE.includes(s.statut))
  const ghost = drag && items.find(s => s.id === drag.id)

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:12, marginBottom:14 }}>
        <input className="ha-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un bénéficiaire, un lieu…" />
        <span style={{ fontSize:12.5, color:'var(--text-muted)' }}>Sur téléphone, touchez le bouton sous la carte. Sur ordinateur, glissez la carte pour changer le statut ; un clic (sans glisser) ouvre le dossier. Un souhait réalisé ne se déplace plus.</span>
      </div>
      {msg && <Flash kind={msg.kind}>{msg.t}</Flash>}
      {motif && (
        <Card style={{ marginBottom:14 }}>
          <div style={{ fontWeight:600, color:'var(--heading)', marginBottom:8 }}>Motif de non-réalisation</div>
          <TA label="Pourquoi ce souhait ne sera pas réalisé ?" value={motifTxt} set={setMotifTxt} rows={3} placeholder="Ex. : état de santé, date impossible, souhait retiré…" />
          <div style={{ display:'flex', gap:8 }}>
            <Btn kind="danger" onClick={confirmerMotif}>Confirmer non réalisé</Btn>
            <Btn kind="soft" onClick={()=>setMotif(null)}>Annuler</Btn>
          </div>
        </Card>
      )}
      {items.length === 0 && (
        <Empty title="Aucun souhait pour l'instant" hint="Acceptez une demande reçue, ou créez un souhait avec le bouton ci-dessus." />
      )}
      {items.length > 0 && filtered.length === 0 && (
        <Empty title="Aucun résultat" hint="Essayez un autre mot, ou effacez la recherche." />
      )}
      {filtered.length > 0 && (
        <div className="ha-kanban-board">
          {PIPELINE.map(col => {
            const st = stInfo(col)
            const list = filtered.filter(s => s.statut === col)
            return (
              <div key={col} data-col={col} style={{ minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ width:10, height:10, borderRadius:99, background:st.c }} />
                  <span style={{ fontWeight:600, color:'var(--text)', fontSize:13.5 }}>{st.l}</span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{list.length}</span>
                </div>
                <div className={'ha-kanban-drop' + (over===col ? ' is-over' : '')}>
                  {list.map(s => (
                    <CarteSouhait key={s.id} s={s} dragging={drag?.id===s.id}
                      onPointerDown={e=>onPointerDown(e,s)}
                      onOuvrir={() => onOpen(s)} />
                  ))}
                  {list.length === 0 && <div style={{ fontSize:12.5, color:'var(--text-faint)', padding:'10px 6px' }}>Déposez ici</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {filtered.length > 0 && (
        <div data-col="non_realise" style={{ marginTop:16 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-muted)', marginBottom:8 }}>Non réalisés</div>
          <div className={'ha-kanban-drop' + (over==='non_realise' ? ' is-over' : '')} style={{ minHeight: autres.length ? 48 : 72 }}>
            {autres.map(s => (
              <CarteSouhait key={s.id} s={s} dragging={drag?.id===s.id}
                onPointerDown={e=>onPointerDown(e,s)}
                onOuvrir={() => onOpen(s)} />
            ))}
            {autres.length === 0 && <div style={{ fontSize:12.5, color:'var(--text-faint)', padding:'10px 6px' }}>Déposez ici pour marquer non réalisé</div>}
          </div>
        </div>
      )}
      {ghost && (
        <div className="ha-kanban-ghost" style={{ left: drag.x - drag.ox, top: drag.y - drag.oy, width: drag.w }}>
          <CarteSouhait s={ghost} />
        </div>
      )}
    </div>
  )
}

function CarteSouhait({ s, dragging, onPointerDown, onOuvrir }) {
  return (
    <Card clickable className={'ha-kanban-card' + (dragging ? ' is-origin' : '') + (statutFige(s.statut) ? ' is-locked' : '')} style={{ padding:'12px 14px' }}
      onPointerDown={onPointerDown}
      title={s.statut === 'realise' ? 'Réalisé — le statut ne se change plus. Cliquez pour le rapport.' : 'Touchez le bouton. Sur ordinateur, glissez pour changer le statut.'}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:6, marginBottom:5 }}>
        <span style={{ fontWeight:600, color:'var(--text)', fontSize:13.5 }}>{s.beneficiaire_prenom} {s.beneficiaire_nom}</span>
        {s.priorite >= 4 && <Pill color="#A32D2D" bg="#FCEBEB">Priorité {s.priorite}</Pill>}
      </div>
      <div style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{s.description}</div>
      <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:6 }}>{fmtDatesSouhait(s)}</div>
      {s.statut==='en_attente' && s.mission?.attente && (
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:5 }}>
          {ATTENTE_RAISONS.filter(r=>s.mission.attente[r.v]).map(r=><span key={r.v} style={{ fontSize:10.5, background:'#FAEEDA', color:'#BA7517', borderRadius:6, padding:'1px 6px', fontWeight:600 }}>{r.l}</span>)}
        </div>
      )}
      {onOuvrir && (
        <button type="button" className="ha-kanban-open"
          onClick={e => { e.preventDefault(); e.stopPropagation(); onOuvrir() }}
          onPointerDown={e => e.stopPropagation()}
          onPointerUp={e => e.stopPropagation()}
          onPointerCancel={e => e.stopPropagation()}>
          {s.statut === 'realise' ? 'Rapport ›' : 'Préparer ›'}
        </button>
      )}
    </Card>
  )
}

function Demandes({ onOpen }) {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('demandes_souhaits').select('*').order('created_at', { ascending:false })
    setItems(data || []); setLoading(false)
  }
  async function refuser(d) { if (!confirm('Refuser cette demande ? Elle disparaîtra de la liste active.')) return; await supabase.from('demandes_souhaits').update({ statut:'refusee' }).eq('id', d.id); load() }
  async function accepter(d) {
    let annuaireId = null
    try {
      annuaireId = await upsertBeneficiaire({
        nom: d.patient_nom,
        prenom: d.patient_prenom,
        date_naissance: d.patient_ddn,
        genre: d.patient_genre,
        tel_gsm: d.patient_tel_gsm,
        tel_fixe: d.patient_tel_fixe,
        adresse: d.patient_adresse,
        telephone: d.patient_tel_gsm || d.patient_tel_fixe,
      }, { created_by: profile?.id })
      if (annuaireId && (d.contact_prenom || d.contact_nom)) {
        await upsertContactRattache(annuaireId, {
          prenom: d.contact_prenom,
          nom: d.contact_nom,
          lien: d.contact_relation,
          date_naissance: d.contact_ddn,
          tel_gsm: d.contact_telephone,
          tel_fixe: d.contact_tel_fixe,
          adresse: d.contact_adresse,
          email: d.contact_email,
        }, { created_by: profile?.id })
      }
    } catch (e) {
      alert('Annuaire : ' + (e.message || e))
      return
    }
    const { data: s, error } = await supabase.from('souhaits').insert({
      beneficiaire_nom: d.patient_nom, beneficiaire_prenom: d.patient_prenom, beneficiaire_ddn: d.patient_ddn || null,
      beneficiaire_contact: `${d.contact_prenom || ''} ${d.contact_nom || ''} ${d.contact_telephone || d.contact_email || ''}`.trim(),
      beneficiaire_annuaire_id: annuaireId,
      beneficiaire_genre: d.patient_genre || null,
      beneficiaire_tel_gsm: d.patient_tel_gsm || null,
      beneficiaire_tel_fixe: d.patient_tel_fixe || null,
      beneficiaire_adresse: d.patient_adresse || null,
      description: d.souhait_description, localisation: d.souhait_lieu, besoins_specifiques: d.equipement_medical,
      notes_medicales: [d.mobilite && `Mobilité: ${d.mobilite}`, d.allergies && `Allergies: ${d.allergies}`].filter(Boolean).join(' · '),
      date_souhaitee: d.souhait_date || null, statut: 'nouveau', created_by: profile?.id,
      dates_possibles: d.souhait_date ? [{ debut: d.souhait_date, fin: d.souhait_date }] : [],
      origine: (d.partenaire_id || d.source === 'partenaire') ? 'institution' : 'prive',
      partenaire_id: d.partenaire_id || null,
    }).select().single()
    if (error) { alert('Erreur : ' + error.message); return }
    await supabase.from('demandes_souhaits').update({ statut: 'acceptee', souhait_id: s.id }).eq('id', d.id)
    onOpen(s.id)
  }

  if (loading) return <Loading />
  const actives = items.filter(d => d.statut !== 'refusee')
  if (actives.length === 0) return <Empty title="Aucune demande en attente" hint="Les formulaires publics et les encodages partenaires apparaissent ici." />

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {actives.map(d => (
        <Card key={d.id}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:8 }}>
            <div>
              <div style={{ fontWeight:600, color:'var(--text)' }}>{d.patient_prenom} {d.patient_nom} {d.urgence && <Pill color="#A32D2D" bg="#FCEBEB">Urgent</Pill>}</div>
              <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Par {d.contact_prenom} {d.contact_nom} · {d.contact_email}
                {d.source === 'partenaire' && ' · Partenaire'}{d.source === 'externe' && ' · Formulaire public'}
              </div>
            </div>
            <Pill>{DEMANDE_STATUTS[d.statut]?.l || d.statut}</Pill>
          </div>
          <div style={{ fontSize:13.5, color:'var(--text-2)', lineHeight:1.5, marginBottom:10 }}>{d.souhait_description}</div>
          {d.statut === 'acceptee'
            ? <Pill color="#3B6D11" bg="#EAF3DE">Souhait créé — ouvrez-le dans le tableau</Pill>
            : <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}><Btn kind="ok" onClick={()=>accepter(d)}>Accepter et créer le souhait</Btn><Btn kind="danger" onClick={()=>refuser(d)}>Refuser</Btn></div>}
        </Card>
      ))}
    </div>
  )
}
