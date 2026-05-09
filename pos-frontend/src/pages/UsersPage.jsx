import { useState, useEffect, useCallback } from 'react'
import { authApi } from '../api'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import { formatDateTime } from '../utils/formatters'

export default function UsersPage() {
  const toast = useToast()
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [formError,setFormError]= useState('')
  const [form, setForm] = useState({
    username: '', password: '', role: 'cashier', displayName: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authApi.getUsers()
      setUsers(res.data || [])
    } catch { toast('Failed to load users', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.username.trim()) return setFormError('Username is required')
    if (!form.password || form.password.length < 6) return setFormError('Password must be at least 6 characters')
    if (!form.displayName.trim()) return setFormError('Display name is required')
    setSaving(true); setFormError('')
    try {
      await authApi.createUser(form)
      toast(`User "${form.username}" created`, 'success')
      setShowForm(false)
      setForm({ username: '', password: '', role: 'cashier', displayName: '' })
      load()
    } catch (err) { setFormError(err.message) }
    finally { setSaving(false) }
  }

  const roleColor = (role) =>
    role === 'admin'
      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 bg-surface-800 border-b border-surface-700 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-semibold text-xl text-slate-100">User Accounts</h1>
            <p className="text-slate-500 text-sm">Manage cashier and admin accounts</p>
          </div>
          <button onClick={() => { setShowForm(true); setFormError('') }}
            className="btn-primary px-4 py-2 text-sm">
            + Add User
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Info card */}
        <div className="card p-4 mb-4 bg-blue-500/5 border-blue-500/20">
          <p className="text-blue-300 text-sm font-medium">👤 Role Permissions</p>
          <div className="grid grid-cols-2 gap-3 mt-2 text-xs text-slate-400">
            <div>
              <p className="font-semibold text-purple-300">Admin</p>
              <p>Full access — products, sales, expenses, cash drawer, users, backup</p>
            </div>
            <div>
              <p className="font-semibold text-blue-300">Cashier</p>
              <p>POS screen and utang tracker only</p>
            </div>
          </div>
        </div>

        {/* Users list */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="divide-y divide-surface-700">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="px-4 py-4 flex gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-surface-700 shrink-0"/>
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-surface-700 rounded w-1/3"/>
                    <div className="h-3 bg-surface-700 rounded w-1/4"/>
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-14 text-slate-600">
              <span className="text-4xl block mb-3">👤</span>
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-700">
              {users.map((user) => (
                <div key={user._id} className="flex items-center gap-4 px-4 py-4 hover:bg-surface-700/30">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                  ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                  {user.displayName?.[0]?.toUpperCase() ??
                   user.username?.[0]?.toUpperCase() ??
                   '?'}                    
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-200">{user.displayName || user.username || 'Unnamed User'}</p>
                      <span className={`badge text-xs ${roleColor(user.role)}`}>{user.role}</span>
                      {!user.isActive && (
                        <span className="badge bg-red-500/20 text-red-400 border border-red-500/30">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      @{user.username || 'unknown'}
                    </p>
                    {user.lastLogin && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        Last login: {formatDateTime(user.lastLogin)}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-600">
                      Created {formatDateTime(user.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add User Account" size="md">
        <div className="space-y-4">
          {formError && (
            <div className="bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2.5 text-sm text-red-300">
              {formError}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Display Name *</label>
            <input type="text" value={form.displayName}
              onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
              placeholder="e.g. Maria Santos" className="input px-3 py-2.5" autoFocus />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Username *</label>
            <input type="text" value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase() }))}
              placeholder="e.g. cashier2" className="input px-3 py-2.5 font-mono" />
            <p className="text-xs text-slate-600 mt-1">Lowercase letters, numbers, underscore only</p>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Password *</label>
            <input type="password" value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="Minimum 6 characters" className="input px-3 py-2.5" />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Role *</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'cashier', label: 'Cashier', desc: 'POS only', color: 'blue' },
                { key: 'admin',   label: 'Admin',   desc: 'Full access', color: 'purple' },
              ].map(({ key, label, desc, color }) => (
                <button key={key} onClick={() => setForm(p => ({ ...p, role: key }))}
                  className={`p-3 rounded-xl border text-left transition-all
                    ${form.role === key
                      ? `border-${color}-500/60 bg-${color}-500/10`
                      : 'border-surface-600 hover:border-surface-500'}`}>
                  <p className={`font-semibold text-sm ${form.role === key ? `text-${color}-300` : 'text-slate-300'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowForm(false)} className="btn btn-secondary flex-1 py-2.5">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1 py-2.5 font-semibold">
              {saving ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
