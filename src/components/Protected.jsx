import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import ChangePassword from '@/pages/ChangePassword'
import { moduleAutorise } from '@/navigation'
import { PorteDeuxFacteurs } from '@/components/DeuxFacteurs'

function Splash({ text }) {
  return <div className="ha-shell" style={{ display:'grid', placeItems:'center', color:'var(--text-muted)', fontFamily:'DM Sans,sans-serif' }}>{text}</div>
}

// Réservé au personnel interne
export function RequireStaff({ children }) {
  const { session, loading, can, profile } = useAuth()
  const loc = useLocation()
  // Déjà identifié : ne jamais démonter Layout (rafraîchissement de jeton / onglet).
  if (profile && session && can('staff')) {
    if (profile.doit_changer_mdp) return <ChangePassword />
    return <PorteDeuxFacteurs>{children}</PorteDeuxFacteurs>
  }
  if (loading || (session && !profile)) return <Splash text="Chargement…" />
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (!can('staff')) return <Navigate to="/partenaire" replace />
  return children
}

// Module interne : masqué si le volontaire n'a pas le droit de l'ouvrir.
export function RequireAcces({ feature, children }) {
  const auth = useAuth()
  if (auth.loading && !auth.profile) return <Splash text="Chargement…" />
  if (!moduleAutorise(feature, auth)) return <Navigate to="/app" replace />
  return children
}

// Réservé aux partenaires
export function RequirePartenaire({ children }) {
  const { session, loading, can, profile } = useAuth()
  if (profile && session && can('partenaire')) return <PorteDeuxFacteurs>{children}</PorteDeuxFacteurs>
  if (loading || (session && !profile)) return <Splash text="Chargement…" />
  if (!session) return <Navigate to="/login/partenaire" replace />
  if (profile?.role === 'partenaire') return <Navigate to="/login/partenaire" replace />
  if (!can('partenaire')) return <Navigate to="/app" replace />
  return children
}
