import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import { PageLoader } from './components/ui/Skeleton'

const LoginPage      = lazy(() => import('./pages/LoginPage'))
const POSPage        = lazy(() => import('./pages/POSPage'))
const ProductsPage   = lazy(() => import('./pages/ProductsPage'))
const SalesPage      = lazy(() => import('./pages/SalesPage'))
const ExpensesPage   = lazy(() => import('./pages/ExpensesPage'))
const UtangPage      = lazy(() => import('./pages/UtangPage'))
const CashDrawerPage = lazy(() => import('./pages/CashDrawerPage'))
const SupplierPage = lazy(() => import('./pages/SupplierPage'))

function AppRoutes() {
  const { loading } = useAuth()
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
        <Route path="/utang" element={
          <ProtectedRoute>
            <Layout><Suspense fallback={<PageLoader />}><UtangPage /></Suspense></Layout>
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
        <Route path="/expenses" element={
          <ProtectedRoute adminOnly>
            <Layout><Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense></Layout>
          </ProtectedRoute>
        } />
        <Route path="/cash-drawer" element={
          <ProtectedRoute adminOnly>
            <Layout><Suspense fallback={<PageLoader />}><CashDrawerPage /></Suspense></Layout>
          </ProtectedRoute>
        } />
        <Route path="/suppliers" element={
          <ProtectedRoute adminOnly>
            <Layout><Suspense fallback={<PageLoader />}><SupplierPage /></Suspense></Layout>
            </ProtectedRoute>
        } />

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
