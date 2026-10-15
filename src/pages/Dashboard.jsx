import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, Empty, Loading } from '@/components/ui'
import { DEPARTEMENTS, cheminDepartement, filtrerDepartements } from '@/navigation'

export default function Dashboard() {
  const { profile, peutOuvrir, canAccess } = useAuth()
  const [missions, setMissions] = useState(null)
  const departements = useMemo(() => filtrerDepartements(DEPARTEMENTS, peutOuvrir), [peutOuvrir])
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
              <Link key={m.souhait_id} to={`/app/missions/${m.souhait_id}`} style={{ textDecoration:'none' }}>
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
          <Empty title="Aucune mission affectée" hint="Quand la coordination vous affectera à un souhait, il apparaîtra ici et dans Mes souhaits." />
        </div>
      )}

      <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>Que voulez-vous faire ?</div>
      {departements.length === 0 ? (
        <Empty title="Aucun département" hint="Aucun département ne vous est ouvert pour le moment." />
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
          {departements.map(d => (
            <Link key={d.id} to={cheminDepartement(d)} style={{ textDecoration:'none', color:'inherit' }}>
              <Card clickable style={{ display:'flex', alignItems:'center', gap:12, minHeight:88 }}>
                <span style={{ fontSize:'1.8rem', lineHeight:1 }} aria-hidden>{d.icon}</span>
                <span style={{ flex:1, minWidth:0, fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:'1.35rem', color:'var(--heading)', lineHeight:1.15 }}>{d.label}</span>
                <span style={{ color:'var(--accent)', fontWeight:600, fontSize:13, flexShrink:0 }}>Choisir ›</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
