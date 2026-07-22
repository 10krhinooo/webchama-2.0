import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/public/HomePage'
import KeycloakProvider from './auth/KeycloakProvider'
import ProtectedRoute from './auth/ProtectedRoute'
import StaffLayout from './components/layout/StaffLayout'
import ChamasPage from './pages/staff/ChamasPage'
import MembersPage from './pages/staff/MembersPage'
import ContributionsPage from './pages/staff/ContributionsPage'

function App() {
  return (
    <KeycloakProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            element={
              <ProtectedRoute>
                <StaffLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/chamas" element={<ChamasPage />} />
            <Route path="/chamas/:chamaId/members" element={<MembersPage />} />
            <Route path="/chamas/:chamaId/contributions" element={<ContributionsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </KeycloakProvider>
  )
}

export default App
