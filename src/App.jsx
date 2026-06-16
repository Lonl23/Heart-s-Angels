import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'

// Auth (chargé immédiatement)
import Login          from '@/modules/auth/Login'
import ResetPassword  from '@/modules/auth/ResetPassword'
import NewPassword    from '@/modules/auth/NewPassword'
import ProtectedRoute from '@/modules/auth/ProtectedRoute'
import Layout         from '@/components/layout/Layout'
import PublicLayout   from '@/public/components/PublicLayout'
import Home           from '@/public/pages/Home'

// App interne — lazy
const Dashboard      = lazy(() => import('@/modules/dashboard/Dashboard'))
const Disponibilites = lazy(() => import('@/modules/disponibilites/Disponibilites'))
const Annuaire = lazy(() => import('@/modules/annuaire/Annuaire'))
const Souhaits       = lazy(() => import('@/modules/souhaits/Souhaits'))
const Comptabilite   = lazy(() => import('@/modules/comptabilite/Comptabilite'))
const Vente          = lazy(() => import('@/modules/vente/Vente'))
const Volontaires    = lazy(() => import('@/modules/volontaires/Volontaires'))
const Defraiements   = lazy(() => import('@/modules/defraiements/Defraiements'))
const Organigramme   = lazy(() => import('@/modules/organigramme/Organigramme'))
const Stock          = lazy(() => import('@/modules/stock/Stock'))
const StockMateriel  = lazy(() => import('@/modules/stock/StockMateriel'))
const GestionAcces   = lazy(() => import('@/modules/acces/GestionAcces'))
const Contenu        = lazy(() => import('@/modules/contenu/Contenu'))

// Pages publiques — lazy
const Mission        = lazy(() => import('@/public/pages/Mission'))
const LesSouhaits    = lazy(() => import('@/public/pages/LesSouhaits'))
const DemandeSouhait = lazy(() => import('@/public/pages/DemandeSouhait'))
const Equipe         = lazy(() => import('@/public/pages/Equipe'))
const Evenements     = lazy(() => import('@/public/pages/Evenements'))
const EvenementDetail    = lazy(() => import('@/public/pages/EvenementDetail'))
const InscriptionEvenement = lazy(() => import('@/public/pages/InscriptionEvenement'))
const Boutique       = lazy(() => import('@/public/pages/Boutique'))
const NousSoutenir   = lazy(() => import('@/public/pages/NousSoutenir'))
const DevenirBenevole= lazy(() => import('@/public/pages/DevenirBenevole'))
const Actualites     = lazy(() => import('@/public/pages/Actualites'))
const Blog           = lazy(() => import('@/public/pages/Blog'))
const Activites      = lazy(() => import('@/public/pages/Activites'))
const ArticleDetail  = lazy(() => import('@/public/pages/ArticleDetail'))
const Galerie        = lazy(() => import('@/public/pages/Galerie'))
const Temoignages    = lazy(() => import('@/public/pages/Temoignages'))
const Partenaires    = lazy(() => import('@/public/pages/Partenaires'))
const Contact        = lazy(() => import('@/public/pages/Contact'))
const MentionsLegales  = lazy(() => import('@/public/pages/MentionsLegales'))
const Presse           = lazy(() => import('@/public/pages/Presse'))
const Telechargement   = lazy(() => import('@/public/pages/Telechargement'))
const PolitiqueConf  = lazy(() => import('@/public/pages/PolitiqueConf'))
const Historique     = lazy(() => import('@/public/pages/Historique'))

const Loader = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'40vh', color:'#1BB0CE', fontFamily:'DM Sans,sans-serif', fontSize:14 }}>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
      <div style={{ width:36, height:36, border:'3px solid rgba(27,176,206,.2)', borderTopColor:'#1BB0CE', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
      <span>Chargement…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Auth */}
          <Route path="/login"          element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/new-password"   element={<NewPassword />} />

          {/* App interne */}
          <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index                 element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard"      element={<Dashboard />} />
            <Route path="disponibilites" element={<Disponibilites />} />
            <Route path="souhaits/*"     element={<Souhaits />} />
            <Route path="comptabilite/*" element={<Comptabilite />} />
            <Route path="vente/*"        element={<Vente />} />
            <Route path="volontaires/*"  element={<Volontaires />} />
            <Route path="annuaire/*"     element={<Annuaire />} />
            <Route path="defraiements/*" element={<Defraiements />} />
            <Route path="organigramme"   element={<Organigramme />} />
            <Route path="acces"          element={<GestionAcces />} />
            <Route path="stock"          element={<StockMateriel />} />
            <Route path="stock-boutique" element={<Stock />} />
          <Route path="contenu/*"       element={<Contenu />} />
          </Route>

          {/* Site public */}
          <Route path="/" element={<PublicLayout />}>
            <Route index                            element={<Home />} />
            <Route path="a-propos"                  element={<Mission />} />
            <Route path="historique"                element={<Mission />} />
            <Route path="les-souhaits"              element={<LesSouhaits />} />
            <Route path="demande-de-souhait"        element={<DemandeSouhait />} />
            <Route path="equipe"                    element={<Equipe />} />
            <Route path="evenements"                element={<Evenements />} />
            <Route path="evenements/:slug"          element={<EvenementDetail />} />
            <Route path="evenements/:slug/inscription" element={<InscriptionEvenement />} />
            <Route path="boutique"                  element={<Boutique />} />
            <Route path="nous-soutenir"             element={<NousSoutenir />} />
            <Route path="dons"                      element={<NousSoutenir />} />
            <Route path="benevoles"                 element={<Equipe />} />
            <Route path="devenir-benevole"          element={<DevenirBenevole />} />
            <Route path="partenaires"               element={<Partenaires />} />
            <Route path="actualites"                element={<Blog />} />
            <Route path="blog"                     element={<Blog />} />
            <Route path="activites"                element={<Activites />} />
            <Route path="actualites/:slug"          element={<ArticleDetail />} />
            <Route path="photos"                    element={<Galerie />} />
            <Route path="galerie"                   element={<Galerie />} />
            <Route path="temoignages"               element={<Temoignages />} />
            <Route path="contact"                   element={<Contact />} />
            <Route path="mentions-legales"          element={<MentionsLegales />} />
            <Route path="politique-confidentialite" element={<PolitiqueConf />} />
            <Route path="presse"                    element={<Presse />} />
            <Route path="telechargement"            element={<Telechargement />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}