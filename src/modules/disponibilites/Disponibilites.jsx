import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// ── Couleurs disponibilités ───────────────────────────────────────────────────
// Ambulancier (AMU + ATNUP) → bleu
// Infirmier → vert
// Médecin → rouge
// Bénévole non-médical → gris
// Tous les autres → jaune
const ROLE_COLORS = {
  ambulancier: { bg:'#1BB0CE', text:'white', label:'Ambulancier', border:'#0E7A93' },
  infirmier:              { bg:'#3B6D11', text:'white', label:'Infirmier(ère)', border:'#2A4F0C' },
  medecin:                { bg:'#C8435A', text:'white', label:'Médecin', border:'#A32D2D' },
  volontaire_non_medical: { bg:'#7A7470', text:'white', label:'Bénévole non-médical(e)', border:'#5A5450' },
  // Autres médicaux → jaune (regroupés sous "Autre médical")
  kinesitherapeute:   { bg:'#D4A017', text:'white', label:'Autre médical', border:'#B8860B' },
  aide_soignant:      { bg:'#D4A017', text:'white', label:'Autre médical', border:'#B8860B' },
  psychologue:        { bg:'#D4A017', text:'white', label:'Autre médical', border:'#B8860B' },
  volontaire_medical: { bg:'#D4A017', text:'white', label:'Autre médical', border:'#B8860B' },
}

// Rôles qui apparaissent dans les disponibilités
const ROLES_OPERATIONNELS = Object.keys(ROLE_COLORS)

function ymd(d){ const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}` }
function getRoleColor(role) {
  return ROLE_COLORS[role] || { bg:'#7A7470', text:'white', label:role }
}

// ── Jours et heures ───────────────────────────────────────────────────────────
const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
const HEURES = ['00:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00']
const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function getWeekDays(date) {
  const d = new Date(date)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd
  })
}

export default function Disponibilites() {
  const { profile, can } = useAuth()
  const [view, setView]     = useState('semaine') // 'semaine' | 'mois' | 'liste'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [dispos, setDispos] = useState([])
  const [modal, setModal]   = useState(null) // { type:'new'|'edit', data }
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [filterRole, setFilterRole] = useState('tous')
  const [joursSouhaits, setJoursSouhaits] = useState([]) // dates possibles (proposées)
  const [joursConfirmes, setJoursConfirmes] = useState([])
  const [souhaitOptions, setSouhaitOptions] = useState([]) // [{ jours:[...] }] une entrée par option de date
  const [filterUser, setFilterUser] = useState('moi') // 'moi' | 'tous'
  const [profiles, setProfiles] = useState([])

  const hasRole = (p,r) => p?.role === r || (p?.roles_supplementaires || []).includes(r)
  const estAmbAccredite = (p) => hasRole(p,'ambulancier') && !!p?.selection_medicale
  const estInfirmier = (p) => hasRole(p,'infirmier') || hasRole(p,'medecin')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const load = useCallback(async () => {
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from('disponibilites').select('*, profiles!disponibilites_user_id_fkey(id,prenom,nom,role,roles_supplementaires,photo_url,selection_medicale)').order('date_debut'),
      supabase.from('profiles').select('id,prenom,nom,role,photo_url').eq('actif',true).order('nom'),
    ])
    setDispos(d||[])
    setProfiles(p||[])
    // Jours où un souhait est proposé comme DATE POSSIBLE (plages incluses)
    const depuis = ymd(new Date())
    const jusqu  = ymd(new Date(Date.now()+120*864e5))
    const { data: sd } = await supabase
      .from('souhait_dates')
      .select('date_proposee, date_fin_proposee, plusieurs_jours, confirmee, souhaits!inner(statut)')
      .gte('date_proposee', depuis).lte('date_proposee', jusqu)
    const ARCHIVE = ['realise','non_realise','renseignements']
    const jours = new Set()
    const confirmes = new Set()
    const options = []
    sd?.forEach(row => {
      if (ARCHIVE.includes(row.souhaits?.statut)) return
      const debut = row.date_proposee
      const fin = (row.plusieurs_jours && row.date_fin_proposee) ? row.date_fin_proposee : debut
      const a = new Date(debut+'T00:00:00'), b = new Date(fin+'T00:00:00')
      const jrs = []
      for (let t=new Date(a); t<=b; t.setDate(t.getDate()+1)) {
        const j = ymd(t)
        jrs.push(j); jours.add(j); if (row.confirmee) confirmes.add(j)
      }
      if (jrs.length) options.push({ jours: jrs })
    })
    setJoursSouhaits([...jours])
    setJoursConfirmes([...confirmes])
    setSouhaitOptions(options)
  }, [])

  useEffect(() => { load() }, [load])

  // Disponibilités par volontaire (plages), pour vérifier la couverture sur TOUS les jours d'une option
  const byUser = useMemo(() => {
    const m = new Map()
    for (const d of dispos) {
      const dd = d.date_debut ? String(d.date_debut).slice(0,10) : null
      const df = d.date_fin ? String(d.date_fin).slice(0,10) : dd
      if (!dd) continue
      if (!m.has(d.user_id)) m.set(d.user_id, { profile: d.profiles, ranges: [] })
      m.get(d.user_id).ranges.push({ dd, df: df || dd })
    }
    return m
  }, [dispos])

  // Couverture : une option (mono ou multi-jours) est couverte si ≥1 ambulancier accrédité
  // ET ≥1 infirmier/médecin sont disponibles sur TOUS ses jours. Le résultat est reporté sur chaque jour.
  const couverture = useMemo(() => {
    const couvreTous = (ranges, jrs) => jrs.every(j => ranges.some(r => r.dd <= j && r.df >= j))
    const m = {}
    for (const opt of souhaitOptions) {
      let amb = 0, inf = 0
      for (const { profile: p, ranges } of byUser.values()) {
        if (!couvreTous(ranges, opt.jours)) continue
        if (estAmbAccredite(p)) amb++
        if (estInfirmier(p)) inf++
      }
      const ok = amb >= 1 && inf >= 1
      for (const j of opt.jours) {
        const prev = m[j]
        m[j] = prev
          ? { amb: Math.min(prev.amb, amb), inf: Math.min(prev.inf, inf), ok: prev.ok && ok }
          : { amb, inf, ok }
      }
    }
    return m
  }, [souhaitOptions, byUser])

  const weekDays = getWeekDays(currentDate)

  function navWeek(delta) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + delta * 7)
    setCurrentDate(d)
  }
  function navMonth(delta) {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() + delta)
    setCurrentDate(d)
  }

  function openNew(date) {
    if (!profile) return
    const d = date || new Date()
    const iso = ymd(d)
    setForm({
      user_id:  profile.id,
      jour:     iso,
      jour_fin: iso,
      type:     'disponible',
      note:     '',
    })
    setModal({ type:'new' })
  }

  async function save() {
    setSaving(true)
    const jour = form.jour || (form.date_debut ? String(form.date_debut).slice(0,10) : null)
    const jourFin = form.jour_fin || jour
    const payload = {
      user_id: form.user_id || profile.id,
      date_debut: `${jour}T00:00:00`,
      date_fin:   `${jourFin}T23:59:00`,
      type:       form.type,
      note:       form.note || null,
    }
    if (modal.type === 'edit') {
      await supabase.from('disponibilites').update(payload).eq('id', form.id)
    } else {
      await supabase.from('disponibilites').insert(payload)
    }
    setSaving(false); setModal(null); load()
  }

  function openEdit(d){
    setForm({ ...d, jour: String(d.date_debut).slice(0,10), jour_fin: String(d.date_fin||d.date_debut).slice(0,10) })
    setModal({ type:'edit' })
  }

  async function remove() {
    if (!confirm('Supprimer cette disponibilité ?')) return
    await supabase.from('disponibilites').delete().eq('id', form.id)
    setModal(null); load()
  }

  // Filtrer les dispos — uniquement rôles opérationnels
  const dispFiltered = dispos.filter(d => {
    if (filterUser === 'moi' && d.user_id !== profile?.id) return false
    if (filterUser === 'tous' && !ROLES_OPERATIONNELS.includes(d.profiles?.role)) return false
    if (filterRole !== 'tous' && d.profiles?.role !== filterRole) return false
    return true
  })

  // Dispos de la semaine courante
  const weekDispos = dispFiltered.filter(d => {
    const dd = new Date(d.date_debut)
    return dd >= weekDays[0] && dd <= weekDays[6]
  })

  const TYPE_COLORS = {
    disponible:    { bg:'#EAF3DE', tc:'#3B6D11', label:'Disponible' },
    indisponible:  { bg:'#FCEBEB', tc:'#C8435A', label:'Indisponible' },
    incertain:     { bg:'#FAEEDA', tc:'#BA7517', label:'Incertain' },
    en_mission:    { bg:'#E6F7FA', tc:'#1BB0CE', label:'En mission' },
  }

  const rolesUniques = [...new Set(profiles.filter(p => ROLES_OPERATIONNELS.includes(p.role)).map(p => p.role))]

  return (
    <div style={{ padding:'20px 24px', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div className="disp-header">
        <div>
          <h1 className="disp-title">Disponibilités</h1>
          <p className="disp-sub">Gérez vos disponibilités et consultez celles de l'équipe.</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {/* Vue */}
          <div className="disp-toggle">
            {[['semaine','Semaine'],['mois','Mois'],['liste','Liste']].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} className={`disp-toggle-btn ${view===v?'active':''}`}>{l}</button>
            ))}
          </div>
          <button onClick={()=>openNew()} className="disp-btn-add">+ Ma disponibilité</button>
        </div>
      </div>

      {/* Filtres */}
      <div className="disp-filters">
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={()=>setFilterUser('moi')} className={`disp-filter-btn ${filterUser==='moi'?'active':''}`}>
            👤 Mes dispos
          </button>
          {can('coordinateur') && (
            <button onClick={()=>setFilterUser('tous')} className={`disp-filter-btn ${filterUser==='tous'?'active':''}`}>
              👥 Toute l'équipe
            </button>
          )}
        </div>
        {filterUser === 'tous' && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <button onClick={()=>setFilterRole('tous')} className={`disp-filter-btn ${filterRole==='tous'?'active':''}`}>Tous les rôles</button>
            {rolesUniques.map(r => {
              const c = getRoleColor(r)
              return (
                <button key={r} onClick={()=>setFilterRole(r)}
                  style={{ background: filterRole===r ? c.bg : 'white', color: filterRole===r ? c.text : '#4A4340', border:`1px solid ${c.border||'rgba(0,0,0,.1)'}` }}
                  className="disp-filter-btn">
                  {c.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Navigation date */}
      <div className="disp-nav">
        <button onClick={()=>view==='mois'?navMonth(-1):navWeek(-1)} className="disp-nav-btn">‹</button>
        <div className="disp-nav-title">
          {view === 'semaine'
            ? `${weekDays[0].getDate()} ${MOIS[weekDays[0].getMonth()]} — ${weekDays[6].getDate()} ${MOIS[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`
            : `${MOIS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
          }
        </div>
        <button onClick={()=>view==='mois'?navMonth(1):navWeek(1)} className="disp-nav-btn">›</button>
        <button onClick={()=>setCurrentDate(new Date())} className="disp-today-btn">Aujourd'hui</button>
      </div>

      {/* ── VUE SEMAINE ── */}
      {view === 'semaine' && (
        <div className="disp-week">
          {weekDays.map((day, di) => {
            const dayDispos = weekDispos.filter(d => {
              const dd = new Date(d.date_debut)
              return dd.getDate()===day.getDate() && dd.getMonth()===day.getMonth()
            })
            const isToday = day.toDateString() === new Date().toDateString()
            const dayStr = ymd(day)
            const hasSouhait = joursSouhaits.includes(dayStr)
            const cov = couverture[dayStr] || { amb:0, inf:0, ok:false }
            const couvertOK = cov.ok
            const dayRed = hasSouhait && !couvertOK
            return (
              <div key={di} className={`disp-day ${isToday?'disp-day-today':''} ${dayRed?'disp-day-red':''}`} onClick={()=>openNew(day)}
                style={hasSouhait && couvertOK ? { boxShadow:'inset 0 0 0 2px rgba(59,109,17,.4)' } : undefined}>
                {dayRed && <div className="disp-day-alert" title="Souhait à couvrir — il manque la qualification requise">⚠️</div>}
                <div className="disp-day-header">
                  <span className="disp-day-name">{JOURS[di]}</span>
                  <span className={`disp-day-num ${isToday?'today':''}`}>{day.getDate()}</span>
                </div>
                {hasSouhait && (
                  <div style={{ fontSize:10.5, fontWeight:600, borderRadius:6, padding:'2px 5px', marginBottom:4, background: couvertOK?'#EAF3DE':'#FCEBEB', color: couvertOK?'#3B6D11':'#C8435A' }}>
                    {couvertOK ? '✅ Souhait couvert' : '🎯 Souhait — manque '}{!couvertOK && [cov.amb<1?'ambulancier accr.':null, cov.inf<1?'infirmier':null].filter(Boolean).join(' + ')}
                  </div>
                )}
                <div className="disp-day-events">
                  {dayDispos.map((d, i) => {
                    const rc = getRoleColor(d.profiles?.role)
                    const tc = TYPE_COLORS[d.type] || TYPE_COLORS.disponible
                    return (
                      <div key={i} className="disp-event"
                        style={{ background: filterUser==='tous' ? rc.bg : tc.bg, color: filterUser==='tous' ? rc.text : tc.tc, border:`1px solid ${filterUser==='tous'?(rc.border||'transparent'):'transparent'}` }}
                        onClick={e=>{
                          e.stopPropagation()
                          if (d.user_id === profile?.id || can('coordinateur')) {
                            openEdit(d)
                          }
                        }}>
                        <div className="disp-event-time">Journée</div>
                        {filterUser === 'tous' && (
                          <div className="disp-event-who">{d.profiles?.prenom} {d.profiles?.nom?.[0]}.</div>
                        )}
                        <div className="disp-event-type">{tc.label}</div>
                      </div>
                    )
                  })}
                  {dayDispos.length === 0 && (
                    <div className="disp-empty-day">+ Ajouter</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── VUE LISTE ── */}
      {view === 'liste' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {dispFiltered.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px', color:'#7A7470', fontSize:14 }}>
              Aucune disponibilité enregistrée.
            </div>
          )}
          {dispFiltered.map((d, i) => {
            const rc = getRoleColor(d.profiles?.role)
            const tc = TYPE_COLORS[d.type] || TYPE_COLORS.disponible
            const deb = new Date(d.date_debut)
            const fin = new Date(d.date_fin)
            const canEdit = d.user_id === profile?.id || can('coordinateur')
            return (
              <div key={i} className="disp-list-row" onClick={()=>canEdit&&openEdit(d)}>
                <div className="disp-list-role-dot" style={{ background: rc.bg, border:`1px solid ${rc.border||'transparent'}` }}/>
                <div className="disp-list-date">
                  <div className="disp-list-date-main">{deb.toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'})}</div>
                  <div className="disp-list-time">{ymd(deb)===ymd(fin) ? 'Journée entière' : `→ ${fin.toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'})}`}</div>
                </div>
                {filterUser === 'tous' && (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {d.profiles?.photo_url
                      ? <img src={d.profiles.photo_url} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' }}/>
                      : <div style={{ width:28, height:28, borderRadius:'50%', background:rc.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:rc.text }}>
                          {(d.profiles?.prenom?.[0]||'')+( d.profiles?.nom?.[0]||'')}
                        </div>
                    }
                    <div>
                      <div style={{ fontSize:13.5, fontWeight:500, color:'#1A1514' }}>{d.profiles?.prenom} {d.profiles?.nom}</div>
                      <div style={{ fontSize:11.5, color:'#7A7470' }}>{rc.label}</div>
                    </div>
                  </div>
                )}
                <span style={{ background:tc.bg, color:tc.tc, padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600 }}>{tc.label}</span>
                {d.note && <span style={{ fontSize:12.5, color:'#7A7470' }}>📝 {d.note}</span>}
                {canEdit && <span style={{ marginLeft:'auto', fontSize:12, color:'#1BB0CE' }}>✏️</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── VUE MOIS ── */}
      {view === 'mois' && <MonthView currentDate={currentDate} dispos={dispFiltered} profile={profile} joursSouhaits={joursSouhaits} couverture={couverture} onDayClick={openNew} onEventClick={(d)=>{ if(d.user_id===profile?.id||can('coordinateur')){openEdit(d)} }} />}

      {/* Légende */}
      <div className="disp-legend">
        <div style={{ fontSize:12, fontWeight:600, color:'#7A7470', marginBottom:8 }}>Légende — Qualifications médicales & bénévoles</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {Object.values(
            Object.entries(ROLE_COLORS).reduce((acc, [, c]) => {
              if (!acc[c.label]) acc[c.label] = c
              return acc
            }, {})
          ).map((c, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:14, height:14, borderRadius:4, background:c.bg, border:`1px solid ${c.border||'transparent'}`, flexShrink:0 }}/>
              <span style={{ fontSize:11.5, color:'#7A7470' }}>{c.label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap' }}>
          {Object.entries(TYPE_COLORS).map(([k,c])=>(
            <div key={k} style={{ background:c.bg, color:c.tc, padding:'2px 10px', borderRadius:99, fontSize:11.5, fontWeight:600 }}>{c.label}</div>
          ))}
        </div>
      </div>

      {/* ── MODAL ajout/édition ── */}
      {modal && (
        <div className="disp-modal-bg" onClick={()=>setModal(null)}>
          <div className="disp-modal" onClick={e=>e.stopPropagation()}>
            <div className="disp-modal-header">
              <h3>{modal.type==='new'?'Nouvelle disponibilité':'Modifier la disponibilité'}</h3>
              <button onClick={()=>setModal(null)} style={CLOSE_BTN}>✕</button>
            </div>
            <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:14 }}>

              {/* Qui ? (coordinateur peut encoder pour quelqu'un d'autre) */}
              {can('coordinateur') && (
                <div>
                  <label style={LBL}>Membre</label>
                  <select value={form.user_id||profile?.id} onChange={e=>set('user_id',e.target.value)} style={SEL}>
                    {profiles
                      .filter(p => ROLES_OPERATIONNELS.includes(p.role))
                      .map(p=>(

                        <option key={p.id} value={p.id}>
                          {p.prenom} {p.nom} — {getRoleColor(p.role).label}
                        </option>
                      ))}
                  </select>
                  {/* Aperçu couleur du membre sélectionné */}
                  {(() => {
                    const p = profiles.find(p=>p.id===(form.user_id||profile?.id))
                    const c = p ? getRoleColor(p.role) : null
                    return c ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                        <div style={{ width:16, height:16, borderRadius:4, background:c.bg, border:`1px solid ${c.border||'transparent'}` }}/>
                        <span style={{ fontSize:12.5, color:'#7A7470' }}>Couleur affichée : <strong style={{ color:'#1A1514' }}>{c.label}</strong></span>
                      </div>
                    ) : null
                  })()}
                </div>
              )}

              {/* Type */}
              <div>
                <label style={LBL}>Statut</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[['disponible','✓ Disponible','#EAF3DE','#3B6D11'],['indisponible','✗ Indisponible','#FCEBEB','#C8435A'],['incertain','? Incertain','#FAEEDA','#BA7517'],['en_mission','🚑 En mission','#E6F7FA','#1BB0CE']].map(([v,l,bg,tc])=>(
                    <label key={v} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderRadius:9, border:`1.5px solid ${form.type===v?tc:'rgba(0,0,0,.08)'}`, background:form.type===v?bg:'white', cursor:'pointer' }}>
                      <input type="radio" name="type" value={v} checked={form.type===v} onChange={()=>set('type',v)} style={{ accentColor:tc }}/>
                      <span style={{ fontSize:13.5, color:form.type===v?tc:'#4A4340', fontWeight:form.type===v?600:400 }}>{l}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dates — journée entière */}
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={LBL}>Jour</label>
                    <input type="date" value={form.jour||''} onChange={e=>set('jour',e.target.value)} style={INP}/>
                  </div>
                  <div>
                    <label style={LBL}>Jusqu'au (optionnel)</label>
                    <input type="date" value={form.jour_fin||''} min={form.jour||undefined} onChange={e=>set('jour_fin',e.target.value)} style={INP}/>
                  </div>
                </div>
                <div style={{ fontSize:11.5, color:'#7A7470', marginTop:6 }}>🕐 La disponibilité couvre la <strong>journée entière</strong>. Laissez « Jusqu'au » vide pour un seul jour.</div>
              </div>

              {/* Note */}
              <div>
                <label style={LBL}>Note (optionnel)</label>
                <input type="text" value={form.note||''} onChange={e=>set('note',e.target.value)} placeholder="Remarque, contrainte particulière…" style={INP}/>
              </div>

              {/* Boutons */}
              <div style={{ display:'flex', gap:8, paddingTop:4 }}>
                <button onClick={save} disabled={saving} style={{ flex:1, padding:12, background:saving?'rgba(27,176,206,.4)':'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:14, fontWeight:600, cursor:saving?'wait':'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                  {saving?'Enregistrement…':'✓ Enregistrer'}
                </button>
                {modal.type==='edit' && (
                  <button onClick={remove} style={{ padding:'12px 18px', background:'#FCEBEB', color:'#C8435A', border:'1px solid rgba(200,67,90,.2)', borderRadius:9, fontSize:13.5, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vue Mois ──────────────────────────────────────────────────────────────────
function MonthView({ currentDate, dispos, profile, joursSouhaits=[], couverture={}, onDayClick, onEventClick }) {
  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7 // lundi=0
  const days = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
        {JOURS.map(j=><div key={j} style={{ textAlign:'center', fontSize:12, fontWeight:600, color:'#7A7470', padding:'6px 0' }}>{j}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {days.map((day, i) => {
          if (!day) return <div key={i}/>
          const isToday = day.toDateString() === new Date().toDateString()
          const dayStr = ymd(day)
          const hasSouhait = joursSouhaits.includes(dayStr)
          const cov = couverture[dayStr] || { amb:0, inf:0, ok:false }
          const dayRed = hasSouhait && !cov.ok
          const dayGreen = hasSouhait && cov.ok
          const dayDispos = dispos.filter(d=>{
            const dd = new Date(d.date_debut)
            return dd.getDate()===day.getDate() && dd.getMonth()===month && dd.getFullYear()===year
          })
          const bg = isToday ? '#E6F7FA' : dayRed ? '#FDF1F3' : dayGreen ? '#F6FBF1' : 'white'
          const bord = isToday ? '#1BB0CE' : dayRed ? '#C8435A' : dayGreen ? '#3B6D11' : 'rgba(27,176,206,.08)'
          return (
            <div key={i} onClick={()=>onDayClick(day)} style={{ minHeight:80, background:bg, border:`1px solid ${bord}`, borderRadius:8, padding:'4px', cursor:'pointer', transition:'background .12s', position:'relative' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                {hasSouhait && <span title={cov.ok ? 'Souhait couvert' : 'Souhait — qualification manquante'} style={{ fontSize:11 }}>{cov.ok ? '✅' : '🎯'}</span>}
                <div style={{ fontSize:12, fontWeight:isToday?700:400, color:isToday?'#1BB0CE':'#4A4340', marginLeft:'auto' }}>{day.getDate()}</div>
              </div>
              {hasSouhait && !cov.ok && (
                <div style={{ fontSize:9.5, fontWeight:600, color:'#C8435A', marginBottom:2 }}>manque {[cov.amb<1?'amb. accr.':null, cov.inf<1?'inf.':null].filter(Boolean).join(' + ')}</div>
              )}
              {dayDispos.slice(0,3).map((d,j)=>{
                const rc = getRoleColor(d.profiles?.role)
                return (
                  <div key={j} onClick={e=>{e.stopPropagation();onEventClick(d)}}
                    style={{ background:rc.bg, color:rc.text, borderRadius:4, fontSize:10, padding:'2px 5px', marginBottom:2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {d.profiles?.prenom} {d.profiles?.nom?.[0]}.
                  </div>
                )
              })}
              {dayDispos.length > 3 && <div style={{ fontSize:10, color:'#7A7470', textAlign:'right' }}>+{dayDispos.length-3}</div>}
            </div>
          )
        })}
        <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', gap:14, marginTop:10, flexWrap:'wrap', fontSize:12, fontWeight:500 }}>
          <span style={{ display:'flex', alignItems:'center', gap:6, color:'#C8435A' }}><span style={{ width:12, height:12, borderRadius:3, background:'#FDF1F3', border:'1px solid #C8435A' }}/>🎯 Souhait sans la qualification requise (1 ambulancier accrédité + 1 infirmier)</span>
          <span style={{ display:'flex', alignItems:'center', gap:6, color:'#3B6D11' }}><span style={{ width:12, height:12, borderRadius:3, background:'#F6FBF1', border:'1px solid #3B6D11' }}/>✅ Souhait couvert</span>
        </div>
      </div>
    </div>
  )
}

const LBL       = { fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }
const SEL       = { width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }
const INP       = { width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }
const CLOSE_BTN = { background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#7A7470', lineHeight:1 }

const CSS = `
.disp-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:20px;}
.disp-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.9rem;font-weight:500;color:#1A1514;margin:0 0 4px;}
.disp-sub{font-size:13px;color:#7A7470;margin:0;}
.disp-toggle{display:flex;background:#F0EFED;border-radius:9px;padding:3px;gap:2px;}
.disp-toggle-btn{padding:6px 14px;border:none;border-radius:7px;background:none;font-size:13px;cursor:pointer;color:#7A7470;font-family:'DM Sans',sans-serif;transition:all .12s;}
.disp-toggle-btn.active{background:white;color:#1BB0CE;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.1);}
.disp-btn-add{padding:8px 18px;background:#1BB0CE;color:white;border:none;border-radius:9px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;}
.disp-filters{display:flex;flex-direction:column;gap:8px;margin-bottom:14px;}
.disp-filter-btn{padding:5px 12px;border-radius:7px;border:1px solid rgba(27,176,206,.2);background:white;color:#7A7470;font-size:12.5px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .12s;}
.disp-filter-btn.active{background:#1BB0CE;color:white;border-color:#1BB0CE;font-weight:600;}
.disp-nav{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.disp-nav-btn{width:32px;height:32px;border:1px solid rgba(27,176,206,.2);background:white;border-radius:8px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#1BB0CE;}
.disp-nav-title{font-size:14px;font-weight:600;color:#1A1514;flex:1;text-align:center;}
.disp-today-btn{padding:5px 12px;border:1px solid rgba(27,176,206,.2);background:#E6F7FA;border-radius:7px;font-size:12.5px;color:#1BB0CE;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}
/* Semaine */
.disp-week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}
.disp-day{min-height:120px;background:white;border:1px solid rgba(27,176,206,.08);border-radius:10px;padding:6px;cursor:pointer;transition:background .12s;position:relative;}
.disp-day:hover{background:#F8FCFD;}
.disp-day-today{border-color:#1BB0CE;background:#E6F7FA !important;}
.disp-day-red{border-color:#C8435A !important;background:#FEF2F2 !important;}
.disp-day-red .disp-day-num{color:#C8435A;}
.disp-day-alert{position:absolute;top:4px;right:4px;font-size:12px;line-height:1;}
.disp-day-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.disp-day-name{font-size:11px;font-weight:600;color:#7A7470;text-transform:uppercase;}
.disp-day-num{font-size:14px;font-weight:600;color:#1A1514;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.disp-day-num.today{background:#1BB0CE;color:white;}
.disp-day-events{display:flex;flex-direction:column;gap:3px;}
.disp-event{border-radius:6px;padding:4px 6px;cursor:pointer;transition:opacity .12s;}
.disp-event:hover{opacity:.85;}
.disp-event-time{font-size:10px;opacity:.8;}
.disp-event-who{font-size:11px;font-weight:600;}
.disp-event-type{font-size:10.5px;opacity:.85;}
.disp-empty-day{font-size:11.5px;color:rgba(27,176,206,.5);text-align:center;padding:6px 0;}
/* Liste */
.disp-list-row{display:flex;align-items:center;gap:14px;padding:12px 16px;background:white;border:1px solid rgba(27,176,206,.08);border-radius:12px;cursor:pointer;transition:all .12s;}
.disp-list-row:hover{border-color:rgba(27,176,206,.25);box-shadow:0 3px 12px rgba(27,176,206,.08);}
.disp-list-role-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;}
.disp-list-date-main{font-size:13.5px;font-weight:600;color:#1A1514;}
.disp-list-time{font-size:12px;color:#7A7470;}
/* Légende */
.disp-legend{margin-top:28px;background:white;border:1px solid rgba(27,176,206,.08);border-radius:14px;padding:16px 18px;}
/* Modal */
.disp-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
.disp-modal{background:white;border-radius:18px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;}
.disp-modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid rgba(27,176,206,.1);position:sticky;top:0;background:white;}
.disp-modal-header h3{margin:0;font-size:15px;font-weight:600;color:#1A1514;}
@media(max-width:900px){.disp-week{grid-template-columns:repeat(4,1fr);}}
@media(max-width:600px){.disp-week{grid-template-columns:repeat(2,1fr);} .disp-header{flex-direction:column;}}
`