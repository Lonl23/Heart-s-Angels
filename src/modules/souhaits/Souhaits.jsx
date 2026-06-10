// src/modules/souhaits/Souhaits.jsx
import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth, PHASES_RECOLTEUR } from '@/hooks/useAuth'
import { STATUT_MAP as STATUTS, STATUTS_FLUX, PHASES_AFFECTE, PHASES_ARCHIVE } from '@/lib/souhaitStatuts'
import DetailSouhait from './DetailSouhait'
import FormSouhait   from './FormSouhait'

export default function Souhaits() {
  return (
    <Routes>
      <Route index          element={<ListeSouhaits />} />
      <Route path="nouveau" element={<FormSouhait />} />
      <Route path=":id"     element={<DetailSouhait />} />
      <Route path=":id/edit" element={<FormSouhait />} />
    </Routes>
  )
}

function ListeSouhaits() {
  const { profile, can, souhaitsAccess } = useAuth()
  const navigate   = useNavigate()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre]   = useState('tous')     // statut ou 'tous' ou 'mes'
  const [search, setSearch]   = useState('')
  const [tab, setTab]         = useState('actifs')   // 'actifs' | 'demandes' | 'archives'

  useEffect(() => { load() }, [tab, filtre, profile?.id])

  async function load() {
    setLoading(true)
    const access = souhaitsAccess()

    if (tab === 'demandes') {
      if (!can('souhaits.create')) { setItems([]); setLoading(false); return }
      const { data } = await supabase.from('demandes_souhaits').select('*').order('created_at', { ascending: false })
      setItems(data || [])
    } else {
      let q = supabase.from('souhaits')
        .select('*, souhait_personnel(user_id, profiles(prenom,nom,role))')
        .order('created_at', { ascending: false })

      // Filtres selon le niveau d'accès
      if (access === 'avant_realisation') {
        // Récolteur : uniquement les phases avant réalisation
        q = q.in('statut', PHASES_RECOLTEUR)
      } else if (access === 'affecte') {
        // Volontaire médical : uniquement les souhaits où il est affecté ET en phase de réalisation
        // On charge tout puis on filtre côté client (la RLS gère le reste)
        q = q.in('statut', PHASES_AFFECTE)
      } else if (access === 'none') {
        setItems([]); setLoading(false); return
      }
      // access === 'all' → pas de filtre supplémentaire

      if (tab === 'archives') q = q.in('statut', PHASES_ARCHIVE)
      else if (access === 'all') q = q.not('statut', 'in', '("realise","non_realise")')

      if (filtre !== 'tous' && filtre !== 'mes') q = q.eq('statut', filtre)
      if (filtre === 'mes') q = q.eq('created_by', profile?.id)

      let { data, error } = await q
      if (error) {
        console.warn('souhaits load erreur:', error.message)
        // Fallback : recharger sans l'embed souhait_personnel
        let q2 = supabase.from('souhaits').select('*').order('created_at', { ascending: false })
        if (access === 'avant_realisation') q2 = q2.in('statut', PHASES_RECOLTEUR)
        else if (access === 'affecte')      q2 = q2.in('statut', PHASES_AFFECTE)
        if (tab === 'archives') q2 = q2.in('statut', PHASES_ARCHIVE)
        else if (access === 'all') q2 = q2.not('statut', 'in', '("realise","non_realise")')
        if (filtre !== 'tous' && filtre !== 'mes') q2 = q2.eq('statut', filtre)
        if (filtre === 'mes') q2 = q2.eq('created_by', profile?.id)
        const r2 = await q2
        data = r2.data || []
      }
      data = data || []

      // Filtre supplémentaire pour volontaires médicaux : uniquement leurs affectations
      if (access === 'affecte') {
        data = data.filter(s =>
          s.souhait_personnel?.some(sp => sp.user_id === profile?.id)
        )
      }

      setItems(data)
    }
    setLoading(false)
  }

  const displayed = search
    ? items.filter(s => {
        const str = `${s.patient_prenom || ''} ${s.patient_nom || ''} ${s.souhait_description || ''} ${s.nom || ''}`.toLowerCase()
        return str.includes(search.toLowerCase())
      })
    : items

  // Regroupement par phase du pipeline (vue intuitive du parcours)
  const ordreActifs = STATUTS_FLUX.map(s => s.key).filter(k => !PHASES_ARCHIVE.includes(k)).concat('renseignements')
  const ordrePhases = tab === 'archives' ? PHASES_ARCHIVE : ordreActifs
  const groupes = ordrePhases
    .map(k => ({ phase: STATUTS[k] || { key:k, label:k, color:'#7A7470', bg:'#F0EFED' }, items: displayed.filter(s => s.statut === k) }))
    .filter(g => g.items.length > 0)

  return (
    <div style={{ padding:'28px 24px', fontFamily:'DM Sans,sans-serif', maxWidth:1080 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'2rem', fontWeight:500, color:'#1A1514', marginBottom:2, lineHeight:1.1 }}>Souhaits</h1>
          <p style={{ fontSize:13.5, color:'#7A7470' }}>Le parcours de chaque souhait, de la demande à la réalisation.</p>
        </div>
        {can('souhaits.create') && (
          <Link to="/app/souhaits/nouveau" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'10px 18px', background:'linear-gradient(135deg,#C8435A,#D9566A)', color:'white', textDecoration:'none', borderRadius:10, fontSize:13.5, fontWeight:600, boxShadow:'0 4px 14px rgba(200,67,90,.28)' }}>
            <span style={{ fontSize:16, lineHeight:1 }}>+</span> Nouveau souhait
          </Link>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:4, marginBottom:18 }}>
        {[
          ['actifs','En cours'],
          ...(can('coordinateur') ? [['demandes','Demandes entrantes']] : []),
          ['archives','Archives'],
        ].map(([v, l]) => {
          const on = tab === v
          return (
            <button key={v} onClick={() => { setTab(v); setFiltre('tous') }}
              style={{ padding:'8px 16px', borderRadius:99, border:'none', cursor:'pointer', fontFamily:'DM Sans,sans-serif',
                background: on ? '#1A1514' : 'transparent', color: on ? 'white' : '#7A7470', fontWeight: on?600:500, fontSize:13 }}>
              {l}
            </button>
          )
        })}
      </div>

      {/* Recherche + filtre rapide */}
      <div style={{ display:'flex', gap:10, marginBottom:22, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:'1 1 240px' }}>
          <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'#C8B0B0' }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un bénéficiaire, un souhait…"
            style={{ width:'100%', padding:'10px 12px 10px 34px', border:'1px solid rgba(0,0,0,.08)', borderRadius:10, fontSize:13.5, fontFamily:'DM Sans,sans-serif', background:'white', outline:'none' }} />
        </div>
        {tab !== 'demandes' && can('souhaits.create') && (
          <button onClick={() => setFiltre(filtre === 'mes' ? 'tous' : 'mes')}
            style={{ padding:'9px 16px', borderRadius:10, border:'1px solid', borderColor: filtre==='mes' ? '#C8435A' : 'rgba(0,0,0,.1)', background: filtre==='mes' ? '#FBEAF0' : 'white', color: filtre==='mes' ? '#C8435A' : '#7A7470', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif', whiteSpace:'nowrap' }}>
            ★ Mes souhaits
          </button>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height:74, borderRadius:14, background:'linear-gradient(90deg,#F0EBE6 25%,#E8E0DA 50%,#F0EBE6 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }}/>)}
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState tab={tab} peutCreer={can('souhaits.create')} />
      ) : tab === 'demandes' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {displayed.map(d => <DemandeCard key={d.id} d={d} onCreer={() => navigate(`/app/souhaits/nouveau?from_demande=${d.id}`)} peutCreer={can('souhaits.create')} />)}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:26 }}>
          {groupes.map(({ phase, items }) => (
            <section key={phase.key}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background:phase.color }} />
                <h2 style={{ fontSize:13.5, fontWeight:700, color:'#1A1514', margin:0, letterSpacing:.2 }}>{phase.label}</h2>
                <span style={{ fontSize:12, color:'#A8A39D', background:'#F4F1EC', borderRadius:99, padding:'1px 9px', fontWeight:600 }}>{items.length}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:10 }}>
                {items.map(s => <SouhaitCard key={s.id} s={s} onClick={() => navigate(`/app/souhaits/${s.id}`)} />)}
              </div>
            </section>
          ))}
        </div>
      )}
      <style>{`@keyframes shimmer{to{background-position:-200% 0;}}`}</style>
    </div>
  )
}

// ── Carte d'un souhait ────────────────────────────────────────────────────────
function SouhaitCard({ s, onClick }) {
  const st = STATUTS[s.statut] || { color:'#7A7470', bg:'#F0EFED', label:s.statut }
  const equipe = s.souhait_personnel?.length || 0
  const dateStr = s.date_souhait ? new Date(s.date_souhait).toLocaleDateString('fr-BE',{day:'numeric',month:'short'}) : null
  return (
    <button onClick={onClick}
      style={{ textAlign:'left', width:'100%', background:'white', border:'1px solid rgba(0,0,0,.07)', borderLeft:`4px solid ${st.color}`, borderRadius:13, padding:'14px 16px', cursor:'pointer', fontFamily:'DM Sans,sans-serif', transition:'box-shadow .12s, transform .12s', display:'flex', flexDirection:'column', gap:8 }}
      onMouseEnter={e=>{ e.currentTarget.style.boxShadow='0 6px 18px rgba(0,0,0,.08)'; e.currentTarget.style.transform='translateY(-1px)' }}
      onMouseLeave={e=>{ e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
        <span style={{ fontSize:15, fontWeight:600, color:'#1A1514', lineHeight:1.2 }}>{s.patient_prenom} {s.patient_nom}</span>
        {s.urgence && <span style={{ background:'#FCEBEB', color:'#A32D2D', padding:'2px 8px', borderRadius:99, fontSize:10.5, fontWeight:700, whiteSpace:'nowrap' }}>URGENT</span>}
      </div>
      {s.souhait_description && (
        <p style={{ fontSize:13, color:'#7A7470', margin:0, lineHeight:1.45, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {s.souhait_description}
        </p>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:2, fontSize:12, color:'#A8A39D' }}>
        {s.souhait_lieu && <span>📍 {s.souhait_lieu}</span>}
        {dateStr && <span>📅 {dateStr}</span>}
        <span style={{ marginLeft:'auto', color: equipe>0 ? '#0E7A93' : '#C8435A', fontWeight:600 }}>
          {equipe>0 ? `👥 ${equipe} affecté${equipe>1?'s':''}` : '👥 à affecter'}
        </span>
      </div>
    </button>
  )
}

// ── Carte d'une demande entrante ──────────────────────────────────────────────
function DemandeCard({ d, onCreer, peutCreer }) {
  return (
    <div style={{ background:'white', border:'1px solid rgba(0,0,0,.07)', borderRadius:13, padding:'14px 16px', fontFamily:'DM Sans,sans-serif', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
      <div style={{ flex:'1 1 240px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:15, fontWeight:600, color:'#1A1514' }}>{d.patient_prenom} {d.patient_nom}</span>
          {d.urgence && <span style={{ background:'#FCEBEB', color:'#A32D2D', padding:'2px 8px', borderRadius:99, fontSize:10.5, fontWeight:700 }}>URGENT</span>}
        </div>
        <div style={{ fontSize:12.5, color:'#7A7470', marginTop:2 }}>Demande de {d.contact_prenom} {d.contact_nom} · {new Date(d.created_at).toLocaleDateString('fr-BE')}</div>
        {d.souhait_description && <p style={{ fontSize:13, color:'#4A4340', margin:'6px 0 0', lineHeight:1.45, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{d.souhait_description}</p>}
      </div>
      {peutCreer && (
        <button onClick={onCreer} style={{ padding:'8px 14px', background:'linear-gradient(135deg,#C8435A,#D9566A)', color:'white', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif', whiteSpace:'nowrap' }}>
          Transformer en souhait →
        </button>
      )}
    </div>
  )
}

// ── État vide ─────────────────────────────────────────────────────────────────
function EmptyState({ tab, peutCreer }) {
  const msg = tab === 'demandes' ? 'Aucune demande entrante pour le moment.'
    : tab === 'archives' ? 'Aucun souhait archivé.'
    : 'Aucun souhait en cours.'
  return (
    <div style={{ textAlign:'center', padding:'56px 24px', color:'#A8A39D', fontFamily:'DM Sans,sans-serif' }}>
      <div style={{ fontSize:'2.2rem', marginBottom:12 }}>✺</div>
      <p style={{ fontSize:14.5, color:'#7A7470', margin:0 }}>{msg}</p>
      {tab === 'actifs' && peutCreer && (
        <Link to="/app/souhaits/nouveau" style={{ display:'inline-block', marginTop:14, padding:'9px 18px', background:'#FBEAF0', color:'#C8435A', borderRadius:9, fontSize:13.5, fontWeight:600, textDecoration:'none' }}>
          + Créer le premier souhait
        </Link>
      )}
    </div>
  )
}