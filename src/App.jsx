import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import Layout from '@/components/layout/Layout'
import Login from '@/modules/auth/Login'
import Dashboard from '@/modules/dashboard/Dashboard'

// Lazy imports pour code splitting
import { lazy, Suspense } from 'react'
const Disponibilites = lazy(() => import('@/modules/disponibilites/Disponibilites'))
const Souhaits       = lazy(() => import('@/modules/souhaits/Souhaits'))
const Comptabilite   = lazy(() => import('@/modules/comptabilite/Comptabilite'))
const Vente          = lazy(() => import('@/modules/vente/Vente'))
const Volontaires    = lazy(() => import('@/modules/volontaires/Volontaires'))
const Defraiements   = lazy(() => import('@/modules/defraiements/Defraiements'))
const Organigramme   = lazy(() => import('@/modules/organigramme/Organigramme'))

function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading, can } = useAuth()
  if (loading) return <div className="loading-screen">Chargement…</div>
  if (!user)   return <Navigate to="/login" replace />

  // Vérification du rôle si requis
  if (requiredRole && !can[requiredRole]) {
    return <Navigate to="/" replace />
  }
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="disponibilites" element={
          <Suspense fallback={<div className="loading">Chargement…</div>}>
            <Disponibilites />
          </Suspense>
        } />
        <Route path="souhaits/*" element={
          <Suspense fallback={<div className="loading">Chargement…</div>}>
            <Souhaits />
          </Suspense>
        } />
        <Route path="comptabilite/*" element={
          <ProtectedRoute requiredRole="seeFinances">
            <Suspense fallback={<div className="loading">Chargement…</div>}>
              <Comptabilite />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="vente" element={
          <ProtectedRoute requiredRole="coordinateur">
            <Suspense fallback={<div className="loading">Chargement…</div>}>
              <Vente />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="volontaires" element={
          <ProtectedRoute requiredRole="coordinateur">
            <Suspense fallback={<div className="loading">Chargement…</div>}>
              <Volontaires />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="defraiements" element={
          <Suspense fallback={<div className="loading">Chargement…</div>}>
            <Defraiements />
          </Suspense>
        } />
        <Route path="organigramme" element={
          <Suspense fallback={<div className="loading">Chargement…</div>}>
            <Organigramme />
          </Suspense>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
