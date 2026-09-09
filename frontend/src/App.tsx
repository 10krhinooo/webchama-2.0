import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import PageTransition from './components/layout/PageTransition'
import RouteFallback from './components/feedback/RouteFallback'
import KeycloakProvider from './auth/KeycloakProvider'
import ThemeProvider from './theme/ThemeProvider'
import ProtectedRoute from './auth/ProtectedRoute'
import StaffLayout from './components/layout/StaffLayout'

// Every page is lazy so each route ships as its own chunk; only the shells (layout, providers,
// transitions) stay in the entry bundle. The Suspense boundary for the staff pages lives inside
// StaffLayout, so the sidebar and header stay visible while a page chunk loads.
const HomePage = lazy(() => import('./pages/public/HomePage'))
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage'))
const ChamasPage = lazy(() => import('./pages/staff/ChamasPage'))
const MyChamasPage = lazy(() => import('./pages/staff/MyChamasPage'))
const DashboardPage = lazy(() => import('./pages/staff/DashboardPage'))
const MembersPage = lazy(() => import('./pages/staff/MembersPage'))
const ContributionsPage = lazy(() => import('./pages/staff/ContributionsPage'))
const MyMoneyPage = lazy(() => import('./pages/staff/MyMoneyPage'))
const ContributionPaymentResultPage = lazy(() => import('./pages/staff/ContributionPaymentResultPage'))
const LoansPage = lazy(() => import('./pages/staff/LoansPage'))
const PenaltiesPage = lazy(() => import('./pages/staff/PenaltiesPage'))
const PayoutsPage = lazy(() => import('./pages/staff/PayoutsPage'))
const ApprovalsPage = lazy(() => import('./pages/staff/ApprovalsPage'))
const MeetingsPage = lazy(() => import('./pages/staff/MeetingsPage'))
const ResolutionsPage = lazy(() => import('./pages/staff/ResolutionsPage'))
const WelfareFundPage = lazy(() => import('./pages/staff/WelfareFundPage'))
const DocumentGeneratorPage = lazy(() => import('./pages/staff/DocumentGeneratorPage'))
const NotificationPreferencesPage = lazy(() => import('./pages/staff/NotificationPreferencesPage'))
const ProfilePage = lazy(() => import('./pages/staff/ProfilePage'))
const AdminOverviewPage = lazy(() => import('./pages/staff/AdminOverviewPage'))
const SecurityEventsPage = lazy(() => import('./pages/staff/SecurityEventsPage'))

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
          <Suspense fallback={<RouteFallback />}>
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
                <Route path="/profile" element={<ProfilePage />} />
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
          </Suspense>
        </BrowserRouter>
      </KeycloakProvider>
    </ThemeProvider>
  )
}

export default App
