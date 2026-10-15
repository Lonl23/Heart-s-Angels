// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Logiciel propriétaire. Voir LICENSE. Mention à ne pas retirer.
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireStaff, RequirePartenaire, RequireAccess } from '@/components/Protected'
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
const FichesVolontaires = lazy(() => import('@/modules/rh/FichesVolontaires'))
const Organigramme = lazy(() => import('@/modules/rh/Organigramme'))
const Tresorerie = lazy(() => import('@/modules/Tresorerie'))

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
          <Route path="souhaits/nouveau" element={<RequireAccess feature="souhaits"><Souhaits /></RequireAccess>} />
          <Route path="souhaits/:id/preparer" element={<RequireAccess feature="souhaits"><Souhaits /></RequireAccess>} />
          <Route path="souhaits/:id" element={<RequireAccess feature="souhaits"><Souhaits /></RequireAccess>} />
          <Route path="souhaits" element={<RequireAccess feature="souhaits"><Souhaits /></RequireAccess>} />
          <Route path="missions/:id" element={<RequireAccess feature="missions"><MesMissions /></RequireAccess>} />
          <Route path="missions" element={<RequireAccess feature="missions"><MesMissions /></RequireAccess>} />
          <Route path="secours/:id" element={<RequireAccess feature="secours"><MesMissions titre="Interventions" sousTitre="Sur le terrain, étape par étape : votre véhicule, puis la prise en charge, le retour, la base." base="/app/secours" /></RequireAccess>} />
          <Route path="secours" element={<RequireAccess feature="secours"><MesMissions titre="Interventions" sousTitre="Sur le terrain, étape par étape : votre véhicule, puis la prise en charge, le retour, la base." base="/app/secours" /></RequireAccess>} />
          <Route path="rh/fiches" element={<RequireAccess feature="fiches"><FichesVolontaires /></RequireAccess>} />
          <Route path="rh/organigramme" element={<RequireAccess feature="organigramme"><Organigramme /></RequireAccess>} />
          <Route path="defraiements"   element={<RequireAccess feature="defraiements"><Stub nom="Défraiements" /></RequireAccess>} />
          <Route path="disponibilites" element={<RequireAccess feature="disponibilites"><Disponibilites /></RequireAccess>} />
          <Route path="stock"          element={<RequireAccess feature="stock"><Stock /></RequireAccess>} />
          <Route path="annuaire"       element={<RequireAccess feature="annuaire"><Annuaire /></RequireAccess>} />
          <Route path="tresorerie"     element={<RequireAccess feature="tresorerie"><Tresorerie /></RequireAccess>} />
          <Route path="admin"          element={<RequireAccess feature="admin"><Admin /></RequireAccess>} />
          <Route path="profil"         element={<FicheVolontaire />} />
        </Route>

        <Route path="/partenaire" element={<RequirePartenaire><PartenairePortail /></RequirePartenaire>} />

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Suspense>
  )
}
