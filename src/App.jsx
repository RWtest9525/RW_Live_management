import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PortalLayout from './layouts/PortalLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import TermsPage from './pages/TermsPage'
import DashboardPage from './pages/DashboardPage'
import MoneyTrackerPage from './pages/MoneyTrackerPage'
import AppMonitorPage from './pages/AppMonitorPage'
import WorkerPanelPage from './pages/WorkerPanelPage'
import ProofGalleryPage from './pages/ProofGalleryPage'
import AppDetailPage from './pages/AppDetailPage'
import NotFoundPage from './pages/NotFoundPage'
import RecordPage from './pages/RecordPage'
import usePortalStore from './store/usePortalStore'

function App() {
  const hydrateSession = usePortalStore((state) => state.hydrateSession)

  useEffect(() => {
    hydrateSession()
  }, [hydrateSession])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
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
        <Route path="/app/:id" element={<AppDetailPage />} />
      </Route>
      <Route path="/record/:id" element={<RecordPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
