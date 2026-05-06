import { useState, useEffect, useCallback } from 'react'
import { cashDrawerApi } from '../api'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { formatPeso, formatDateTime } from '../utils/formatters'

export default function CashDrawerPage() {
  const toast = useToast()

  const [current,     setCurrent]     = useState(null)  // open session or null
  const [history,     setHistory]     = useState([])
  const [loadingMain, setLoadingMain] = useState(true)
  const [loadingHist, setLoadingHist] = useState(true)

  // Open drawer form
  const [showOpen,      setShowOpen]      = useState(false)
  const [openingCash,   setOpeningCash]   = useState('')
  const [openNotes,     setOpenNotes]     = useState('')
  const [openError,     setOpenError]     = useState('')
  const [openSaving,    setOpenSaving]    = useState(false)

  // Close drawer form
  const [showClose,     setShowClose]     = useState(false)
  const [closingCash,   setClosingCash]   = useState('')
  const [closeNotes,    setCloseNotes]    = useState('')
  const [closeError,    setCloseError]    = useState('')
  const [closeSaving,   setCloseSaving]   = useState(false)

  const loadCurrent = useCallback(async () => {
    setLoadingMain(true)
    try {
      const res = await cashDrawerApi.getCurrent()
      setCurrent(res.data || null)
    } catch { toast('Failed to load drawer status', 'error') }
    finally { setLoadingMain(false) }
  }, [])

  const loadHistory = useCallback(async () => {
    setLoadingHist(true)
    try {
      const res = await cashDrawerApi.getHistory({ limit: 10 })
      setHistory(res.data || [])
    } catch { toast('Failed to load history', 'error') }
    finally { setLoadingHist(false) }
  }, [])

  useEffect(() => { loadCurrent(); loadHistory() }, [loadCurrent, loadHistory])

  // ── Open Drawer ────────────────────────────────────────────────────────
  const handleOpen = async () => {
    const amount = parseFloat(openingCash)
    if (!Number.isFinite(amount) || amount < 0) return setOpenError('Enter a valid opening cash amount')
    setOpenSaving(true); setOpenError('')
    try {
      await cashDrawerApi.open({ openingCash: amount, notes: openNotes })
      toast('Cash drawer opened ✅', 'success')
      setShowOpen(false); setOpeningCash(''); setOpenNotes('')
      loadCurrent()
    } catch (err) { setOpenError(err.message) }
    finally { setOpenSaving(false) }
  }

  // ── Close Drawer ───────────────────────────────────────────────────────
  const handleClose = async () => {
    const amount = parseFloat(closingCash)
    if (!Number.isFinite(amount) || amount < 0) return setCloseError('Enter the actual cash count')
    setCloseSaving(true); setCloseError('')
    try {
      await cashDrawerApi.close(current._id, { closingCash: amount, notes: closeNotes })
      toast('Cash drawer closed', 'success')
      setShowClose(false); setClosingCash(''); setCloseNotes('')
      loadCurrent(); loadHistory()
    } catch (err) { setCloseError(err.message) }
    finally { setCloseSaving(false) }
  }

  // ── Duration helper ────────────────────────────────────────────────────
  const getDuration = (from, to = new Date()) => {
    const mins = Math.floor((new Date(to) - new Date(from)) / 60000)
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const discrepancyColor = (d) => {
    if (d === null || d === undefined) return 'text-slate-400'
    if (Math.abs(d) < 1)  return 'text-green-400'
    if (d < 0)            return 'text-red-400'
    return 'text-blue-400'
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 md:px-6 py-4 bg-surface-800 border-b border-surface-700 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-semibold text-xl text-slate-100">Cash Drawer</h1>
            <p className="text-slate-500 text-sm">Track daily cash float</p>
          </div>
          {!loadingMain && (
            current
              ? <button onClick={() => setShowClose(true)} className="btn btn-danger px-4 py-2 text-sm">Close Drawer</button>
              : <button onClick={() => setShowOpen(true)}  className="btn-primary px-4 py-2 text-sm">Open Drawer</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* ── Current Session ─────────────────────────────────── */}
        {loadingMain ? (
          <div className="card p-6 animate-pulse space-y-3">
            <div className="h-4 bg-surface-700 rounded w-1/3"/>
            <div className="h-8 bg-surface-700 rounded w-1/2"/>
          </div>
        ) : current ? (
          <div className="card p-5 border-green-700/40 bg-green-900/10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"/>
                <span className="text-green-400 text-sm font-semibold">Drawer Open</span>
              </div>
              <span className="text-xs text-slate-500 bg-surface-700 px-2 py-1 rounded-lg">
                {getDuration(current.openedAt)} ago
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500">Opening Cash</p>
                <p className="font-mono font-bold text-xl text-slate-100 mt-0.5">{formatPeso(current.openingCash)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Opened At</p>
                <p className="text-sm text-slate-300 mt-0.5">{formatDateTime(current.openedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Opened By</p>
                <p className="text-sm text-slate-300 mt-0.5">{current.openedBy?.displayName || current.openedBy?.username || '—'}</p>
              </div>
            </div>
            {current.notes && (
              <p className="text-xs text-slate-500 mt-3 border-t border-surface-700 pt-3">📝 {current.notes}</p>
            )}
            <button onClick={() => setShowClose(true)}
              className="btn btn-danger mt-4 px-4 py-2 text-sm w-full sm:w-auto">
              Count & Close Drawer
            </button>
          </div>
        ) : (
          <div className="card p-6 text-center">
            <div className="text-4xl mb-3">🔒</div>
            <p className="font-semibold text-slate-200">Drawer is closed</p>
            <p className="text-sm text-slate-500 mt-1">Open the drawer at the start of the day</p>
            <button onClick={() => setShowOpen(true)} className="btn-primary mt-4 px-6 py-2.5 text-sm">
              Open Drawer
            </button>
          </div>
        )}

        {/* ── Session History ─────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
            <h3 className="font-display font-semibold text-slate-200">Session History</h3>
            {!loadingHist && (
              <span className="text-xs text-slate-500 bg-surface-700 px-2 py-1 rounded-lg">{history.length} sessions</span>
            )}
          </div>

          {loadingHist ? (
            <div className="divide-y divide-surface-700">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="px-4 py-4 animate-pulse space-y-2">
                  <div className="h-3.5 bg-surface-700 rounded w-1/3"/>
                  <div className="h-3 bg-surface-700 rounded w-2/3"/>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              <p className="text-sm">No sessions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-700">
              {history.map((session) => (
                <div key={session._id} className="px-4 py-4 hover:bg-surface-700/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: date + duration */}
                    <div>
                      <p className="text-sm font-medium text-slate-200">{formatDateTime(session.openedAt)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Duration: {getDuration(session.openedAt, session.closedAt)} ·{' '}
                        {session.orderCount} order{session.orderCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {/* Right: total sales */}
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-amber-400">{formatPeso(session.totalSales)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">sales</p>
                    </div>
                  </div>

                  {/* Cash summary row */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-surface-700/50 rounded-lg p-2">
                      <p className="text-slate-500">Opening</p>
                      <p className="font-mono font-semibold text-slate-200 mt-0.5">{formatPeso(session.openingCash)}</p>
                    </div>
                    <div className="bg-surface-700/50 rounded-lg p-2">
                      <p className="text-slate-500">Expected</p>
                      <p className="font-mono font-semibold text-slate-200 mt-0.5">{formatPeso(session.expectedCash)}</p>
                    </div>
                    <div className="bg-surface-700/50 rounded-lg p-2">
                      <p className="text-slate-500">Actual</p>
                      <p className="font-mono font-semibold text-slate-200 mt-0.5">{formatPeso(session.closingCash)}</p>
                    </div>
                  </div>

                  {/* Discrepancy */}
                  {session.discrepancy !== null && Math.abs(session.discrepancy) >= 0.01 && (
                    <div className={`mt-2 text-xs flex items-center gap-1.5 font-medium ${discrepancyColor(session.discrepancy)}`}>
                      {session.discrepancy < 0
                        ? <span>⚠️ Short by {formatPeso(Math.abs(session.discrepancy))}</span>
                        : <span>✅ Over by {formatPeso(session.discrepancy)}</span>
                      }
                    </div>
                  )}
                  {session.discrepancy !== null && Math.abs(session.discrepancy) < 1 && (
                    <p className="mt-2 text-xs text-green-400">✅ Balanced</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Open Drawer Modal ────────────────────────────── */}
      <Modal isOpen={showOpen} onClose={() => { setShowOpen(false); setOpenError('') }} title="Open Cash Drawer" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Count the starting cash in the drawer and enter the total below.</p>
          {openError && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{openError}</p>}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Opening Cash (₱) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₱</span>
              <input type="number" min="0" step="1" value={openingCash}
                onChange={(e) => { setOpeningCash(e.target.value); setOpenError('') }}
                placeholder="0.00" className="input pl-8 py-3 text-xl font-mono font-bold" autoFocus />
            </div>
          </div>
          {/* Quick presets */}
          <div className="flex gap-2 flex-wrap">
            {[0, 100, 200, 500, 1000].map((v) => (
              <button key={v} onClick={() => setOpeningCash(v.toString())}
                className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-colors
                  ${Number(openingCash) === v ? 'bg-amber-500 text-slate-900 font-bold' : 'bg-surface-600 text-slate-300 hover:bg-surface-500'}`}>
                ₱{v}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Notes (optional)</label>
            <input type="text" value={openNotes} onChange={(e) => setOpenNotes(e.target.value)}
              placeholder="e.g. Opened by Mang Jose" className="input px-3 py-2.5" maxLength={300} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowOpen(false)} className="btn btn-secondary flex-1 py-2.5">Cancel</button>
            <button onClick={handleOpen} disabled={openSaving} className="btn-primary flex-1 py-2.5 font-semibold">
              {openSaving ? 'Opening…' : 'Open Drawer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Close Drawer Modal ───────────────────────────── */}
      <Modal isOpen={showClose} onClose={() => { setShowClose(false); setCloseError('') }} title="Close Cash Drawer" size="sm">
        {current && (
          <div className="space-y-4">
            <div className="card p-3 bg-surface-900 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Opening cash</span><span className="font-mono text-slate-200">{formatPeso(current.openingCash)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Session duration</span><span className="text-slate-300">{getDuration(current.openedAt)}</span></div>
            </div>
            <p className="text-sm text-slate-400">Count the cash in the drawer now and enter the total below.</p>
            {closeError && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{closeError}</p>}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Actual Cash Count (₱) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₱</span>
                <input type="number" min="0" step="1" value={closingCash}
                  onChange={(e) => { setClosingCash(e.target.value); setCloseError('') }}
                  placeholder="0.00" className="input pl-8 py-3 text-xl font-mono font-bold" autoFocus />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Notes (optional)</label>
              <input type="text" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Any remarks about discrepancy" className="input px-3 py-2.5" maxLength={300} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowClose(false)} className="btn btn-secondary flex-1 py-2.5">Cancel</button>
              <button onClick={handleClose} disabled={closeSaving} className="btn btn-danger flex-1 py-2.5 font-semibold">
                {closeSaving ? 'Closing…' : 'Close & Reconcile'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
