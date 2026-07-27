import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/public/HomePage'
import NotFoundPage from './pages/public/NotFoundPage'
import KeycloakProvider from './auth/KeycloakProvider'
import ProtectedRoute from './auth/ProtectedRoute'
import StaffLayout from './components/layout/StaffLayout'
import ChamasPage from './pages/staff/ChamasPage'
import MyChamasPage from './pages/staff/MyChamasPage'
import DashboardPage from './pages/staff/DashboardPage'
import MembersPage from './pages/staff/MembersPage'
import ContributionsPage from './pages/staff/ContributionsPage'
import ContributionPaymentResultPage from './pages/staff/ContributionPaymentResultPage'
import LoansPage from './pages/staff/LoansPage'
import PayoutsPage from './pages/staff/PayoutsPage'
import ApprovalsPage from './pages/staff/ApprovalsPage'
import ResolutionsPage from './pages/staff/ResolutionsPage'
import WelfareFundPage from './pages/staff/WelfareFundPage'
import DocumentGeneratorPage from './pages/staff/DocumentGeneratorPage'
import AdminOverviewPage from './pages/staff/AdminOverviewPage'
import SecurityEventsPage from './pages/staff/SecurityEventsPage'

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
            <Route path="/my-chamas" element={<MyChamasPage />} />
            <Route path="/chamas" element={<ChamasPage />} />
            <Route path="/chamas/:chamaId/dashboard" element={<DashboardPage />} />
            <Route path="/chamas/:chamaId/members" element={<MembersPage />} />
            <Route path="/chamas/:chamaId/contributions" element={<ContributionsPage />} />
            <Route path="/chamas/:chamaId/loans" element={<LoansPage />} />
            <Route path="/chamas/:chamaId/payouts" element={<PayoutsPage />} />
            <Route path="/chamas/:chamaId/approvals" element={<ApprovalsPage />} />
            <Route path="/chamas/:chamaId/resolutions" element={<ResolutionsPage />} />
            <Route path="/chamas/:chamaId/welfare-fund" element={<WelfareFundPage />} />
            <Route path="/chamas/:chamaId/documents" element={<DocumentGeneratorPage />} />
          </Route>
          <Route
            element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <StaffLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/overview" element={<AdminOverviewPage />} />
            <Route path="/admin/security-events" element={<SecurityEventsPage />} />
          </Route>
          <Route
            path="/contribution-payment-result"
            element={
              <ProtectedRoute>
                <ContributionPaymentResultPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </KeycloakProvider>
  )
}

export default App
