import { Navigate, useLocation } from 'react-router-dom'
import useAuth from './useAuth.js'

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <main className="auth-loading" role="status">Checking your library session…</main>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export default ProtectedRoute
