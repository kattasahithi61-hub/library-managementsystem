import { Link, Navigate } from 'react-router-dom'
import useAuth from './useAuth.js'
import './AdminRoute.css'

function AdminRoute({ children }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <main className="auth-loading" role="status">Checking administrator access…</main>
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') {
    return (
      <main className="admin-route-denied" role="alert">
        <p>LIBRARY ADMINISTRATION</p>
        <h1>Administrator access required</h1>
        <span>This account cannot access administrator tools.</span>
        <Link to="/dashboard">Return to student dashboard</Link>
      </main>
    )
  }

  return children
}

export default AdminRoute
