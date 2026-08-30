import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import PageTransition from './components/layout/PageTransition'
import HomePage from './pages/public/HomePage'
import NotFoundPage from './pages/public/NotFoundPage'
import KeycloakProvider from './auth/KeycloakProvider'
import ThemeProvider from './theme/ThemeProvider'
import ProtectedRoute from './auth/ProtectedRoute'
import StaffLayout from './components/layout/StaffLayout'
import ChamasPage from './pages/staff/ChamasPage'
import MyChamasPage from './pages/staff/MyChamasPage'
import DashboardPage from './pages/staff/DashboardPage'
import MembersPage from './pages/staff/MembersPage'
import ContributionsPage from './pages/staff/ContributionsPage'
import MyMoneyPage from './pages/staff/MyMoneyPage'
import ContributionPaymentResultPage from './pages/staff/ContributionPaymentResultPage'
import LoansPage from './pages/staff/LoansPage'
import PenaltiesPage from './pages/staff/PenaltiesPage'
import PayoutsPage from './pages/staff/PayoutsPage'
import ApprovalsPage from './pages/staff/ApprovalsPage'
import MeetingsPage from './pages/staff/MeetingsPage'
import ResolutionsPage from './pages/staff/ResolutionsPage'
import WelfareFundPage from './pages/staff/WelfareFundPage'
import DocumentGeneratorPage from './pages/staff/DocumentGeneratorPage'
import NotificationPreferencesPage from './pages/staff/NotificationPreferencesPage'
import AdminOverviewPage from './pages/staff/AdminOverviewPage'
import SecurityEventsPage from './pages/staff/SecurityEventsPage'

/**
 * The transition wrapper for routes outside StaffLayout, which has no shared layout of its own to
 * carry one. Keyed on the pathname so it remounts per route, the same way the staff outlet is.
 */
function PublicPage({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return <PageTransition key={location.pathname}>{children}</PageTransition>
}

function App() {
  return (
    <ThemeProvider>
      <KeycloakProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicPage><HomePage /></PublicPage>} />
            <Route
              element={
                <ProtectedRoute>
                  <StaffLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/my-chamas" element={<MyChamasPage />} />
              <Route path="/notification-preferences" element={<NotificationPreferencesPage />} />
              <Route path="/chamas" element={<ChamasPage />} />
              <Route path="/chamas/:chamaId/dashboard" element={<DashboardPage />} />
              <Route path="/chamas/:chamaId/members" element={<MembersPage />} />
              <Route path="/chamas/:chamaId/my-money" element={<MyMoneyPage />} />
              <Route path="/chamas/:chamaId/contributions" element={<ContributionsPage />} />
              <Route path="/chamas/:chamaId/loans" element={<LoansPage />} />
              <Route path="/chamas/:chamaId/penalties" element={<PenaltiesPage />} />
              <Route path="/chamas/:chamaId/payouts" element={<PayoutsPage />} />
              <Route path="/chamas/:chamaId/approvals" element={<ApprovalsPage />} />
              <Route path="/chamas/:chamaId/meetings" element={<MeetingsPage />} />
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
            <Route path="*" element={<PublicPage><NotFoundPage /></PublicPage>} />
          </Routes>
        </BrowserRouter>
      </KeycloakProvider>
    </ThemeProvider>
  )
}

export default App
