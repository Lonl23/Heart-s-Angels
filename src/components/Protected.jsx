import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import ChangePassword from '@/pages/ChangePassword'

function Splash({ text }) {
  return <div style={{ display:'grid', placeItems:'center', height:'100vh', color:'var(--text-muted)', fontFamily:'DM Sans,sans-serif' }}>{text}</div>
}

// Réservé au personnel interne
export function RequireStaff({ children }) {
  const { session, loading, can, profile } = useAuth()
  const loc = useLocation()
  // Déjà identifié : ne jamais démonter Layout (rafraîchissement de jeton / onglet).
  if (profile && session && can('staff')) {
    if (profile.doit_changer_mdp) return <ChangePassword />
    return children
  }
  if (loading || (session && !profile)) return <Splash text="Chargement…" />
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (!can('staff')) return <Navigate to="/partenaire" replace />
  return children
}

// Réservé aux partenaires
export function RequirePartenaire({ children }) {
  const { session, loading, can, profile } = useAuth()
  if (profile && session && can('partenaire')) return children
  if (loading || (session && !profile)) return <Splash text="Chargement…" />
  if (!session) return <Navigate to="/login" replace />
  if (!can('partenaire')) return <Navigate to="/app" replace />
  return children
}
