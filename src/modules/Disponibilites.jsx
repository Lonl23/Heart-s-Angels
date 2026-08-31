import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Sel, Empty } from '@/components/ui'
import { libelleQualsImplicites, teinteDispo, rolesRequisEffectifs, phraseIlManque } from '@/modules/fiche/ficheSchema'
import {
  iso, addDays, todayISO, JOURS,
  titreMois, titreSemaine, grilleMois, grilleSemaine, packLanes, hhmm,
} from './disponibilites/dates'

function libelleMission(it) {
  const m = it.ev
  const base = (m.lieu || m.activite || 'Mission').trim()
  const heures = m.courte_duree && (hhmm(m.heure_debut) || hhmm(m.heure_fin))
    ? ` · ${hhmm(m.heure_debut) || '…'}${hhmm(m.heure_fin) ? '–' + hhmm(m.heure_fin) : ''}`
    : ''
  const j = it.total <= 1 ? '' : (it.j0 === it.j1 ? ` · j${it.j0}/${it.total}` : ` · j${it.j0}–${it.j1}/${it.total}`)
  const manque = manques(m)
  if (!manque.length) return `${base}${j}${heures}`
  return `${base}${j}${heures} · ${phraseIlManque(manque)}`
}

function couverture(m) {
  const requis = rolesRequisEffectifs(m.roles_requis)
  const couverts = m.roles_couverts || []
  return requis.every(r => couverts.includes(r)) ? 'ok' : 'manque'
}

function manques(m) {
  const couverts = m.roles_couverts || []
  return rolesRequisEffectifs(m.roles_requis).filter(r => !couverts.includes(r))
}

export default function Disponibilites() {
  const { profile, peutVoirToutesDispos, peutGererDispos, estVolontaireNonMedical } = useAuth()
  const voirTous = peutVoirToutesDispos()
  const gerer = peutGererDispos()
  const nonMed = estVolontaireNonMedical()
  const [vue, setVue] = useState(() => sessionStorage.getItem('dispo-vue') || 'mois')
  const [anchor, setAnchor] = useState(() => new Date())
  const [missions, setMissions] = useState([])
  const [dispos, setDispos] = useState([])
  const [equipe, setEquipe] = useState([])
  const [form, setForm] = useState(null)
  const [err, setErr] = useState(null)

  const grille = useMemo(() => vue === 'semaine' ? grilleSemaine(anchor) : grilleMois(anchor), [vue, anchor])

  useEffect(() => { sessionStorage.setItem('dispo-vue', vue) }, [vue])
  useEffect(() => { charger() }, [grille.debut, grille.fin, profile?.id, voirTous])
  useEffect(() => {
    if (!gerer) { setEquipe([]); return }
    supabase.from('profiles').select('id,prenom,nom,role,fiche').neq('role','partenaire').eq('actif',true).order('nom')
      .then(({ data }) => setEquipe(data || []))
  }, [gerer])

  async function charger() {
    setErr(null)
    const [{ data: miss, error: e1 }, dispoRes] = await Promise.all([
      supabase.rpc('calendrier_missions', { p_debut: grille.debut, p_fin: grille.fin }),
      (async () => {
        let q = supabase.from('disponibilites').select('id,user_id,date_debut,date_fin,commentaire,profiles(prenom,nom,role,fiche)').lte('date_debut', grille.fin).gte('date_fin', grille.debut).order('date_debut')
        if (!voirTous) q = q.eq('user_id', profile?.id)
        return q
      })(),
    ])
    if (e1) setErr(e1.message)
    if (dispoRes.error) setErr(dispoRes.error.message)
    setMissions(Array.isArray(miss) ? miss : [])
    setDispos(dispoRes.data || [])
  }

  function aller(delta) {
    setAnchor(a => vue === 'semaine' ? addDays(a, delta * 7) : new Date(a.getFullYear(), a.getMonth() + delta, 1))
  }
  function clicJour(day) {
    setForm({
      user_id: profile?.id,
      date_debut: iso(day),
      date_fin: iso(day),
    })
  }
  function clicDispo(d) {
    if (d.user_id === profile?.id || gerer) setForm({ ...d })
  }
  async function supprimer(d) {
    if (d.user_id !== profile?.id && !gerer) return
    if (!confirm('Supprimer cette disponibilité ?')) return
    await supabase.from('disponibilites').delete().eq('id', d.id)
    charger()
  }

  const sousTitre = gerer
    ? 'Vous pouvez encoder les disponibilités de l’équipe. Les missions indiquent ce qui manque (ambulancier, infirmier…) — sans ouvrir le dossier, sans nom de patient.'
    : voirTous
      ? 'Tout le personnel. Une disponibilité = la journée entière (minuit à minuit).'
      : nonMed
        ? 'Vos jours. Seules les missions qui demandent un volontaire non médical apparaissent — avec ce qui manque, sans nom de patient.'
        : 'Vos jours. Les missions indiquent ce qui manque — sans nom de patient, sans ouvrir le dossier.'

  const today = todayISO()

  return (
    <Page title="Disponibilités" subtitle={sousTitre}
      action={<Btn onClick={() => clicJour(new Date())}>{gerer ? '+ Disponibilité' : '+ Me rendre disponible'}</Btn>}>

      <div className="ha-cal-toolbar">
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <Btn kind="soft" onClick={() => aller(-1)}>←</Btn>
          <Btn kind="soft" onClick={() => setAnchor(new Date())}>Aujourd’hui</Btn>
          <Btn kind="soft" onClick={() => aller(1)}>→</Btn>
        </div>
        <div className="ha-cal-titre">{vue === 'semaine' ? titreSemaine(anchor) : titreMois(anchor)}</div>
        <div style={{ display:'flex', gap:6 }}>
          <button type="button" className={'ha-tab-like' + (vue==='semaine' ? ' is-on' : '')} onClick={() => setVue('semaine')}>Semaine</button>
          <button type="button" className={'ha-tab-like' + (vue==='mois' ? ' is-on' : '')} onClick={() => setVue('mois')}>Mois</button>
        </div>
      </div>

      {err && <div className="ha-flash ha-flash-err">{err}</div>}

      {form && (
        <FormDispo form={form} setForm={setForm} profile={profile} equipe={equipe} gerer={gerer}
          onDone={() => { setForm(null); charger() }} />
      )}

      <div className="ha-cal-legend">
        <span><i className="ha-cal-dot ambu" /> Ambulancier</span>
        <span><i className="ha-cal-dot infi" /> Infirmier</span>
        <span><i className="ha-cal-dot dual" /> Infirmier et ambulancier</span>
        <span><i className="ha-cal-dot nonmed" /> Non médical</span>
        <span><i className="ha-cal-dot miss-no" /> Mission incomplète</span>
        <span><i className="ha-cal-dot miss-ok" /> Mission complète</span>
      </div>

      <div className="ha-cal-scroll">
        <div className={'ha-cal' + (vue === 'semaine' ? ' is-semaine' : '')}>
          <div className="ha-cal-headrow">
            {JOURS.map((j, i) => <div key={j} className={'ha-cal-head' + (i >= 5 ? ' is-we' : '')}>{j}</div>)}
          </div>
          {grille.weeks.map(ws => (
            <Semaine key={iso(ws)} weekStart={ws} anchor={anchor} vue={vue} today={today}
              missions={missions} dispos={dispos} moi={profile?.id}
              gerer={gerer}
              onJour={clicJour} onDispo={clicDispo} onSuppr={supprimer} />
          ))}
        </div>
      </div>

      {missions.length === 0 && dispos.length === 0 && !form && (
        <Empty title="Rien sur cette période" hint="Ajoutez vos jours de disponibilité. Les missions (lieu ou activité, sans nom de patient) s’afficheront ici." />
      )}
    </Page>
  )
}

function Semaine({ weekStart, anchor, vue, today, missions, dispos, moi, gerer, onJour, onDispo, onSuppr }) {
  const days = [0,1,2,3,4,5,6].map(i => addDays(weekStart, i))
  const missLanes = packLanes(missions.map(m => ({ ...m, kind:'mission' })), weekStart)
  const dispoLanes = packLanes(dispos.map(d => ({
    ...d, kind:'dispo', date_debut: d.date_debut, date_fin: d.date_fin || d.date_debut,
  })), weekStart)

  return (
    <div className="ha-cal-week">
      {missLanes.map((lane, li) => (
        <div key={'m'+li} className="ha-cal-lane">
          {lane.map(it => {
            const cov = couverture(it.ev)
            const cls = 'ha-cal-ev mission ' + (cov === 'ok' ? 'is-complet' : 'is-incomplet')
            const txt = libelleMission(it)
            return (
              <div key={it.ev.souhait_id} className={cls}
                style={{ gridColumn: `${it.col + 1} / span ${it.span}` }}
                title={txt}>
                {txt}
              </div>
            )
          })}
        </div>
      ))}
      {dispoLanes.map((lane, li) => (
        <div key={'d'+li} className="ha-cal-lane">
          {lane.map(it => {
            const mine = it.ev.user_id === moi
            const editable = mine || gerer
            const p = it.ev.profiles
            const quals = libelleQualsImplicites(p?.role, p?.fiche)
            const nom = mine ? 'Moi' : `${p?.prenom || ''} ${p?.nom || ''}`.trim()
            const label = quals ? `${nom} · ${quals}` : nom
            const teinte = teinteDispo(p?.role, p?.fiche)
            return (
              <button key={it.ev.id} type="button"
                className={'ha-cal-ev dispo-' + teinte}
                style={{ gridColumn: `${it.col + 1} / span ${it.span}`, cursor: editable ? 'pointer' : 'default' }}
                title={label}
                onClick={() => editable ? onDispo(it.ev) : null}
                onContextMenu={e => { if (editable) { e.preventDefault(); onSuppr(it.ev) } }}>
                {label}
              </button>
            )
          })}
        </div>
      ))}
      <div className="ha-cal-days">
        {days.map(day => {
          const we = day.getDay() === 0 || day.getDay() === 6
          const out = vue === 'mois' && day.getMonth() !== anchor.getMonth()
          const id = iso(day)
          return (
            <button key={id} type="button" className={'ha-cal-day' + (we ? ' is-we' : '') + (out ? ' is-out' : '') + (id===today ? ' is-today' : '')}
              onClick={() => onJour(day)}>
              <span className="ha-cal-num">{day.getDate()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FormDispo({ form, setForm, profile, equipe, gerer, onDone }) {
  const set = (k, v) => setForm(s => ({ ...s, [k]: v }))
  const [saving, setSaving] = useState(false)
  const edit = !!form.id
  const cible = (equipe || []).find(p => p.id === form.user_id) || (form.user_id === profile?.id ? profile : null)
  const quals = libelleQualsImplicites(cible?.role, cible?.fiche)
  async function save() {
    const uid = gerer ? (form.user_id || profile?.id) : profile?.id
    if (!uid) { alert('Choisissez un volontaire.'); return }
    if (!form.date_debut) { alert('Indiquez la date.'); return }
    const debut = form.date_debut
    const fin = form.date_fin && form.date_fin >= form.date_debut ? form.date_fin : form.date_debut
    setSaving(true)
    const payload = {
      user_id: uid,
      date_debut: debut,
      date_fin: fin,
      qualification: '',
      demi_journee: 'journee_complete',
      commentaire: form.commentaire || null,
    }
    const { error } = edit
      ? await supabase.from('disponibilites').update(payload).eq('id', form.id)
      : await supabase.from('disponibilites').insert(payload)
    setSaving(false)
    if (error) { alert(error.message); return }
    onDone()
  }
  async function supprimer() {
    if (!form.id || !confirm('Supprimer cette disponibilité ?')) return
    await supabase.from('disponibilites').delete().eq('id', form.id)
    onDone()
  }
  return (
    <Card style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12, gap:8, flexWrap:'wrap' }}>
        <div style={{ fontWeight:600, color:'var(--text)' }}>{edit ? 'Modifier la disponibilité' : 'Nouvelle disponibilité'}</div>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      <p style={{ margin:'0 0 10px', fontSize:13, color:'var(--text-muted)' }}>Journée entière, de minuit à minuit. Le rôle vient de la fiche (ambulancier, infirmier, chauffeur si permis et sélection médicale) — rien à choisir ici.</p>
      {gerer && (
        <Sel label="Volontaire" value={form.user_id || ''} set={v => setForm(s => ({ ...s, user_id: v }))}
          options={[{ v:'', l:'— Choisir —' }, ...equipe.map(p => ({ v:p.id, l:`${p.prenom} ${p.nom}` }))]} />
      )}
      {quals && <div style={{ fontSize:13, color:'var(--text-2)', margin:'0 0 10px' }}>Rôle pour les missions : <strong>{quals}</strong></div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="Du" type="date" value={form.date_debut} set={v => set('date_debut', v)} required />
        <F label="Au" type="date" value={form.date_fin || form.date_debut} set={v => set('date_fin', v)} />
      </div>
      <F label="Commentaire (optionnel)" value={form.commentaire} set={v => set('commentaire', v)} />
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <Btn onClick={save} disabled={saving}>{saving ? '…' : 'Enregistrer'}</Btn>
        {edit && <Btn kind="danger" onClick={supprimer}>Supprimer</Btn>}
      </div>
    </Card>
  )
}
