import { Navigate, useLocation } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'

function ProtectedRoute({ children }) {
  const isAuthenticated = usePortalStore((state) => state.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute
