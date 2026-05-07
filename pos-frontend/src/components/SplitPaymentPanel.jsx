import { useState, useMemo } from 'react'
import { formatPeso } from '../utils/formatters'

const METHODS = [
  { key: 'cash',  label: 'Cash',  icon: '💵', color: 'text-green-400'  },
  { key: 'gcash', label: 'GCash', icon: '💙', color: 'text-blue-400'   },
  { key: 'maya',  label: 'Maya',  icon: '💚', color: 'text-emerald-400' },
  { key: 'card',  label: 'Card',  icon: '💳', color: 'text-purple-400' },
  { key: 'other', label: 'Other', icon: '📱', color: 'text-slate-400'  },
]

export default function SplitPaymentPanel({ total, onChange }) {
  const [rows, setRows] = useState([{ method: 'cash', amount: '', reference: '' }])

  const totalPaid = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
    [rows]
  )
  const remaining = parseFloat((total - totalPaid).toFixed(2))
  const change    = remaining < 0 ? Math.abs(remaining) : 0
  const isValid   = totalPaid >= total

  // notify parent on every change
  const update = (updated) => {
    setRows(updated)
    const filled = updated.filter(r => parseFloat(r.amount) > 0).map(r => ({
      method:    r.method,
      amount:    parseFloat(r.amount) || 0,
      reference: r.reference,
    }))
    onChange(filled, isValid)
  }

  const setRow = (i, field, val) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
    update(next)
  }

  const addRow = () => update([...rows, { method: 'gcash', amount: '', reference: '' }])
  const removeRow = (i) => { if (rows.length > 1) update(rows.filter((_, idx) => idx !== i)) }

  const fillRemaining = (i) => {
    const already = rows.reduce((s, r, idx) => idx !== i ? s + (parseFloat(r.amount) || 0) : s, 0)
    const fill    = Math.max(0, parseFloat((total - already).toFixed(2)))
    setRow(i, 'amount', fill > 0 ? fill.toFixed(2) : '')
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="space-y-1.5">
          {/* Method + amount row */}
          <div className="flex gap-2 items-center">
            <select
              value={row.method}
              onChange={e => setRow(i, 'method', e.target.value)}
              className="input py-2 px-2 text-xs w-28 shrink-0"
            >
              {METHODS.map(m => (
                <option key={m.key} value={m.key}>{m.icon} {m.label}</option>
              ))}
            </select>

            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">₱</span>
              <input
                type="number" min="0" step="1"
                value={row.amount}
                onChange={e => setRow(i, 'amount', e.target.value)}
                placeholder="0.00"
                className="input pl-6 py-2 font-mono text-sm font-semibold text-slate-100"
              />
            </div>

            {/* Fill remaining shortcut */}
            <button
              onClick={() => fillRemaining(i)}
              className="text-[10px] px-2 py-1 rounded-lg bg-surface-600 text-slate-400
                hover:bg-amber-500/20 hover:text-amber-400 transition-colors shrink-0"
            >
              Fill
            </button>

            {rows.length > 1 && (
              <button onClick={() => removeRow(i)}
                className="p-1.5 text-slate-500 hover:text-red-400 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Reference number for GCash/Maya */}
          {(row.method === 'gcash' || row.method === 'maya') && (
            <input
              type="text"
              value={row.reference}
              onChange={e => setRow(i, 'reference', e.target.value)}
              placeholder={`${row.method === 'gcash' ? 'GCash' : 'Maya'} reference # (optional)`}
              className="input py-1.5 px-3 text-xs"
              maxLength={60}
            />
          )}
        </div>
      ))}

      {/* Add payment method */}
      <button onClick={addRow}
        className="w-full py-2 rounded-lg border border-dashed border-surface-500
          text-xs text-slate-500 hover:border-amber-500/50 hover:text-amber-400 transition-colors">
        + Add payment method
      </button>

      {/* Summary */}
      <div className="bg-surface-900 rounded-xl px-3 py-2.5 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Total due</span>
          <span className="font-mono font-bold text-slate-200">{formatPeso(total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Total paid</span>
          <span className={`font-mono font-bold ${totalPaid >= total ? 'text-green-400' : 'text-red-400'}`}>
            {formatPeso(totalPaid)}
          </span>
        </div>
        {remaining > 0 && (
          <div className="flex justify-between text-amber-400">
            <span>Still needed</span>
            <span className="font-mono font-bold">{formatPeso(remaining)}</span>
          </div>
        )}
        {change > 0 && (
          <div className="flex justify-between text-green-400">
            <span>Change</span>
            <span className="font-mono font-bold">{formatPeso(change)}</span>
          </div>
        )}
      </div>
    </div>
  )
}