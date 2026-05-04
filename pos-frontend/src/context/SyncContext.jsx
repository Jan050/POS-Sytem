/**
 * SyncContext.jsx
 * Provides app-wide sync state: pending count, sync status, manual trigger.
 *
 * Architecture:
 *   - Mounts network listeners once at app startup
 *   - Polls pending count every 30s (cheap — just a DB count)
 *   - Exposes { pendingCount, syncStatus, isSyncing, forceSync } to all components
 */
import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef,
} from 'react'
import {
  runSync,
  registerNetworkListeners,
  onSyncEvent,
} from '../utils/syncEngine'
import { getPendingCount } from '../utils/offlineDB'

// ── Status values ─────────────────────────────────────────────────────────────
export const SYNC_STATUS = {
  IDLE:    'idle',     // 🟢 all synced
  PENDING: 'pending',  // 🟡 has items waiting
  SYNCING: 'syncing',  // 🔵 actively syncing
  FAILED:  'failed',   // 🔴 one or more items failed
  OFFLINE: 'offline',  // ⚫ no network
}

const SyncContext = createContext(null)

export const SyncProvider = ({ children }) => {
  const [pendingCount, setPendingCount] = useState(0)
  const [syncStatus,   setSyncStatus]   = useState(SYNC_STATUS.IDLE)
  const [isSyncing,    setIsSyncing]    = useState(false)
  const [lastSyncAt,   setLastSyncAt]   = useState(null)
  const pollRef = useRef(null)

  // Refresh the pending count from IndexedDB
  const refreshCount = useCallback(async () => {
    const count = await getPendingCount()
    setPendingCount(count)
    if (count > 0 && syncStatus !== SYNC_STATUS.SYNCING) {
      setSyncStatus(navigator.onLine ? SYNC_STATUS.PENDING : SYNC_STATUS.OFFLINE)
    } else if (count === 0 && syncStatus !== SYNC_STATUS.SYNCING) {
      setSyncStatus(navigator.onLine ? SYNC_STATUS.IDLE : SYNC_STATUS.OFFLINE)
    }
  }, [syncStatus])

  // Subscribe to sync engine events
  useEffect(() => {
    const unsubscribe = onSyncEvent((event) => {
      switch (event.type) {
        case 'start':
          setIsSyncing(true)
          setSyncStatus(SYNC_STATUS.SYNCING)
          break
        case 'complete':
          setIsSyncing(false)
          setLastSyncAt(new Date())
          setSyncStatus(event.failed > 0 ? SYNC_STATUS.FAILED : SYNC_STATUS.IDLE)
          refreshCount()
          break
        case 'online':
          if (syncStatus !== SYNC_STATUS.SYNCING) {
            setSyncStatus(pendingCount > 0 ? SYNC_STATUS.PENDING : SYNC_STATUS.IDLE)
          }
          break
        case 'offline':
          setSyncStatus(SYNC_STATUS.OFFLINE)
          break
        case 'idle':
          setSyncStatus(navigator.onLine ? SYNC_STATUS.IDLE : SYNC_STATUS.OFFLINE)
          break
      }
    })
    return unsubscribe
  }, [syncStatus, pendingCount, refreshCount])

  // Register global online/offline listeners + run sync on mount
  useEffect(() => {
    const cleanup = registerNetworkListeners()

    // Sync any leftover queue from previous session
    refreshCount().then(() => {
      if (navigator.onLine) runSync()
    })

    // Poll pending count every 30s
    pollRef.current = setInterval(refreshCount, 30_000)

    return () => {
      cleanup()
      clearInterval(pollRef.current)
    }
  }, []) // eslint-disable-line

  // Manual sync trigger (e.g. user taps the sync indicator)
  const forceSync = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return
    await runSync()
    await refreshCount()
  }, [isSyncing, refreshCount])

  return (
    <SyncContext.Provider value={{
      pendingCount,
      syncStatus,
      isSyncing,
      lastSyncAt,
      forceSync,
      refreshCount,
    }}>
      {children}
    </SyncContext.Provider>
  )
}

export const useSync = () => {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>')
  return ctx
}
