// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Logiciel propriétaire. Voir LICENSE. Mention à ne pas retirer.
import { lazy, Suspense } from 'react'
import { Route, Navigate } from 'react-router-dom'
import { RequireStaff, RequirePartenaire, RequireAcces } from '@/components/Protected'
import Layout from '@/components/Layout'
import { RoutesAvecFondu } from '@/components/Fondu'

const Login = lazy(() => import('@/pages/Login'))
const MotDePasseOublie = lazy(() => import('@/pages/MotDePasseOublie'))
const ReinitialiserMotDePasse = lazy(() => import('@/pages/ReinitialiserMotDePasse'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const DemandeSouhait = lazy(() => import('@/pages/DemandeSouhait'))
const Inscription = lazy(() => import('@/pages/Inscription'))
const DemandePartenaire = lazy(() => import('@/pages/DemandePartenaire'))
const PartenairePortail = lazy(() => import('@/pages/PartenairePortail'))
const Defraiements = lazy(() => import('@/modules/defraiements/Defraiements'))
const Souhaits = lazy(() => import('@/modules/souhaits/Souhaits'))
const Disponibilites = lazy(() => import('@/modules/Disponibilites'))
const EvenementsInternes = lazy(() => import('@/modules/EvenementsInternes'))
const Stock = lazy(() => import('@/modules/Stock'))
const Volontaires = lazy(() => import('@/modules/volontaires/Volontaires'))
const Admin = lazy(() => import('@/modules/Admin'))
const FicheVolontaire = lazy(() => import('@/modules/fiche/FicheVolontaire'))
const MesMissions = lazy(() => import('@/modules/MesMissions'))
const Annuaire = lazy(() => import('@/modules/annuaire/Annuaire'))
const Departement = lazy(() => import('@/pages/Departement'))
const Organigramme = lazy(() => import('@/modules/rh/Organigramme'))
const OrganigrammeEdition = lazy(() => import('@/modules/it/OrganigrammeEdition'))
const ConfigurationSouhaits = lazy(() => import('@/modules/it/ConfigurationSouhaits'))
const Tresorerie = lazy(() => import('@/modules/Tresorerie'))
const Actualites = lazy(() => import('@/modules/actualites/Actualites'))
const Statistiques = lazy(() => import('@/modules/it/Statistiques'))

function EcranChargement() {
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }} aria-hidden />
  )
}

export default function App() {
  return (
    <Suspense fallback={<EcranChargement />}>
      <RoutesAvecFondu>
        <Route path="/login" element={<Login />} />
        <Route path="/login/partenaire" element={<Login />} />
        <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
        <Route path="/reinitialiser-mot-de-passe" element={<ReinitialiserMotDePasse />} />
        <Route path="/login/partenaire/demande" element={<DemandePartenaire />} />
        <Route path="/demande" element={<DemandeSouhait />} />
        <Route path="/inscription" element={<Inscription />} />
        <Route path="/inscription/partenaire" element={<Inscription />} />

        <Route path="/app" element={<RequireStaff><Layout /></RequireStaff>}>
          <Route index element={<Dashboard />} />
          <Route path="departement/:id" element={<Departement />} />
          <Route path="souhaits/nouveau" element={<RequireAcces feature="souhaits"><Souhaits /></RequireAcces>} />
          <Route path="souhaits/:id/preparer" element={<RequireAcces feature="souhaits"><Souhaits /></RequireAcces>} />
          <Route path="souhaits/:id" element={<RequireAcces feature="souhaits"><Souhaits /></RequireAcces>} />
          <Route path="souhaits" element={<RequireAcces feature="souhaits"><Souhaits /></RequireAcces>} />
          <Route path="missions/:id" element={<RequireAcces feature="missions"><MesMissions /></RequireAcces>} />
          <Route path="missions" element={<RequireAcces feature="missions"><MesMissions /></RequireAcces>} />
          <Route path="defraiements"   element={<RequireAcces feature="defraiements"><Defraiements /></RequireAcces>} />
          <Route path="disponibilites" element={<RequireAcces feature="disponibilites"><Disponibilites /></RequireAcces>} />
          <Route path="actualites/nouveau" element={<RequireAcces feature="actualites"><Actualites /></RequireAcces>} />
          <Route path="actualites/:id/editer" element={<RequireAcces feature="actualites"><Actualites /></RequireAcces>} />
          <Route path="actualites/:id" element={<RequireAcces feature="actualites"><Actualites /></RequireAcces>} />
          <Route path="actualites" element={<RequireAcces feature="actualites"><Actualites /></RequireAcces>} />
          <Route path="evenements/nouveau" element={<RequireAcces feature="evenements"><EvenementsInternes /></RequireAcces>} />
          <Route path="evenements/:id/editer" element={<RequireAcces feature="evenements"><EvenementsInternes /></RequireAcces>} />
          <Route path="evenements/:id" element={<RequireAcces feature="evenements"><EvenementsInternes /></RequireAcces>} />
          <Route path="evenements"     element={<RequireAcces feature="evenements"><EvenementsInternes /></RequireAcces>} />
          <Route path="stock"          element={<RequireAcces feature="stock"><Stock /></RequireAcces>} />
          <Route path="annuaire"       element={<RequireAcces feature="annuaire"><Annuaire /></RequireAcces>} />
          <Route path="volontaires"    element={<RequireAcces feature="fiches"><Volontaires /></RequireAcces>} />
          <Route path="rh/organigramme" element={<RequireAcces feature="organigramme"><Organigramme /></RequireAcces>} />
          <Route path="it/organigramme" element={<RequireAcces feature="organigramme_edition"><OrganigrammeEdition /></RequireAcces>} />
          <Route path="it/configuration" element={<RequireAcces feature="config_souhaits"><ConfigurationSouhaits /></RequireAcces>} />
          <Route path="it/statistiques" element={<RequireAcces feature="statistiques"><Statistiques /></RequireAcces>} />
          <Route path="tresorerie"     element={<RequireAcces feature="tresorerie"><Tresorerie /></RequireAcces>} />
          <Route path="admin"          element={<RequireAcces feature="admin"><Admin /></RequireAcces>} />
          <Route path="profil"         element={<FicheVolontaire />} />
        </Route>

        <Route path="/partenaire" element={<RequirePartenaire><PartenairePortail /></RequirePartenaire>} />

        <Route path="*" element={<Navigate to="/app" replace />} />
      </RoutesAvecFondu>
    </Suspense>
  )
}
