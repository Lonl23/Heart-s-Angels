// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Logiciel propriétaire. Voir LICENSE. Mention à ne pas retirer.
import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireStaff, RequirePartenaire } from '@/components/Protected'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import DemandeSouhait from '@/pages/DemandeSouhait'
import Inscription from '@/pages/Inscription'
import PartenairePortail from '@/pages/PartenairePortail'
import Stub from '@/modules/Stub'
import Souhaits from '@/modules/souhaits/Souhaits'
import Disponibilites from '@/modules/Disponibilites'
import Stock from '@/modules/Stock'
import Admin from '@/modules/Admin'
import FicheVolontaire from '@/modules/fiche/FicheVolontaire'
import MesMissions from '@/modules/MesMissions'
import Annuaire from '@/modules/annuaire/Annuaire'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/demande" element={<DemandeSouhait />} />
      <Route path="/inscription" element={<Inscription />} />

      {/* Espace interne (personnel) */}
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

      {/* Espace partenaire */}
      <Route path="/partenaire" element={<RequirePartenaire><PartenairePortail /></RequirePartenaire>} />

      {/* Défaut */}
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
