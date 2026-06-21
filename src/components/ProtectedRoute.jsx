import { Navigate, useLocation } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'
import { isPortalAccessActive } from '../utils/subscriptionAccess'

function ProtectedRoute({ children }) {
  const isAuthenticated = usePortalStore((state) => state.isAuthenticated)
  const authLoading = usePortalStore((state) => state.authLoading)
  const currentUser = usePortalStore((state) => state.currentUser)
  const location = useLocation()

  if (authLoading) return <div className="p-6 text-sm text-slate-600">Checking session...</div>

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isPortalAccessActive(currentUser) && location.pathname !== '/billing') {
    return <Navigate to="/billing" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute
