import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Empty, Page } from '@/components/ui'
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
    <Page title={`${departement.icon} ${departement.label}`}>
      {departement.modules.length === 0 ? (
        <Empty
          title="Aucun module pour le moment"
          hint="Ce département n’a pas encore de module. Il apparaîtra ici dès qu’il sera disponible."
        />
      ) : (
        <nav className="ha-garde" aria-label={departement.label}>
          {departement.modules.map(m => (
            <Link key={m.key} to={m.to} className="ha-garde-tuile">
              <span className="ha-garde-ico" aria-hidden>{m.icon}</span>
              <span className="ha-garde-nom">{m.label}</span>
              {m.desc && <span className="ha-garde-desc">{m.desc}</span>}
            </Link>
          ))}
        </nav>
      )}
    </Page>
  )
}
