import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'pos_token'
const USER_KEY  = 'pos_user'

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })
  const [token, setToken]     = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

  // Verify token is still valid on app load
  useEffect(() => {
    const verify = async () => {
      if (!token) { setLoading(false); return }
      try {
        const res = await authApi.getMe()
        setUser(res.user)
        localStorage.setItem(USER_KEY, JSON.stringify(res.user))
      } catch {
        // Token expired or invalid — clear session
        clearSession()
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, []) // Only on mount

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  const login = useCallback(async (username, password) => {
    const res = await authApi.login({ username, password })
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    setToken(res.token)
    setUser(res.user)
    return res
  }, [])

  const logout = useCallback(() => {
    clearSession()
  }, [])

  const isAdmin    = user?.role === 'admin'
  const isCashier  = user?.role === 'cashier'
  const isLoggedIn = !!token && !!user

  return (
    <AuthContext.Provider value={{ user, token, loading, isLoggedIn, isAdmin, isCashier, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
