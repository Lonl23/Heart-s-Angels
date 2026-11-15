import { Route, Routes } from 'react-router-dom'
import { AuthProvider, GardePersonnel } from './auth'
import ListePreventifs from './ListePreventifs'
import DetailPreventif from './DetailPreventif'
import FicheForm from './FicheForm'

export default function App() {
  return (
    <AuthProvider>
      <GardePersonnel>
        <Routes>
          <Route path="/" element={<ListePreventifs />} />
          <Route path="/p/:id" element={<DetailPreventif />} />
          <Route path="/p/:id/fiche/nouvelle" element={<FicheForm />} />
          <Route path="/p/:id/fiche/:ficheId" element={<FicheForm />} />
          <Route path="*" element={<ListePreventifs />} />
        </Routes>
      </GardePersonnel>
    </AuthProvider>
  )
}
