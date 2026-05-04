/**
 * SyncStatus.jsx
 * Compact sync indicator for the Layout sidebar/header.
 * Click to manually trigger sync or expand details.
 *
 * States:
 *   🟢 Synced    — online, nothing pending
 *   🔵 Syncing   — actively pushing to backend
 *   🟡 Pending   — online but has unsent orders
 *   🔴 Failed    — one or more orders couldn't sync
 *   ⚫ Offline   — no internet detected
 */
import { useState } from 'react'
import { useSync, SYNC_STATUS } from '../../context/SyncContext'

const STATUS_CONFIG = {
  [SYNC_STATUS.IDLE]: {
    dot:   'bg-green-500',
    ring:  'ring-green-500/30',
    text:  'Synced',
    color: 'text-green-400',
    pulse: false,
  },
  [SYNC_STATUS.SYNCING]: {
    dot:   'bg-blue-500',
    ring:  'ring-blue-500/30',
    text:  'Syncing…',
    color: 'text-blue-400',
    pulse: true,
  },
  [SYNC_STATUS.PENDING]: {
    dot:   'bg-amber-500',
    ring:  'ring-amber-500/30',
    text:  'Pending',
    color: 'text-amber-400',
    pulse: true,
  },
  [SYNC_STATUS.FAILED]: {
    dot:   'bg-red-500',
    ring:  'ring-red-500/30',
    text:  'Sync Error',
    color: 'text-red-400',
    pulse: false,
  },
  [SYNC_STATUS.OFFLINE]: {
    dot:   'bg-slate-500',
    ring:  'ring-slate-500/20',
    text:  'Offline',
    color: 'text-slate-500',
    pulse: false,
  },
}

// ── Compact dot-only version (for sidebar icon slot) ─────────────────────────
export const SyncDot = ({ onClick }) => {
  const { syncStatus, pendingCount, isSyncing } = useSync()
  const cfg = STATUS_CONFIG[syncStatus] || STATUS_CONFIG[SYNC_STATUS.IDLE]

  return (
    <button
      onClick={onClick}
      title={`${cfg.text}${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`}
      className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-700 transition-colors"
    >
      {/* Outer ring (pulse for active states) */}
      <span className={`absolute inset-0 rounded-lg ring-2 ${cfg.ring} ${cfg.pulse ? 'animate-pulse' : ''} opacity-50`} />

      {/* Spinner overlay when syncing */}
      {isSyncing ? (
        <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
      )}

      {/* Badge for pending count */}
      {pendingCount > 0 && !isSyncing && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-amber-500 text-slate-900 text-[9px] font-bold rounded-full flex items-center justify-center px-1">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </button>
  )
}

// ── Expanded panel (shown on click / hover) ───────────────────────────────────
const SyncPanel = ({ onClose }) => {
  const { syncStatus, pendingCount, isSyncing, lastSyncAt, forceSync } = useSync()
  const cfg = STATUS_CONFIG[syncStatus] || STATUS_CONFIG[SYNC_STATUS.IDLE]

  const handleSync = async () => {
    await forceSync()
  }

  return (
    <div
      className="absolute bottom-14 left-2 z-50 w-64 card shadow-2xl border border-surface-600 animate-pop"
    >
      <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Sync Status</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
      </div>

      <div className="p-4 space-y-3">
        {/* Status row */}
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full shrink-0 ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
          <div>
            <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.text}</p>
            <p className="text-xs text-slate-500">
              {syncStatus === SYNC_STATUS.OFFLINE
                ? 'Orders saved locally'
                : pendingCount > 0
                  ? `${pendingCount} order${pendingCount > 1 ? 's' : ''} waiting to sync`
                  : lastSyncAt
                    ? `Last synced ${lastSyncAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
                    : 'All transactions synced'
              }
            </p>
          </div>
        </div>

        {/* Offline explanation */}
        {syncStatus === SYNC_STATUS.OFFLINE && (
          <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 leading-relaxed">
            📡 No internet connection. Orders are safely stored on this device and will sync automatically when you're back online.
          </div>
        )}

        {/* Failed explanation */}
        {syncStatus === SYNC_STATUS.FAILED && (
          <div className="bg-red-900/30 border border-red-700/30 rounded-lg p-3 text-xs text-red-300 leading-relaxed">
            ⚠️ Some orders failed to sync. They won't be lost — tap "Retry Sync" to try again.
          </div>
        )}

        {/* Sync button */}
        {(syncStatus === SYNC_STATUS.PENDING || syncStatus === SYNC_STATUS.FAILED) && (
          <button
            onClick={handleSync}
            disabled={isSyncing || !navigator.onLine}
            className="btn-primary w-full py-2 text-sm font-semibold"
          >
            {isSyncing ? (
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing…
              </span>
            ) : '↑ Retry Sync'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main export: Dot + optional expanded panel ────────────────────────────────
const SyncStatus = () => {
  const [showPanel, setShowPanel] = useState(false)

  return (
    <div className="relative">
      <SyncDot onClick={() => setShowPanel((v) => !v)} />
      {showPanel && <SyncPanel onClose={() => setShowPanel(false)} />}
    </div>
  )
}

export default SyncStatus
