import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Page } from '@/components/ui'
import Apparence from '@/modules/admin/Apparence'

export default function Personnalisation() {
  const { peutPersonnaliser } = useAuth()
  if (!peutPersonnaliser()) return <Navigate to="/app" replace />
  return (
    <Page
      title="Personnalisation"
      subtitle="Équipe informatique. Une photo de fond pour chaque page et chaque module."
    >
      <Apparence />
    </Page>
  )
}
