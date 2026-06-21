import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PortalLayout from './layouts/PortalLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import TermsPage from './pages/TermsPage'
import DashboardPage from './pages/DashboardPage'
import MoneyTrackerPage from './pages/MoneyTrackerPage'
import AppMonitorPage from './pages/AppMonitorPage'
import WorkerPanelPage from './pages/WorkerPanelPage'
import ProofGalleryPage from './pages/ProofGalleryPage'
import BillingPage from './pages/BillingPage'
import AdminSubscriptionsPage from './pages/AdminSubscriptionsPage'
import AppDetailPage from './pages/AppDetailPage'
import ClientManagementPage from './pages/ClientManagementPage'
import PasswordRequestsPage from './pages/PasswordRequestsPage'
import NotFoundPage from './pages/NotFoundPage'
import RecordPage from './pages/RecordPage'
import AdminMaintenancePage from './pages/AdminMaintenancePage'
import usePortalStore from './store/usePortalStore'

function App() {
  const hydrateSession = usePortalStore((state) => state.hydrateSession)
  const theme = usePortalStore((state) => state.theme)

  useEffect(() => {
    hydrateSession()
  }, [hydrateSession])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/terms-and-conditions" element={<TermsPage />} />
      <Route
        element={
          <ProtectedRoute>
            <PortalLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/money-tracker" element={<MoneyTrackerPage />} />
        <Route path="/app-monitor" element={<AppMonitorPage />} />
        <Route path="/worker-panel" element={<WorkerPanelPage />} />
        <Route path="/proof-gallery" element={<ProofGalleryPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/admin-subscriptions" element={<AdminSubscriptionsPage />} />
        <Route path="/clients" element={<ClientManagementPage />} />
        <Route path="/password-requests" element={<PasswordRequestsPage />} />
        <Route path="/admin-maintenance" element={<AdminMaintenancePage />} />
        <Route path="/support/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/app/:id" element={<AppDetailPage />} />
      </Route>
      <Route path="/record/:id" element={<RecordPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
