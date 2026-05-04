import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * ProtectedRoute
 * Redirects unauthenticated users to /login.
 * Optionally restricts to adminOnly.
 *
 * Usage:
 *   <ProtectedRoute><SomePage /></ProtectedRoute>
 *   <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>
 */
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isLoggedIn, isAdmin, loading } = useAuth()
  const location = useLocation()

  // While verifying token on initial load, show nothing (avoids flash)
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500 text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    // Preserve intended destination for post-login redirect
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly && !isAdmin) {
    // Cashier trying to access admin-only page → bounce to POS
    return <Navigate to="/" replace />
  }

  return children
}

export default ProtectedRoute
