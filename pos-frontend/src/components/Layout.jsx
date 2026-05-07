import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { productApi } from '../api'

const Layout = ({ children }) => {
  const { user, isAdmin, logout } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [lowStockCount, setLowStockCount] = useState(0)
  const location = useLocation()

  // Poll low-stock count every 2 minutes for the alert badge
  useEffect(() => {
    const fetchLowStock = async () => {
      try {
        const res = await productApi.getLowStock()
        setLowStockCount(res.count || 0)
      } catch { /* silent */ }
    }
    fetchLowStock()
    const interval = setInterval(fetchLowStock, 120000)
    return () => clearInterval(interval)
  }, [])

  const navItems = [
    {
      to: '/', label: 'POS', adminOnly: false,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.4 5.6M7 13l-1.4 5.6m0 0h12.8M17 18a1 1 0 100 2 1 1 0 000-2zm-8 0a1 1 0 100 2 1 1 0 000-2z" /></svg>,
    },
    {
      to: '/products', label: 'Products', adminOnly: true,
      badge: lowStockCount > 0 ? lowStockCount : null,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" /></svg>,
    },
    {
      to: '/sales', label: 'Sales', adminOnly: true,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    },
    {
      to: '/expenses', label: 'Expenses', adminOnly: true,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
    {
      to: '/utang', label: 'Utang', adminOnly: false,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      to: '/cash-drawer', label: 'Drawer', adminOnly: true,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    },
    {
      to: '/suppliers', label: 'Suppliers', adminOnly: true,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
  </svg>,
},
  ]

  const visibleItems = navItems.filter((i) => !i.adminOnly || isAdmin)

  const pageTitles = {
    '/': 'Point of Sale',
    '/products': 'Products',
    '/sales': 'Sales Dashboard',
    '/expenses': 'Expenses',
    '/utang': 'Utang Tracker',
    '/cash-drawer': 'Cash Drawer',
  }
  const pageTitle = pageTitles[location.pathname] || 'TindahanPOS'

  return (
    <div className="flex h-screen overflow-hidden bg-surface-900">

      {/* ── Desktop Sidebar ─────────────────────── */}
      <aside className="hidden md:flex flex-col w-16 bg-surface-800 border-r border-surface-700 py-4 shrink-0">
        <div className="flex items-center justify-center mb-4">
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-slate-900 font-display font-bold text-sm">T</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-2 flex-1 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} title={item.label}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-150
                ${isActive ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:bg-surface-700 hover:text-slate-100'}`
              }
            >
              {item.icon}
              <span className="text-[9px] font-semibold tracking-wide uppercase">{item.label}</span>
              {item.badge && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-2 space-y-2 shrink-0">
          <div className="flex flex-col items-center gap-0.5 py-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
              ${isAdmin ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
              {user?.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-[9px] text-slate-600 text-center truncate w-full text-center">{user?.role}</span>
          </div>
          <button onClick={logout} title="Sign out"
            className="w-full flex justify-center p-2 rounded-lg text-slate-600 hover:bg-red-900/30 hover:text-red-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-surface-800 border-b border-surface-700 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-slate-900 font-display font-bold text-xs">T</span>
            </div>
            <span className="font-display font-semibold text-slate-100">{pageTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            {lowStockCount > 0 && (
              <NavLink to="/products"
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-900/40 text-orange-400 border border-orange-700/40">
                ⚠️ {lowStockCount}
              </NavLink>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
              ${isAdmin ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
              {user?.role}
            </span>
            <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="btn-ghost p-2 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </header>

        {mobileNavOpen && (
          <nav className="md:hidden bg-surface-800 border-b border-surface-700 px-3 py-2 flex gap-1.5 animate-slide-in shrink-0 overflow-x-auto">
            {visibleItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-all
                  ${isActive ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:bg-surface-700 hover:text-slate-100'}`
                }
              >
                {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                {item.label}
                {item.badge && (
                  <span className="w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shrink-0">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </NavLink>
            ))}
            <button onClick={() => { setMobileNavOpen(false); logout() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-900/30 transition-all shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </nav>
        )}

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}

export default Layout
