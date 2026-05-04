/**
 * offlineDB.js
 * IndexedDB wrapper using the `idb` library.
 *
 * Two stores:
 *   orderQueue  — orders pending sync to backend
 *   localOrders — completed orders saved locally (for offline receipt / history)
 *
 * Why IndexedDB over localStorage?
 *   - Larger storage limit (50MB+ vs 5MB)
 *   - Async — doesn't block the UI thread
 *   - Survives browser crashes better
 *   - Proper querying + indexing
 */
import { openDB } from 'idb'

const DB_NAME    = 'tindahan-pos'
const DB_VERSION = 1

// ── Open / upgrade DB ────────────────────────────────────────────────────────
const getDB = (() => {
  let dbPromise = null
  return () => {
    if (!dbPromise) {
      dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // ── Order queue: holds unsent orders ─────────────────────────
          if (!db.objectStoreNames.contains('orderQueue')) {
            const store = db.createObjectStore('orderQueue', { keyPath: 'localId' })
            store.createIndex('status',    'status')    // 'pending' | 'syncing' | 'synced' | 'failed'
            store.createIndex('createdAt', 'createdAt')
          }

          // ── Local orders: full order history even when offline ────────
          if (!db.objectStoreNames.contains('localOrders')) {
            const store = db.createObjectStore('localOrders', { keyPath: 'localId' })
            store.createIndex('createdAt', 'createdAt')
          }
        },
      })
    }
    return dbPromise
  }
})()

// ── Order Queue operations ───────────────────────────────────────────────────

/**
 * Add an order to the sync queue.
 * Called at checkout time — works offline and online.
 */
export const enqueueOrder = async (orderPayload) => {
  const db = await getDB()
  const entry = {
    localId:        orderPayload.localId,           // UUID generated on client
    idempotencyKey: orderPayload.localId,           // Same as localId — unique per order
    payload:        orderPayload,
    status:         'pending',
    attempts:       0,
    lastAttemptAt:  null,
    error:          null,
    createdAt:      new Date().toISOString(),
  }
  await db.put('orderQueue', entry)
  return entry
}

/** Get all orders with a specific status */
export const getQueueByStatus = async (status) => {
  const db = await getDB()
  return db.getAllFromIndex('orderQueue', 'status', status)
}

/** Get all pending + failed orders (eligible for retry) */
export const getPendingOrders = async () => {
  const db = await getDB()
  const [pending, failed] = await Promise.all([
    db.getAllFromIndex('orderQueue', 'status', 'pending'),
    db.getAllFromIndex('orderQueue', 'status', 'failed'),
  ])
  return [...pending, ...failed]
}

/** Update the status + metadata of a queued order */
export const updateQueueEntry = async (localId, updates) => {
  const db    = await getDB()
  const entry = await db.get('orderQueue', localId)
  if (!entry) return null
  const updated = { ...entry, ...updates }
  await db.put('orderQueue', updated)
  return updated
}

/** Count how many orders are pending sync */
export const getPendingCount = async () => {
  const pending = await getQueueByStatus('pending')
  const failed  = await getQueueByStatus('failed')
  return pending.length + failed.length
}

/** Get all queue entries (for the sync status panel) */
export const getAllQueueEntries = async () => {
  const db = await getDB()
  return db.getAll('orderQueue')
}

/** Remove synced orders older than N days (keep DB clean) */
export const pruneOldSynced = async (daysOld = 7) => {
  const db      = await getDB()
  const cutoff  = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)
  const all     = await db.getAllFromIndex('orderQueue', 'status', 'synced')
  const toDelete = all.filter((e) => new Date(e.createdAt) < cutoff)
  const tx = db.transaction('orderQueue', 'readwrite')
  await Promise.all(toDelete.map((e) => tx.store.delete(e.localId)))
  await tx.done
  return toDelete.length
}

// ── Local Orders (receipt / history while offline) ───────────────────────────

/** Save a local order record (shown in receipt + offline history) */
export const saveLocalOrder = async (order) => {
  const db = await getDB()
  await db.put('localOrders', { ...order, savedAt: new Date().toISOString() })
}

/** Get recent local orders */
export const getLocalOrders = async (limit = 30) => {
  const db  = await getDB()
  const all = await db.getAll('localOrders')
  return all
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
}

export default getDB
