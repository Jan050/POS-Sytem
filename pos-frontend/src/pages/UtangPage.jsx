import { useState, useEffect, useCallback } from 'react'
import { utangApi } from '../api'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { formatPeso, formatDate } from '../utils/formatters'

export default function UtangPage() {
  const toast = useToast()
  const [records,      setRecords]      = useState([])
  const [totalUnpaid,  setTotalUnpaid]  = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('unpaid') // 'all' | 'unpaid' | 'paid'
  const [search,       setSearch]       = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [payTarget,    setPayTarget]    = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [payAmount,    setPayAmount]    = useState('')
  const [payError,     setPayError]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [form, setForm] = useState({ customerName: '', phone: '', amount: '', note: '', dueDate: '' })
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter !== 'all') params.status = filter
      if (search.trim())    params.search  = search.trim()
      const res = await utangApi.getAll(params)
      setRecords(res.data || [])
      setTotalUnpaid(res.totalUnpaid || 0)
    } catch { toast('Failed to load records', 'error') }
    finally { setLoading(false) }
  }, [filter, search])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.customerName.trim())          return setFormError('Customer name is required')
    if (!form.amount || parseFloat(form.amount) <= 0) return setFormError('Enter a valid amount')
    setSaving(true); setFormError('')
    try {
      await utangApi.create({ ...form, amount: parseFloat(form.amount) })
      toast('Utang recorded', 'success')
      setShowForm(false)
      setForm({ customerName: '', phone: '', amount: '', note: '', dueDate: '' })
      load()
    } catch (err) { setFormError(err.message) }
    finally { setSaving(false) }
  }

  const handlePay = async () => {
    const amt = parseFloat(payAmount)
    if (!Number.isFinite(amt) || amt <= 0) return setPayError('Enter a valid payment amount')
    if (amt > payTarget.balance)           return setPayError(`Maximum payment is ${formatPeso(payTarget.balance)}`)
    setSaving(true); setPayError('')
    try {
      const res = await utangApi.recordPayment(payTarget._id, { payment: amt })
      toast(res.message, 'success')
      setPayTarget(null)
      setPayAmount('')
      load()
    } catch (err) { setPayError(err.message) }
    finally { setSaving(false) }
  }

  const unpaidCount = records.filter((r) => !r.isPaid).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 bg-surface-800 border-b border-surface-700 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-semibold text-xl text-slate-100">Utang Tracker</h1>
            <p className="text-slate-500 text-sm">Customer credit records</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm">+ Record Utang</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-slate-400 text-xs">Total Unpaid</p>
            <p className="font-mono font-bold text-2xl text-red-400 mt-1">{formatPeso(totalUnpaid)}</p>
            <p className="text-xs text-slate-600 mt-1">{unpaidCount} customer{unpaidCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <p className="text-slate-400 text-xs mb-2">Filter</p>
            <div className="flex flex-col gap-1">
              {[['unpaid','Unpaid'],['paid','Paid'],['all','All']].map(([k,l]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-left transition-all
                    ${filter === k ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:bg-surface-700'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer name…" className="input pl-9 py-2.5 text-sm" />
        </div>

        {/* Records */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="divide-y divide-surface-700">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="px-4 py-4 flex gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-surface-700 shrink-0" />
                  <div className="flex-1 space-y-2"><div className="h-3.5 bg-surface-700 rounded w-1/3"/><div className="h-3 bg-surface-700 rounded w-1/2"/></div>
                  <div className="h-5 bg-surface-700 rounded w-20" />
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-14 text-slate-600">
              <span className="text-4xl block mb-3">🤝</span>
              <p className="text-sm">No {filter !== 'all' ? filter : ''} records found</p>
              <button onClick={() => setShowForm(true)} className="btn-primary mt-4 px-5 py-2 text-sm">Record first utang</button>
            </div>
          ) : (
            <div className="divide-y divide-surface-700">
              {records.map((rec) => (
                <div key={rec._id} className="flex items-center gap-3 px-4 py-3.5 group hover:bg-surface-700/30">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                    ${rec.isPaid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {rec.customerName.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-200 text-sm">{rec.customerName}</p>
                      {rec.isPaid ? (
                        <span className="badge bg-green-500/20 text-green-400">Paid</span>
                      ) : rec.dueDate && new Date(rec.dueDate) < new Date() ? (
                        <span className="badge bg-red-500/20 text-red-400">Overdue</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDate(rec.createdAt)}
                      {rec.dueDate ? ` · Due ${formatDate(rec.dueDate)}` : ''}
                      {rec.phone ? ` · ${rec.phone}` : ''}
                    </p>
                    {!rec.isPaid && rec.paidAmount > 0 && (
                      <p className="text-xs text-blue-400 mt-0.5">Paid: {formatPeso(rec.paidAmount)} / {formatPeso(rec.amount)}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`font-mono font-bold text-sm ${rec.isPaid ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPeso(rec.balance)}
                    </p>
                    {!rec.isPaid && (
                      <button onClick={() => { setPayTarget(rec); setPayAmount(rec.balance.toFixed(2)) }}
                        className="text-xs text-amber-400 hover:text-amber-300 mt-1 block">
                        Record payment →
                      </button>
                    )}
                  </div>

                  <button onClick={() => setDeleteTarget(rec._id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-red-400 shrink-0 ml-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setFormError('') }} title="Record Utang" size="md">
        <div className="space-y-4">
          {formError && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{formError}</p>}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Customer Name *</label>
            <input type="text" value={form.customerName}
              onChange={(e) => setForm(p => ({ ...p, customerName: e.target.value }))}
              placeholder="e.g. Aling Nena" className="input px-3 py-2.5" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Amount (₱) *</label>
              <input type="number" min="0.01" step="0.01" value={form.amount}
                onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00" className="input px-3 py-2.5 font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Phone (optional)</label>
              <input type="tel" value={form.phone}
                onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="09xx…" className="input px-3 py-2.5" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Due Date (optional)</label>
            <input type="date" value={form.dueDate}
              onChange={(e) => setForm(p => ({ ...p, dueDate: e.target.value }))}
              className="input px-3 py-2.5" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Note (optional)</label>
            <input type="text" value={form.note}
              onChange={(e) => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder="What was taken on credit" className="input px-3 py-2.5" maxLength={300} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowForm(false)} className="btn btn-secondary flex-1 py-2.5">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1 py-2.5 font-semibold">
              {saving ? 'Saving…' : 'Record Utang'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={!!payTarget} onClose={() => { setPayTarget(null); setPayError(''); setPayAmount('') }} title="Record Payment" size="sm">
        {payTarget && (
          <div className="space-y-4">
            <div className="card p-3 bg-surface-900">
              <p className="text-slate-400 text-xs">Customer</p>
              <p className="font-semibold text-slate-100">{payTarget.customerName}</p>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-slate-500">Outstanding balance</span>
                <span className="font-mono font-bold text-red-400">{formatPeso(payTarget.balance)}</span>
              </div>
            </div>
            {payError && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{payError}</p>}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Payment Amount (₱)</label>
              <input type="number" min="0.01" step="0.01" value={payAmount}
                onChange={(e) => { setPayAmount(e.target.value); setPayError('') }}
                className="input px-3 py-2.5 text-lg font-mono font-semibold" autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPayAmount(payTarget.balance.toFixed(2))}
                className="btn btn-secondary text-xs px-3 py-2">Full amount</button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPayTarget(null)} className="btn btn-secondary flex-1 py-2.5">Cancel</button>
              <button onClick={handlePay} disabled={saving} className="btn-primary flex-1 py-2.5 font-semibold">
                {saving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try { await utangApi.delete(deleteTarget); toast('Deleted', 'success'); load() }
          catch { toast('Failed to delete', 'error') }
          setDeleteTarget(null)
        }}
        title="Delete Record" message="Remove this utang record permanently?" confirmLabel="Delete" danger />
    </div>
  )
}
