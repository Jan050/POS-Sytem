import { useEffect, useState } from 'react'
import { holdOrderApi } from '../api'
import { formatPeso, formatDateTime } from '../utils/formatters'
import { useToast } from './ui/Toast'

export default function HeldOrdersDrawer({ isOpen, onClose, onResume }) {
  const toast = useToast()
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await holdOrderApi.getAll()
      setOrders(res.data || [])
    } catch {
      toast('Failed to load held orders', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isOpen) load() }, [isOpen])

  const handleResume = async (order) => {
    onResume(order)
    // delete from server after resuming
    try { await holdOrderApi.delete(order._id) } catch { /* ignore */ }
    onClose()
  }

  const handleDelete = async (id) => {
    try {
      await holdOrderApi.delete(id)
      setOrders(prev => prev.filter(o => o._id !== id))
      toast('Removed', 'success')
    } catch {
      toast('Failed to remove', 'error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
         onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-md card shadow-2xl animate-pop max-h-[80vh] flex flex-col"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700 shrink-0">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-100">Held Orders</h2>
            <p className="text-xs text-slate-500 mt-0.5">Tap to resume a parked cart</p>
          </div>
          <button onClick={onClose}
            className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-surface-700 animate-pulse"/>
            ))
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              <span className="text-4xl block mb-3">⏸️</span>
              <p className="text-sm">No held orders</p>
              <p className="text-xs mt-1">Hold the current cart using the "Hold" button</p>
            </div>
          ) : orders.map(order => (
            <div key={order._id}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-700 hover:bg-surface-600 transition-colors group">
              {/* Info */}
              <button className="flex-1 text-left" onClick={() => handleResume(order)}>
                <p className="font-medium text-slate-200 text-sm">
                  {order.label || `${order.items.length} item${order.items.length !== 1 ? 's' : ''}`}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDateTime(order.createdAt)}
                  {' · '}
                  {order.items.slice(0,2).map(i => i.name).join(', ')}
                  {order.items.length > 2 ? ` +${order.items.length - 2} more` : ''}
                </p>
              </button>

              {/* Total */}
              <div className="text-right shrink-0">
                <p className="font-mono font-bold text-amber-400 text-sm">
                  {formatPeso(order.subtotal)}
                </p>
                <button onClick={() => handleResume(order)}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-0.5 block">
                  Resume →
                </button>
              </div>

              {/* Delete */}
              <button onClick={() => handleDelete(order._id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-500 hover:text-red-400 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}