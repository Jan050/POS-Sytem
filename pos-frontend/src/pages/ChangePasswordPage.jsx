import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api'
import { useAuth } from '../context/AuthContext'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!form.currentPassword || !form.newPassword) {
      setError('Current and new password are required')
      return
    }
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Password confirmation does not match')
      return
    }

    setLoading(true)
    try {
      await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Password update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md card p-6">
        <h1 className="font-display font-semibold text-xl text-slate-100">Update Your Password</h1>
        <p className="text-sm text-slate-400 mt-1">For security, you must set a new password before using POS.</p>

        <form onSubmit={onSubmit} className="space-y-3 mt-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <input
            name="currentPassword"
            type="password"
            value={form.currentPassword}
            onChange={onChange}
            autoComplete="current-password"
            placeholder="Current password"
            className="input px-3 py-2.5"
          />
          <input
            name="newPassword"
            type="password"
            value={form.newPassword}
            onChange={onChange}
            autoComplete="new-password"
            placeholder="New password"
            className="input px-3 py-2.5"
          />
          <input
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={onChange}
            autoComplete="new-password"
            placeholder="Confirm new password"
            className="input px-3 py-2.5"
          />

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
