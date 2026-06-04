import { useParams, Link, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '../i18n/index.jsx'

export default function EvenementDetail() {
  const { slug } = useParams()
  const { raw } = useI18n()
  const lang = raw?.lang || 'fr'
  const [ev, setEv] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('evenements_publics').select('*').eq('slug', slug).eq('publie', true).single()
      .then(({ data }) => { setEv(data); setLoading(false) })
  }, [slug])

  if (loading) return <div style={{ minHeight:'50vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#1BB0CE', fontFamily:'DM Sans,sans-serif' }}>Chargement…</div>
  if (!ev) return <Navigate to="/evenements" replace />

  const titre = ev[`titre_${lang}`] || ev.titre_fr
  const desc  = ev[`desc_${lang}`]  || ev.desc_fr || ''
  const d = new Date(ev.date_debut)

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <section style={{ background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)', padding:'60px 20px 0', position:'relative', overflow:'hidden' }}>
        {ev.image_url && <div style={{ position:'absolute', inset:0, background:`url(${ev.image_url}) center/cover`, opacity:.2 }}/>}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(10,30,45,.9),rgba(14,74,90,.7))' }}/>
        <div style={{ position:'relative', zIndex:1, maxWidth:860, margin:'0 auto' }}>
          <Link to="/evenements" style={{ display:'inline-flex', alignItems:'center', gap:6, color:'rgba(255,255,255,.6)', textDecoration:'none', fontSize:13, marginBottom:20 }}>← Retour aux événements</Link>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginBottom:10 }}>📅 {d.toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}{ev.heure && ` · 🕐 ${ev.heure}`}</div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.8rem,4vw,3rem)', fontWeight:500, color:'white', lineHeight:1.2, marginBottom:16 }}>{titre}</h1>
          {ev.lieu && <div style={{ color:'rgba(255,255,255,.6)', fontSize:14, marginBottom:32 }}>📍 {ev.lieu}</div>}
        </div>
      </section>

      <section style={{ padding:'52px 20px 80px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>
          {ev.image_url && <img src={ev.image_url} alt={titre} style={{ width:'100%', maxHeight:380, objectFit:'cover', borderRadius:14, marginBottom:32 }}/>}
          <div style={{ fontSize:15, color:'#1A1514', lineHeight:1.9, whiteSpace:'pre-line', marginBottom:32 }}>{desc}</div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:28 }}>
            {ev.gratuit ? <span style={{ background:'#EAF3DE', color:'#3B6D11', padding:'6px 14px', borderRadius:8, fontSize:14, fontWeight:600 }}>✓ Gratuit</span>
              : ev.prix_adulte > 0 && <span style={{ background:'#E6F7FA', color:'#1BB0CE', padding:'6px 14px', borderRadius:8, fontSize:14, fontWeight:600 }}>Adulte : {ev.prix_adulte} €</span>
            }
            {ev.prix_enfant > 0 && <span style={{ background:'#E6F7FA', color:'#1BB0CE', padding:'6px 14px', borderRadius:8, fontSize:14, fontWeight:600 }}>Enfant : {ev.prix_enfant} €</span>}
          </div>
          <Link to="/contact" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px', background:'#1BB0CE', color:'white', borderRadius:9, textDecoration:'none', fontSize:14, fontWeight:600, boxShadow:'0 3px 14px rgba(27,176,206,.3)' }}>
            📝 S'inscrire / Contacter
          </Link>
        </div>
      </section>
    </div>
  )
}