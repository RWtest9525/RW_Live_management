import { Navigate, useLocation } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'

function ProtectedRoute({ children }) {
  const isAuthenticated = usePortalStore((state) => state.isAuthenticated)
  const authLoading = usePortalStore((state) => state.authLoading)
  const location = useLocation()

  if (authLoading) return <div className="p-6 text-sm text-slate-600">Checking session...</div>

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute
