/**
 * App.jsx
 * Root component wiring together:
 *  - Authentication (AuthProvider + JWT)
 *  - Routing (React Router v6 with protected routes)
 *  - Lazy loading (code-split each page for faster initial load)
 *  - Toast notifications
 */
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import { PageLoader } from './components/ui/Skeleton'

// ── Lazy-loaded pages (code-split — each page loads only when navigated to) ──
const LoginPage    = lazy(() => import('./pages/LoginPage'))
const POSPage      = lazy(() => import('./pages/POSPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const SalesPage    = lazy(() => import('./pages/SalesPage'))

// ── Inner router: must be inside AuthProvider to read useAuth() ───────────────
function AppRoutes() {
  const { loading } = useAuth()

  // Hold render until token is verified — prevents flashing /login for logged-in users
  if (loading) return <PageLoader />

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Cashier + Admin */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout><Suspense fallback={<PageLoader />}><POSPage /></Suspense></Layout>
          </ProtectedRoute>
        } />

        {/* Admin only */}
        <Route path="/products" element={
          <ProtectedRoute adminOnly>
            <Layout><Suspense fallback={<PageLoader />}><ProductsPage /></Suspense></Layout>
          </ProtectedRoute>
        } />

        <Route path="/sales" element={
          <ProtectedRoute adminOnly>
            <Layout><Suspense fallback={<PageLoader />}><SalesPage /></Suspense></Layout>
          </ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
