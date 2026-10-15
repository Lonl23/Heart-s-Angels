import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Card, Empty } from '@/components/ui'
import { DEPARTEMENTS, filtrerDepartements, moduleAutorise } from '@/navigation'

export default function Departement() {
  const { id } = useParams()
  const auth = useAuth()
  const departement = useMemo(
    () => filtrerDepartements(DEPARTEMENTS, key => moduleAutorise(key, auth)).find(d => d.id === id) || null,
    [id, auth],
  )

  if (!departement) return <Navigate to="/app" replace />

  return (
    <div style={{ padding:'clamp(16px,3vw,28px)', width:'100%', boxSizing:'border-box' }}>
      <Link to="/app" style={{ display:'inline-block', marginBottom:14, fontSize:13.5, fontWeight:600, textDecoration:'none' }}>
        ‹ Tous les départements
      </Link>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
        <span style={{ fontSize:'2rem', lineHeight:1 }} aria-hidden>{departement.icon}</span>
        <div>
          <h1 style={{ fontSize:'1.9rem', color:'var(--heading)', margin:0 }}>{departement.label}</h1>
          {departement.modules.length > 0 && (
            <p style={{ color:'var(--text-muted)', margin:'4px 0 0', fontSize:13.5 }}>Choisissez le module qui vous correspond.</p>
          )}
        </div>
      </div>

      {departement.modules.length === 0 ? (
        <Empty
          title="Aucun module pour le moment"
          hint="Ce département n’a pas encore de module. Il apparaîtra ici dès qu’il sera disponible."
        />
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14 }}>
          {departement.modules.map(m => (
            <Link key={m.key} to={m.to} style={{ textDecoration:'none', color:'inherit' }}>
              <Card clickable style={{ display:'flex', gap:12, alignItems:'flex-start', minHeight:96 }}>
                <span style={{ fontSize:'1.6rem', lineHeight:1 }} aria-hidden>{m.icon}</span>
                <span style={{ minWidth:0 }}>
                  <span style={{ display:'block', fontWeight:600, fontSize:15, color:'var(--text)' }}>{m.label}</span>
                  <span style={{ display:'block', fontSize:12.5, color:'var(--text-muted)', marginTop:4 }}>{m.desc}</span>
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
