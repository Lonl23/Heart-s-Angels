// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Logiciel propriétaire. Voir LICENSE. Mention à ne pas retirer.
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireStaff, RequirePartenaire } from '@/components/Protected'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const DemandeSouhait = lazy(() => import('@/pages/DemandeSouhait'))
const Inscription = lazy(() => import('@/pages/Inscription'))
const PartenairePortail = lazy(() => import('@/pages/PartenairePortail'))
const Stub = lazy(() => import('@/modules/Stub'))
const Souhaits = lazy(() => import('@/modules/souhaits/Souhaits'))
const Disponibilites = lazy(() => import('@/modules/Disponibilites'))
const Stock = lazy(() => import('@/modules/Stock'))
const Admin = lazy(() => import('@/modules/Admin'))
const FicheVolontaire = lazy(() => import('@/modules/fiche/FicheVolontaire'))
const MesMissions = lazy(() => import('@/modules/MesMissions'))
const Annuaire = lazy(() => import('@/modules/annuaire/Annuaire'))

function EcranChargement() {
  return (
    <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>Chargement…</div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<EcranChargement />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/demande" element={<DemandeSouhait />} />
        <Route path="/inscription" element={<Inscription />} />

        <Route path="/app" element={<RequireStaff><Layout /></RequireStaff>}>
          <Route index element={<Dashboard />} />
          <Route path="souhaits/nouveau" element={<Souhaits />} />
          <Route path="souhaits/:id/preparer" element={<Souhaits />} />
          <Route path="souhaits/:id" element={<Souhaits />} />
          <Route path="souhaits" element={<Souhaits />} />
          <Route path="missions/:id" element={<MesMissions />} />
          <Route path="missions" element={<MesMissions />} />
          <Route path="defraiements"   element={<Stub nom="Défraiements" />} />
          <Route path="disponibilites" element={<Disponibilites />} />
          <Route path="stock"          element={<Stock />} />
          <Route path="annuaire"       element={<Annuaire />} />
          <Route path="admin"          element={<Admin />} />
          <Route path="profil"         element={<FicheVolontaire />} />
        </Route>

        <Route path="/partenaire" element={<RequirePartenaire><PartenairePortail /></RequirePartenaire>} />

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Suspense>
  )
}
