import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { user, profile, loading, can, retryProfile } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={C}>
        <div style={SP} />
        <span style={{ fontSize:13, color:'#7A7470' }}>Chargement…</span>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Profil absent mais user connecté → on laisse passer avec un avertissement
  // (le fallback dans useAuth garantit qu'on arrive jamais ici normalement)
  if (!profile) {
    return (
      <div style={C}>
        <div style={{ fontSize:'2rem', marginBottom:12 }}>⚠️</div>
        <div style={{ fontSize:14, fontWeight:600, color:'#1A1514', marginBottom:6 }}>Profil introuvable</div>
        <div style={{ fontSize:13, color:'#7A7470', marginBottom:18, maxWidth:300, textAlign:'center' }}>
          Impossible de charger votre profil. Vérifiez que votre compte existe dans la base de données.
        </div>
        <button onClick={retryProfile} style={BTN_BLUE}>Réessayer</button>
        <button onClick={() => import('@/lib/supabase').then(m => m.supabase.auth.signOut())}
          style={{ ...BTN_GHOST, marginTop:8 }}>
          Se déconnecter
        </button>
      </div>
    )
  }

  if (profile.actif === false) {
    return (
      <div style={C}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:'#FCEBEB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, marginBottom:14 }}>🔒</div>
        <div style={{ fontSize:15, fontWeight:600, color:'#1A1514', marginBottom:6 }}>Compte désactivé</div>
        <div style={{ fontSize:13, color:'#7A7470', maxWidth:280, textAlign:'center', marginBottom:18 }}>
          Contactez un administrateur pour rétablir votre accès.
        </div>
        <button onClick={() => import('@/lib/supabase').then(m => m.supabase.auth.signOut())}
          style={{ ...BTN_BLUE, background:'#C8435A' }}>
          Se déconnecter
        </button>
      </div>
    )
  }

  if (requiredRole && !can(requiredRole)) {
    return <Navigate to="/app/dashboard" replace />
  }

  return children
}

const C = {
  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
  minHeight:'100vh', gap:6, background:'#F8F4F0',
  fontFamily:"'DM Sans',sans-serif", padding:24,
}
const SP = {
  width:36, height:36, border:'3px solid rgba(27,176,206,.2)',
  borderTopColor:'#1BB0CE', borderRadius:'50%',
  animation:'sp .8s linear infinite', marginBottom:8,
}
const BTN_BLUE = {
  padding:'10px 24px', background:'#1BB0CE', color:'white',
  border:'none', borderRadius:9, fontSize:14, fontWeight:600,
  cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
}
const BTN_GHOST = {
  padding:'8px 20px', background:'none',
  border:'1px solid rgba(0,0,0,.1)', borderRadius:9,
  fontSize:13, cursor:'pointer', color:'#7A7470',
  fontFamily:"'DM Sans',sans-serif",
}