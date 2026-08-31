import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import ChangePassword from '@/pages/ChangePassword'

function Splash({ text }) {
  return <div style={{ display:'grid', placeItems:'center', height:'100vh', color:'var(--text-muted)', fontFamily:'DM Sans,sans-serif' }}>{text}</div>
}

// Réservé au personnel interne
export function RequireStaff({ children }) {
  const { session, loading, can, profile } = useAuth()
  if (loading) return <Splash text="Chargement…" />
  if (!session) return <Navigate to="/login" replace />
  if (!can('staff')) return <Navigate to="/partenaire" replace />
  if (profile?.doit_changer_mdp) return <ChangePassword />
  return children
}

// Réservé aux partenaires
export function RequirePartenaire({ children }) {
  const { session, loading, can } = useAuth()
  if (loading) return <Splash text="Chargement…" />
  if (!session) return <Navigate to="/login" replace />
  if (!can('partenaire')) return <Navigate to="/app" replace />
  return children
}
