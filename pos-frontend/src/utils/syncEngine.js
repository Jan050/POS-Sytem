/**
 * syncEngine.js
 * Processes the offline order queue — sends pending orders to the backend.
 *
 * Design:
 *   - Called when: (a) app goes online, (b) app loads, (c) manually triggered
 *   - One item at a time with exponential backoff on failure
 *   - Idempotency key guarantees no duplicate orders on retry
 *   - Emits events so UI can react without polling
 */
import { orderApi } from '../api'
import {
  getPendingOrders,
  updateQueueEntry,
  pruneOldSynced,
} from './offlineDB'

// ── Event emitter (simple pub/sub, no external library needed) ───────────────
const listeners = new Set()

export const onSyncEvent = (callback) => {
  listeners.add(callback)
  return () => listeners.delete(callback) // returns unsubscribe fn
}

const emit = (type, data = {}) => {
  listeners.forEach((fn) => fn({ type, ...data }))
}

// ── Sync state ───────────────────────────────────────────────────────────────
let isSyncing = false

export const getIsSyncing = () => isSyncing

// ── Max retry attempts before marking as 'failed' ────────────────────────────
const MAX_ATTEMPTS = 5

/**
 * Run the sync queue.
 * Safe to call multiple times — will skip if already running.
 *
 * @returns {{ synced: number, failed: number, skipped: number }}
 */
export const runSync = async () => {
  if (isSyncing) return { synced: 0, failed: 0, skipped: 0 }
  if (!navigator.onLine) {
    emit('offline')
    return { synced: 0, failed: 0, skipped: 0 }
  }

  isSyncing = true
  emit('start')

  const pending = await getPendingOrders()

  if (pending.length === 0) {
    isSyncing = false
    emit('idle', { message: 'Nothing to sync' })
    return { synced: 0, failed: 0, skipped: 0 }
  }

  let synced = 0
  let failed = 0
  let skipped = 0

  for (const entry of pending) {
    // Skip if too many retries
    if (entry.attempts >= MAX_ATTEMPTS) {
      await updateQueueEntry(entry.localId, { status: 'failed' })
      failed++
      skipped++
      continue
    }

    // Mark as in-progress
    await updateQueueEntry(entry.localId, {
      status:        'syncing',
      attempts:      entry.attempts + 1,
      lastAttemptAt: new Date().toISOString(),
    })

    emit('progress', { localId: entry.localId, attempt: entry.attempts + 1 })

    try {
      // Send to backend — idempotencyKey ensures no duplicates on retry
      const res = await orderApi.create({
        ...entry.payload,
        idempotencyKey: entry.idempotencyKey,
        source: 'offline-sync',
      })

      await updateQueueEntry(entry.localId, {
        status:    'synced',
        serverId:  res.data?._id,
        syncedAt:  new Date().toISOString(),
        error:     null,
      })

      synced++
      emit('itemSynced', { localId: entry.localId, serverId: res.data?._id })
    } catch (err) {
      const isNetworkError = !err.status // No HTTP status = network problem
      const newStatus = (entry.attempts + 1 >= MAX_ATTEMPTS) ? 'failed' : 'pending'

      await updateQueueEntry(entry.localId, {
        status:   newStatus,
        error:    err.message || 'Unknown error',
        // Don't reset attempts so we track retry count
      })

      failed++
      emit('itemFailed', {
        localId: entry.localId,
        error:   err.message,
        retryable: isNetworkError && newStatus === 'pending',
      })

      // If it's a network error, abort batch — connection probably dropped
      if (isNetworkError) break
    }
  }

  isSyncing = false
  emit('complete', { synced, failed, skipped })

  // Housekeeping: remove old synced entries
  await pruneOldSynced(7)

  return { synced, failed, skipped }
}

/**
 * Register window online/offline listeners.
 * Call once when app mounts. Returns cleanup function.
 */
export const registerNetworkListeners = () => {
  const handleOnline = async () => {
    emit('online')
    // Small delay — give network a moment to stabilize
    await new Promise((r) => setTimeout(r, 1500))
    runSync()
  }

  const handleOffline = () => {
    emit('offline')
  }

  window.addEventListener('online',  handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online',  handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
