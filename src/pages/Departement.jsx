import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
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

  // Le module s'affiche tout de suite. Les onglets du département restent
  // au-dessus (Layout) : un seul module n'ajoute pas un clic de plus.
  const premier = departement.modules[0]
  if (premier) return <Navigate to={premier.to} replace />

  return (
    <Page title={`${departement.icon} ${departement.label}`}>
      <Empty
        title="Aucun module pour le moment"
        hint="Ce département n’a pas encore de module. Il apparaîtra ici dès qu’il sera disponible."
      />
    </Page>
  )
}
