import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, Empty, Loading } from '@/components/ui'

const CARDS = [
  { to:'/app/missions',      key:'missions',      icon:'🚑', label:'Mes missions',   desc:'Terrain : checklists, démarrer, terminer' },
  { to:'/app/souhaits',      key:'souhaits',      icon:'⭐', label:'Souhaits',       desc:'Encoder et préparer les dossiers' },
  { to:'/app/defraiements',  key:'defraiements',  icon:'🧾', label:'Défraiements',   desc:'Frais, validation, paiement' },
  { to:'/app/disponibilites',key:'disponibilites',icon:'📅', label:'Disponibilités', desc:'Votre agenda' },
  { to:'/app/stock',         key:'stock',         icon:'📦', label:'Stock',          desc:'Matériel et mouvements' },
  { to:'/app/annuaire',      key:'annuaire',      icon:'📇', label:'Annuaire',       desc:'Contacts et institutions' },
]

export default function Dashboard() {
  const { profile, canAccess } = useAuth()
  const [missions, setMissions] = useState(null)
  const cartes = CARDS.filter(c => canAccess(c.key))
  const date = new Date().toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long' })

  useEffect(() => {
    supabase.rpc('mes_affectations').then(({ data }) => setMissions(data || []))
  }, [])

  const aVenir = (missions || []).filter(m => m.statut !== 'realise' && m.statut !== 'non_realise').slice(0, 3)

  return (
    <div style={{ padding:'clamp(16px,3vw,28px)', width:'100%', boxSizing:'border-box' }}>
      <h1 style={{ fontSize:'1.9rem', color:'var(--heading)', marginBottom:4 }}>Bonjour {profile?.prenom || ''}</h1>
      <p style={{ color:'var(--text-muted)', marginBottom:22, textTransform:'capitalize' }}>{date}</p>

      {missions === null ? <Loading /> : aVenir.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>Vos prochaines missions</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {aVenir.map(m => (
              <Link key={m.souhait_id} to="/app/missions" style={{ textDecoration:'none' }}>
                <Card clickable style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontWeight:600, color:'var(--text)' }}>Mission — {m.beneficiaire_prenom}</div>
                      <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2 }}>
                        {m.date_souhaitee ? new Date(m.date_souhaitee).toLocaleDateString('fr-BE') : 'Date à définir'}
                        {m.vehicule ? ` · ${m.vehicule}` : ''}
                      </div>
                    </div>
                    <span style={{ color:'var(--accent)', fontWeight:600, fontSize:13 }}>Ouvrir ›</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {missions && missions.length === 0 && canAccess('missions') && (
        <div style={{ marginBottom:24 }}>
          <Empty title="Aucune mission affectée" hint="Quand la coordination vous affectera à un souhait, il apparaîtra ici et dans Mes missions." />
        </div>
      )}

      <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>Accès rapides</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
        {cartes.map(c => (
          <Link key={c.to} to={c.to} className="ha-click" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'18px 16px', textDecoration:'none', display:'block' }}>
            <div style={{ fontSize:'1.8rem', marginBottom:8 }}>{c.icon}</div>
            <div style={{ fontSize:14.5, fontWeight:600, color:'var(--text)' }}>{c.label}</div>
            <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:3 }}>{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
