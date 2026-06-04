// src/modules/souhaits/Souhaits.jsx
import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth, PHASES_RECOLTEUR } from '@/hooks/useAuth'
import DetailSouhait from './DetailSouhait'
import FormSouhait   from './FormSouhait'

const STATUTS = {
  nouvelle:       { label:'Nouvelle demande', color:'#185FA5', bg:'#E6F1FB' },
  urgente:        { label:'Urgente',          color:'#A32D2D', bg:'#FCEBEB' },
  en_attente:     { label:'En attente',       color:'#BA7517', bg:'#FAEEDA' },
  planifie:       { label:'Planifié',         color:'#3B6D11', bg:'#EAF3DE' },
  en_cours:       { label:'En cours',         color:'#C8435A', bg:'#FBEAF0' },
  realise:        { label:'Réalisé',          color:'#3B6D11', bg:'#EAF3DE' },
  annule:         { label:'Annulé',           color:'#7A7470', bg:'#F0EFED' },
}

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
        q = q.in('statut', ['planifie','en_cours'])
      } else if (access === 'none') {
        setItems([]); setLoading(false); return
      }
      // access === 'all' → pas de filtre supplémentaire

      if (tab === 'archives') q = q.in('statut', ['realise','annule'])
      else if (access === 'all') q = q.not('statut', 'in', '("realise","annule")')

      if (filtre !== 'tous' && filtre !== 'mes') q = q.eq('statut', filtre)
      if (filtre === 'mes') q = q.eq('created_by', profile?.id)

      let { data, error } = await q
      if (error) {
        console.warn('souhaits load erreur:', error.message)
        // Fallback : recharger sans l'embed souhait_personnel
        let q2 = supabase.from('souhaits').select('*').order('created_at', { ascending: false })
        if (access === 'avant_realisation') q2 = q2.in('statut', PHASES_RECOLTEUR)
        else if (access === 'affecte')      q2 = q2.in('statut', ['planifie','en_cours'])
        if (tab === 'archives') q2 = q2.in('statut', ['realise','annule'])
        else if (access === 'all') q2 = q2.not('statut', 'in', '("realise","annule")')
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

  return (
    <div style={{ padding:'28px 24px', fontFamily:'DM Sans,sans-serif', maxWidth:1100 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.8rem', fontWeight:500, color:'#1A1514', marginBottom:2 }}>Souhaits</h1>
          <p style={{ fontSize:13, color:'#7A7470' }}>Gestion des souhaits et demandes entrantes</p>
        </div>
        {can('souhaits.create') && (
          <Link to="/app/souhaits/nouveau" style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', background:'linear-gradient(135deg,#C8435A,#D9566A)', color:'white', textDecoration:'none', borderRadius:9, fontSize:13.5, fontWeight:600, boxShadow:'0 2px 10px rgba(200,67,90,.3)' }}>
            + Nouveau souhait
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid rgba(200,67,90,.1)', marginBottom:20 }}>
        {[
          ['actifs','❤️ Actifs'],
          ...(can('coordinateur') ? [['demandes','📋 Demandes entrantes']] : []),
          ['archives','🗄️ Archives'],
        ].map(([v, l]) => (
          <button key={v} onClick={() => { setTab(v); setFiltre('tous') }} style={{ padding:'9px 18px', background:'none', border:'none', borderBottom:`2px solid ${tab===v ? '#C8435A' : 'transparent'}`, color: tab===v ? '#C8435A' : '#7A7470', fontWeight: tab===v ? 600 : 400, fontSize:13.5, cursor:'pointer', fontFamily:'DM Sans,sans-serif', position:'relative', bottom:-1 }}>
            {l}
          </button>
        ))}
      </div>

      {/* Filtres statut */}
      {tab !== 'demandes' && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
          {[['tous','Tous'],...Object.entries(STATUTS),['mes','Mes souhaits']].map(([k, v]) => {
            const label = typeof v === 'object' ? v.label : v
            const active = filtre === k
            return (
              <button key={k} onClick={() => setFiltre(k)} style={{ padding:'5px 13px', borderRadius:99, border:'1px solid', borderColor: active ? '#C8435A' : 'rgba(200,67,90,.15)', background: active ? '#C8435A' : 'white', color: active ? 'white' : '#7A7470', fontSize:12.5, fontWeight: active?600:400, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div style={{ position:'relative', marginBottom:20 }}>
        <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'#C8B0B0' }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un patient, un souhait…" style={{ width:'100%', padding:'9px 12px 9px 36px', border:'1px solid rgba(200,67,90,.12)', borderRadius:9, fontSize:13.5, fontFamily:'DM Sans,sans-serif', background:'white' }} />
      </div>

      {/* Tableau */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ height:56, borderRadius:10, background:'linear-gradient(90deg,#F0EBE6 25%,#E8E0DA 50%,#F0EBE6 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }}/>)}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px', color:'#7A7470', fontSize:15 }}>
          <div style={{ fontSize:'2.5rem', marginBottom:10 }}>🔍</div>
          Aucun élément trouvé.
        </div>
      ) : tab === 'demandes' ? (
        // Tableau demandes entrantes
        <div style={{ background:'white', border:'1px solid rgba(200,67,90,.09)', borderRadius:14, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
            <thead>
              <tr style={{ background:'#FDFAF6', borderBottom:'1px solid rgba(200,67,90,.1)' }}>
                {['Date','Patient','Contact','Souhait','Urgence','Actions'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((d, i) => (
                <tr key={d.id} style={{ borderBottom:'1px solid rgba(200,67,90,.06)', transition:'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background='#FDFAF6'}
                  onMouseLeave={e => e.currentTarget.style.background='white'}
                >
                  <td style={{ padding:'10px 14px', color:'#7A7470', whiteSpace:'nowrap' }}>{new Date(d.created_at).toLocaleDateString('fr-BE')}</td>
                  <td style={{ padding:'10px 14px', fontWeight:500, color:'#1A1514' }}>{d.patient_prenom} {d.patient_nom}</td>
                  <td style={{ padding:'10px 14px', color:'#4A4340' }}><div>{d.contact_prenom} {d.contact_nom}</div><div style={{ fontSize:12, color:'#7A7470' }}>{d.contact_email}</div></td>
                  <td style={{ padding:'10px 14px', color:'#4A4340', maxWidth:200 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.souhait_description?.slice(0,60)}{d.souhait_description?.length>60?'…':''}</div></td>
                  <td style={{ padding:'10px 14px' }}>{d.urgence ? <span style={{ background:'#FCEBEB', color:'#A32D2D', padding:'2px 8px', borderRadius:99, fontSize:11.5, fontWeight:600 }}>⚠️ Urgent</span> : <span style={{ color:'#C0BAB4', fontSize:12 }}>—</span>}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <button onClick={() => navigate(`/app/souhaits/nouveau?from_demande=${d.id}`)} style={{ padding:'5px 12px', background:'linear-gradient(135deg,#C8435A,#D9566A)', color:'white', border:'none', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
                      Créer souhait →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Tableau souhaits
        <div style={{ background:'white', border:'1px solid rgba(200,67,90,.09)', borderRadius:14, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
            <thead>
              <tr style={{ background:'#FDFAF6', borderBottom:'1px solid rgba(200,67,90,.1)' }}>
                {['Statut','Patient','Souhait','Date','Équipe','Actions'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'#7A7470', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((s) => {
                const st = STATUTS[s.statut] || { label:s.statut, color:'#7A7470', bg:'#F0EFED' }
                return (
                  <tr key={s.id} style={{ borderBottom:'1px solid rgba(200,67,90,.06)', cursor:'pointer', transition:'background .1s' }}
                    onClick={() => navigate(`/app/souhaits/${s.id}`)}
                    onMouseEnter={e => e.currentTarget.style.background='#FDFAF6'}
                    onMouseLeave={e => e.currentTarget.style.background='white'}
                  >
                    <td style={{ padding:'10px 14px' }}><span style={{ background:st.bg, color:st.color, padding:'3px 9px', borderRadius:99, fontSize:11.5, fontWeight:600, whiteSpace:'nowrap' }}>{st.label}</span></td>
                    <td style={{ padding:'10px 14px', fontWeight:500, color:'#1A1514' }}>{s.patient_prenom} {s.patient_nom}</td>
                    <td style={{ padding:'10px 14px', color:'#4A4340', maxWidth:220 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.souhait_description?.slice(0,60)}{s.souhait_description?.length>60?'…':''}</div></td>
                    <td style={{ padding:'10px 14px', color:'#7A7470', whiteSpace:'nowrap' }}>{s.date_souhait ? new Date(s.date_souhait).toLocaleDateString('fr-BE') : '—'}</td>
                    <td style={{ padding:'10px 14px', color:'#7A7470' }}>{s.souhait_personnel?.length || 0} pers.</td>
                    <td style={{ padding:'10px 14px' }} onClick={e => e.stopPropagation()}>
                      <Link to={`/app/souhaits/${s.id}`} style={{ padding:'4px 10px', background:'#FBEAF0', color:'#C8435A', borderRadius:7, fontSize:12.5, fontWeight:600, textDecoration:'none' }}>Voir</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <style>{`@keyframes shimmer{to{background-position:-200% 0;}}`}</style>
    </div>
  )
}