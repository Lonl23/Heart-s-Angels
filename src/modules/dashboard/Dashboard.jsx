// src/modules/dashboard/Dashboard.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export default function Dashboard() {
  const { profile, can } = useAuth()
  const [kpis, setKpis]   = useState({})
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date().toISOString()
      const [
        { count: souhaitsEnCours },
        { count: demandesNouvelles },
        { count: defEnAttente },
        { count: dispoSemaine },
        { count: candidatures },
        { data: notifications },
      ] = await Promise.all([
        supabase.from('souhaits').select('*', { count: 'exact', head: true }).in('statut', ['planifie', 'en_cours']),
        supabase.from('demandes_souhaits').select('*', { count: 'exact', head: true }).eq('statut', 'nouvelle'),
        supabase.from('defraiements').select('*', { count: 'exact', head: true }).eq('statut', 'soumis'),
        supabase.from('disponibilites').select('*', { count: 'exact', head: true }).gte('date_debut', now).lte('date_debut', new Date(Date.now() + 7*864e5).toISOString()),
        supabase.from('candidatures_benevoles').select('*', { count: 'exact', head: true }).eq('statut', 'nouvelle'),
        supabase.from('notifications').select('*, profiles(prenom,nom)').eq('destinataire_id', profile?.id).eq('lu', false).order('created_at', { ascending: false }).limit(8),
      ])
      setKpis({ souhaitsEnCours, demandesNouvelles, defEnAttente, dispoSemaine, candidatures })
      setNotifs(notifications || [])
      setLoading(false)
    }
    if (profile?.id) load()
  }, [profile?.id])

  async function markRead(id) {
    await supabase.from('notifications').update({ lu: true }).eq('id', id)
    setNotifs(n => n.filter(x => x.id !== id))
  }

  const cards = [
    { icon:'❤️', label:'Souhaits actifs',       val: kpis.souhaitsEnCours,  to:'/app/souhaits',     color:'#C8435A', bg:'#FBEAF0', show: true },
    { icon:'📋', label:'Nouvelles demandes',     val: kpis.demandesNouvelles,to:'/app/souhaits',     color:'#185FA5', bg:'#E6F1FB', show: can('souhaits.read') },
    { icon:'💶', label:'Défraiements en attente',val: kpis.defEnAttente,     to:'/app/defraiements', color:'#BA7517', bg:'#FAEEDA', show: can('defraiements.validate') },
    { icon:'📅', label:'Disponibilités (7j)',    val: kpis.dispoSemaine,     to:'/app/disponibilites',color:'#3B6D11',bg:'#EAF3DE', show: true },
    { icon:'🙋', label:'Candidatures nouvelles', val: kpis.candidatures,     to:'/app/volontaires',  color:'#534AB7', bg:'#EEEDFE', show: can('volontaires.read') },
  ].filter(c => c.show)

  const shortcuts = [
    { icon:'❤️', label:'Nouveau souhait',    to:'/app/souhaits/nouveau',     show: can('souhaits.create') },
    { icon:'📅', label:'Ma disponibilité',   to:'/app/disponibilites',       show: true },
    { icon:'💶', label:'Demande défraiement',to:'/app/defraiements',         show: true },
    { icon:'💶', label:'Comptabilité',       to:'/app/comptabilite',         show: can('seeFinances') },
    { icon:'🏪', label:'Point de vente',     to:'/app/vente',                show: can('vente.create') },
    { icon:'👥', label:'Volontaires',        to:'/app/volontaires',          show: can('volontaires.read') },
    { icon:'📦', label:'Stock boutique',     to:'/app/stock',                show: can('stock.read') },
    { icon:'🏗️', label:'Organigramme',       to:'/app/organigramme',         show: true },
  ].filter(s => s.show)

  return (
    <div style={{ padding:'28px 24px', fontFamily:'DM Sans,sans-serif', maxWidth:1100 }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.9rem', fontWeight:500, color:'#1A1514', marginBottom:4 }}>
          Bonjour, {profile?.prenom} 👋
        </h1>
        <p style={{ fontSize:13.5, color:'#7A7470' }}>
          {new Date().toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14, marginBottom:32 }}>
        {loading ? Array(4).fill(0).map((_,i) => <SkeletonCard key={i} />) :
          cards.map((c, i) => (
            <Link key={i} to={c.to} style={{ display:'block', background:'white', border:`1px solid ${c.color}22`, borderRadius:14, padding:'18px 16px', textDecoration:'none', boxShadow:'0 1px 6px rgba(200,67,90,.04)', transition:'transform .12s, box-shadow .12s' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 6px 20px ${c.color}22` }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 1px 6px rgba(200,67,90,.04)' }}
            >
              <div style={{ width:40, height:40, borderRadius:10, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, marginBottom:12 }}>{c.icon}</div>
              <div style={{ fontSize:'1.7rem', fontWeight:700, color:c.color, lineHeight:1, marginBottom:4 }}>{c.val ?? '—'}</div>
              <div style={{ fontSize:12, color:'#7A7470', lineHeight:1.4 }}>{c.label}</div>
            </Link>
          ))
        }
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
        {/* Accès rapides */}
        <div style={{ background:'white', border:'1px solid rgba(200,67,90,.09)', borderRadius:16, padding:'20px 18px', boxShadow:'0 1px 8px rgba(200,67,90,.05)' }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:'#1A1514', marginBottom:16 }}>Accès rapides</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10 }}>
            {shortcuts.map((s, i) => (
              <Link key={i} to={s.to} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'14px 10px', background:'#FDFAF6', border:'1px solid rgba(200,67,90,.09)', borderRadius:12, textDecoration:'none', transition:'all .12s' }}
                onMouseEnter={e => { e.currentTarget.style.background='#FBEAF0'; e.currentTarget.style.borderColor='rgba(200,67,90,.25)' }}
                onMouseLeave={e => { e.currentTarget.style.background='#FDFAF6'; e.currentTarget.style.borderColor='rgba(200,67,90,.09)' }}
              >
                <span style={{ fontSize:'1.5rem' }}>{s.icon}</span>
                <span style={{ fontSize:12, color:'#4A4340', fontWeight:500, textAlign:'center', lineHeight:1.3 }}>{s.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div style={{ background:'white', border:'1px solid rgba(200,67,90,.09)', borderRadius:16, padding:'20px 18px', boxShadow:'0 1px 8px rgba(200,67,90,.05)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h3 style={{ fontSize:14, fontWeight:600, color:'#1A1514', margin:0 }}>Notifications</h3>
            {notifs.length > 0 && (
              <span style={{ background:'#C8435A', color:'white', fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:99, minWidth:18, textAlign:'center' }}>{notifs.length}</span>
            )}
          </div>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[1,2,3].map(i => <div key={i} style={{ height:56, borderRadius:10, background:'linear-gradient(90deg,#F0EBE6 25%,#E8E0DA 50%,#F0EBE6 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }}/>)}
            </div>
          ) : notifs.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'#7A7470', fontSize:13 }}>
              <div style={{ fontSize:'1.8rem', marginBottom:6 }}>✅</div>
              Aucune notification non lue
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {notifs.map(n => (
                <div key={n.id} style={{ background:'#FDFAF6', border:'1px solid rgba(200,67,90,.08)', borderRadius:10, padding:'10px 12px', display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#C8435A', flexShrink:0, marginTop:5 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12.5, color:'#1A1514', fontWeight:500, lineHeight:1.4 }}>{n.titre}</div>
                    {n.message && <div style={{ fontSize:11.5, color:'#7A7470', marginTop:2, lineHeight:1.4 }}>{n.message}</div>}
                    <div style={{ fontSize:11, color:'#A8A39D', marginTop:3 }}>
                      {new Date(n.created_at).toLocaleDateString('fr-BE', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                  <button onClick={() => markRead(n.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#C8B0B0', fontSize:14, padding:'1px', flexShrink:0 }}>✓</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer { to { background-position: -200% 0; } }
        @media(max-width:900px) { [style*='grid-template-columns: 1fr 320px'] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}

function SkeletonCard() {
  return <div style={{ height:110, borderRadius:14, background:'linear-gradient(90deg,#F0EBE6 25%,#E8E0DA 50%,#F0EBE6 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }}/>
}
