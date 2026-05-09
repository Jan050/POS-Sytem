import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SyncProvider } from './context/SyncContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import { PageLoader } from './components/ui/Skeleton'
import PWAInstallBanner from './components/PWAInstallBanner'

const LoginPage      = lazy(() => import('./pages/LoginPage'))
const POSPage        = lazy(() => import('./pages/POSPage'))
const ProductsPage   = lazy(() => import('./pages/ProductsPage'))
const SalesPage      = lazy(() => import('./pages/SalesPage'))
const ExpensesPage   = lazy(() => import('./pages/ExpensesPage'))
const UtangPage      = lazy(() => import('./pages/UtangPage'))
const CashDrawerPage = lazy(() => import('./pages/CashDrawerPage'))
const SupplierPage   = lazy(() => import('./pages/SupplierPage'))
const UsersPage      = lazy(() => import('./pages/UsersPage'))
const BackupPage     = lazy(() => import('./pages/BackupPage'))
const AuditLogPage   = lazy(() => import('./pages/AuditLogPage'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'))

function AppRoutes() {
  const { loading } = useAuth()
  if (loading) return <PageLoader />

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={
          <ProtectedRoute><ChangePasswordPage /></ProtectedRoute>
        } />

        {/* Cashier + Admin */}
        <Route path="/" element={
          <ProtectedRoute><Layout><POSPage /></Layout></ProtectedRoute>
        } />
        <Route path="/utang" element={
          <ProtectedRoute><Layout><UtangPage /></Layout></ProtectedRoute>
        } />

        {/* Admin only */}
        <Route path="/products" element={
          <ProtectedRoute adminOnly><Layout><ProductsPage /></Layout></ProtectedRoute>
        } />
        <Route path="/sales" element={
          <ProtectedRoute adminOnly><Layout><SalesPage /></Layout></ProtectedRoute>
        } />
        <Route path="/expenses" element={
          <ProtectedRoute adminOnly><Layout><ExpensesPage /></Layout></ProtectedRoute>
        } />
        <Route path="/cash-drawer" element={
          <ProtectedRoute adminOnly><Layout><CashDrawerPage /></Layout></ProtectedRoute>
        } />
        <Route path="/suppliers" element={
          <ProtectedRoute adminOnly><Layout><SupplierPage /></Layout></ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute adminOnly><Layout><UsersPage /></Layout></ProtectedRoute>
        } />
        <Route path="/backup" element={
          <ProtectedRoute adminOnly><Layout><BackupPage /></Layout></ProtectedRoute>
        } />
        <Route path="/audit-log" element={
          <ProtectedRoute adminOnly><Layout><AuditLogPage /></Layout></ProtectedRoute>
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
        <SyncProvider>
          <ToastProvider>
            <AppRoutes />
            <PWAInstallBanner />
          </ToastProvider>
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
