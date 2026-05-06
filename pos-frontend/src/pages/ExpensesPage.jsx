import { useState, useEffect, useCallback } from 'react'
import { expenseApi } from '../api'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { formatPeso, formatDateTime } from '../utils/formatters'

const CATEGORIES = ['Supplies','Utilities','Restock','Transport','Food','Salary','Rent','Other']
const PERIOD_OPTS = [{ key: 'today', label: 'Today' }, { key: '7days', label: '7 Days' }, { key: '30days', label: '30 Days' }]
const CAT_ICONS = { Supplies:'📦', Utilities:'💡', Restock:'🛒', Transport:'🚌', Food:'🍱', Salary:'👤', Rent:'🏠', Other:'📝' }
const CAT_COLORS = {
  Supplies:'bg-blue-500/20 text-blue-300', Utilities:'bg-yellow-500/20 text-yellow-300',
  Restock:'bg-green-500/20 text-green-300', Transport:'bg-purple-500/20 text-purple-300',
  Food:'bg-orange-500/20 text-orange-300', Salary:'bg-pink-500/20 text-pink-300',
  Rent:'bg-red-500/20 text-red-300', Other:'bg-slate-500/20 text-slate-300',
}

export default function ExpensesPage() {
  const toast = useToast()
  const [expenses,    setExpenses]    = useState([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [period,      setPeriod]      = useState('today')
  const [filterCat,   setFilterCat]   = useState('All')
  const [showForm,    setShowForm]    = useState(false)
  const [deleteTarget,setDeleteTarget]= useState(null)
  const [saving,      setSaving]      = useState(false)
  const [form, setForm] = useState({ amount: '', category: 'Supplies', description: '', date: new Date().toISOString().split('T')[0] })
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { period }
      if (filterCat !== 'All') params.category = filterCat
      const res = await expenseApi.getAll(params)
      setExpenses(res.data || [])
      setTotalAmount(res.totalAmount || 0)
    } catch { toast('Failed to load expenses', 'error') }
    finally { setLoading(false) }
  }, [period, filterCat])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return setFormError('Enter a valid amount')
    if (!form.category) return setFormError('Select a category')
    setSaving(true); setFormError('')
    try {
      await expenseApi.create({ ...form, amount: parseFloat(form.amount) })
      toast('Expense recorded', 'success')
      setShowForm(false)
      setForm({ amount: '', category: 'Supplies', description: '', date: new Date().toISOString().split('T')[0] })
      load()
    } catch (err) { setFormError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try { await expenseApi.delete(id); toast('Deleted', 'success'); load() }
    catch { toast('Failed to delete', 'error') }
  }

  // Group by category for summary
  const catSummary = CATEGORIES.map((cat) => ({
    cat,
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 bg-surface-800 border-b border-surface-700 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-semibold text-xl text-slate-100">Expenses</h1>
            <p className="text-slate-500 text-sm">Track daily store costs</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-surface-700 rounded-xl p-1 gap-0.5">
              {PERIOD_OPTS.map((p) => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${period === p.key ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm">
              + Add Expense
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Total card */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Total Expenses</p>
            <p className="font-mono font-bold text-2xl text-red-400 mt-0.5">{formatPeso(totalAmount)}</p>
          </div>
          <div className="text-4xl opacity-30">💸</div>
        </div>

        {/* Category breakdown */}
        {catSummary.length > 0 && (
          <div className="card p-4">
            <h3 className="font-display font-semibold text-slate-200 text-sm mb-3">By Category</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {catSummary.map(({ cat, total }) => (
                <button key={cat} onClick={() => setFilterCat(filterCat === cat ? 'All' : cat)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left
                    ${filterCat === cat ? 'border-amber-500/50 bg-amber-500/10' : 'border-surface-600 hover:border-surface-500 bg-surface-700/50'}`}>
                  <span className="text-lg">{CAT_ICONS[cat]}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 truncate">{cat}</p>
                    <p className="font-mono font-semibold text-sm text-slate-200">{formatPeso(total)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Expense list */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
            <h3 className="font-display font-semibold text-slate-200">
              {filterCat === 'All' ? 'All Expenses' : filterCat}
            </h3>
            {filterCat !== 'All' && (
              <button onClick={() => setFilterCat('All')} className="text-xs text-slate-500 hover:text-amber-400">
                Show all
              </button>
            )}
          </div>

          {loading ? (
            <div className="divide-y divide-surface-700">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="px-4 py-4 flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-surface-700 shrink-0" />
                  <div className="flex-1 space-y-2"><div className="h-3.5 bg-surface-700 rounded w-1/2"/><div className="h-3 bg-surface-700 rounded w-1/3"/></div>
                  <div className="h-4 bg-surface-700 rounded w-16" />
                </div>
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-14 text-slate-600">
              <span className="text-4xl block mb-3">📭</span>
              <p className="text-sm">No expenses recorded</p>
              <button onClick={() => setShowForm(true)} className="btn-primary mt-4 px-5 py-2 text-sm">
                Record first expense
              </button>
            </div>
          ) : (
            <div className="divide-y divide-surface-700">
              {expenses.map((exp) => (
                <div key={exp._id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-700/30 group">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${CAT_COLORS[exp.category]?.split(' ')[0] || 'bg-surface-700'}`}>
                    {CAT_ICONS[exp.category] || '📝'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{exp.description || exp.category}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(exp.date)} · {exp.category}</p>
                  </div>
                  <span className="font-mono font-semibold text-red-400 shrink-0">{formatPeso(exp.amount)}</span>
                  <button onClick={() => setDeleteTarget(exp._id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-red-400 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setFormError('') }} title="Record Expense" size="md">
        <div className="space-y-4">
          {formError && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{formError}</p>}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Amount (₱) *</label>
            <input type="number" min="0.01" step="0.01" value={form.amount}
              onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))}
              placeholder="0.00" className="input px-3 py-2.5 font-mono text-lg" autoFocus />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Category *</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setForm(p => ({ ...p, category: cat }))}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all
                    ${form.category === cat ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-surface-600 text-slate-400 hover:border-surface-500'}`}>
                  <span className="text-lg">{CAT_ICONS[cat]}</span>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Description</label>
            <input type="text" value={form.description}
              onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional note" className="input px-3 py-2.5" maxLength={200} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Date</label>
            <input type="date" value={form.date}
              onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))}
              className="input px-3 py-2.5" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowForm(false)} className="btn btn-secondary flex-1 py-2.5">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5 font-semibold">
              {saving ? 'Saving…' : 'Record Expense'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title="Delete Expense" message="Remove this expense record?" confirmLabel="Delete" danger />
    </div>
  )
}
