import { useState, useEffect, useCallback } from 'react'
import { supplierApi } from '../api'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { formatPeso, formatDate } from '../utils/formatters'
import { productApi } from '../api'

export default function SupplierPage() {
  const toast = useToast()

  // Suppliers
  const [suppliers,     setSuppliers]     = useState([])
  const [purchases,     setPurchases]     = useState([])
  const [loadingS,      setLoadingS]      = useState(true)
  const [loadingP,      setLoadingP]      = useState(true)
  const [activeTab,     setActiveTab]     = useState('suppliers') // 'suppliers' | 'purchases'

  // Supplier form
  const [showForm,      setShowForm]      = useState(false)
  const [editTarget,    setEditTarget]    = useState(null)
  const [supplierForm,  setSupplierForm]  = useState({ name: '', contact: '', address: '', notes: '' })
  const [formError,     setFormError]     = useState('')
  const [savingS,       setSavingS]       = useState(false)
  const [deleteTarget,  setDeleteTarget]  = useState(null)

  // Purchase log form
  const [showPurchase,  setShowPurchase]  = useState(false)
  const [products,      setProducts]      = useState([])
  const [purchaseForm,  setPurchaseForm]  = useState({
    supplierId: '', notes: '', date: new Date().toISOString().split('T')[0], restockProducts: true,
  })
  const [purchaseItems, setPurchaseItems] = useState([
    { productId: '', name: '', qty: '1', unitCost: '' }
  ])
  const [purchaseError, setPurchaseError] = useState('')
  const [savingP,       setSavingP]       = useState(false)

  const loadSuppliers = useCallback(async () => {
    setLoadingS(true)
    try {
      const res = await supplierApi.getAll()
      setSuppliers(res.data || [])
    } catch { toast('Failed to load suppliers', 'error') }
    finally { setLoadingS(false) }
  }, [])

  const loadPurchases = useCallback(async () => {
    setLoadingP(true)
    try {
      const res = await supplierApi.getPurchases()
      setPurchases(res.data || [])
    } catch { toast('Failed to load purchases', 'error') }
    finally { setLoadingP(false) }
  }, [])

  useEffect(() => {
    loadSuppliers()
    loadPurchases()
    productApi.getAll().then(r => setProducts(r.data || [])).catch(() => {})
  }, [loadSuppliers, loadPurchases])

  // ── Supplier CRUD ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null)
    setSupplierForm({ name: '', contact: '', address: '', notes: '' })
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (s) => {
    setEditTarget(s)
    setSupplierForm({ name: s.name, contact: s.contact, address: s.address, notes: s.notes })
    setFormError('')
    setShowForm(true)
  }

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) return setFormError('Supplier name is required')
    setSavingS(true); setFormError('')
    try {
      if (editTarget) {
        await supplierApi.update(editTarget._id, supplierForm)
        toast('Supplier updated', 'success')
      } else {
        await supplierApi.create(supplierForm)
        toast('Supplier added', 'success')
      }
      setShowForm(false)
      loadSuppliers()
    } catch (err) { setFormError(err.message) }
    finally { setSavingS(false) }
  }

  const handleDeleteSupplier = async () => {
    try {
      await supplierApi.delete(deleteTarget._id)
      toast('Supplier removed', 'success')
      loadSuppliers()
    } catch { toast('Failed to remove', 'error') }
  }

  // ── Purchase Log ─────────────────────────────────────────────────────────
  const updatePurchaseItem = (i, field, val) => {
    setPurchaseItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [field]: val }
      // auto-fill name when product selected
      if (field === 'productId' && val) {
        const p = products.find(p => p._id === val)
        if (p) { updated.name = p.name; updated.unitCost = p.price.toString() }
      }
      return updated
    }))
  }

  const addPurchaseItem   = () => setPurchaseItems(p => [...p, { productId: '', name: '', qty: '1', unitCost: '' }])
  const removePurchaseItem = (i) => { if (purchaseItems.length > 1) setPurchaseItems(p => p.filter((_, idx) => idx !== i)) }

  const purchaseTotal = purchaseItems.reduce((s, i) => {
    const qty  = parseInt(i.qty)  || 0
    const cost = parseFloat(i.unitCost) || 0
    return s + qty * cost
  }, 0)

  const handleSavePurchase = async () => {
    for (const item of purchaseItems) {
      if (!item.name.trim()) return setPurchaseError('All items must have a name')
      if (!item.qty || parseInt(item.qty) < 1) return setPurchaseError('Quantity must be ≥ 1')
      if (!item.unitCost || parseFloat(item.unitCost) < 0) return setPurchaseError('Unit cost must be ≥ 0')
    }
    setSavingP(true); setPurchaseError('')
    try {
      await supplierApi.createPurchase({
        supplierId:      purchaseForm.supplierId || null,
        notes:           purchaseForm.notes,
        date:            purchaseForm.date,
        restockProducts: purchaseForm.restockProducts,
        items: purchaseItems.map(i => ({
          productId: i.productId || null,
          name:      i.name.trim(),
          qty:       parseInt(i.qty),
          unitCost:  parseFloat(i.unitCost),
        })),
      })
      toast('Purchase recorded ✅', 'success')
      setShowPurchase(false)
      setPurchaseItems([{ productId: '', name: '', qty: '1', unitCost: '' }])
      setPurchaseForm({ supplierId: '', notes: '', date: new Date().toISOString().split('T')[0], restockProducts: true })
      loadPurchases()
    } catch (err) { setPurchaseError(err.message) }
    finally { setSavingP(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 bg-surface-800 border-b border-surface-700 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-semibold text-xl text-slate-100">Suppliers</h1>
            <p className="text-slate-500 text-sm">Track suppliers and purchase history</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowPurchase(true)} className="btn btn-secondary px-4 py-2 text-sm">
              + Purchase
            </button>
            {activeTab === 'suppliers' && (
              <button onClick={openAdd} className="btn-primary px-4 py-2 text-sm">
                + Supplier
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 bg-surface-700 rounded-xl p-1 w-fit">
          {[
            { key: 'suppliers', label: `Suppliers (${suppliers.length})` },
            { key: 'purchases', label: `Purchases (${purchases.length})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${activeTab === key ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* ── Suppliers Tab ─────────────────────────────── */}
        {activeTab === 'suppliers' && (
          <div className="card overflow-hidden">
            {loadingS ? (
              <div className="divide-y divide-surface-700">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="px-4 py-4 animate-pulse h-14 bg-surface-700 rounded mb-2"/>
                ))}
              </div>
            ) : suppliers.length === 0 ? (
              <div className="text-center py-14 text-slate-600">
                <span className="text-4xl block mb-3">🏭</span>
                <p className="text-sm">No suppliers yet</p>
                <button onClick={openAdd} className="btn-primary mt-4 px-5 py-2 text-sm">
                  Add first supplier
                </button>
              </div>
            ) : (
              <div className="divide-y divide-surface-700">
                {suppliers.map(s => (
                  <div key={s._id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-700/30 group">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-200">{s.name}</p>
                      {(s.contact || s.address) && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[s.contact, s.address].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(s)}
                        className="btn btn-secondary px-2.5 py-1.5 text-xs">Edit</button>
                      <button onClick={() => setDeleteTarget(s)}
                        className="btn btn-danger px-2.5 py-1.5 text-xs">Del</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Purchases Tab ─────────────────────────────── */}
        {activeTab === 'purchases' && (
          <div className="space-y-3">
            {loadingP ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-surface-700 animate-pulse"/>
              ))
            ) : purchases.length === 0 ? (
              <div className="text-center py-14 text-slate-600 card p-6">
                <span className="text-4xl block mb-3">📦</span>
                <p className="text-sm">No purchases recorded</p>
                <button onClick={() => setShowPurchase(true)} className="btn-primary mt-4 px-5 py-2 text-sm">
                  Record first purchase
                </button>
              </div>
            ) : purchases.map(p => (
              <div key={p._id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-200 text-sm">
                      {p.supplier?.name || p.supplierName || 'Unknown supplier'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDate(p.date)} · {p.items.length} item{p.items.length !== 1 ? 's' : ''}
                      {p.restockProducts ? ' · ✅ restocked' : ''}
                    </p>
                    {p.notes && <p className="text-xs text-slate-600 mt-1">📝 {p.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-red-400 text-sm">{formatPeso(p.totalCost)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">total cost</p>
                  </div>
                </div>
                {/* Items breakdown */}
                <div className="mt-2 pt-2 border-t border-surface-700 space-y-1">
                  {p.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-400">
                      <span>{item.name} × {item.qty}</span>
                      <span className="font-mono">{formatPeso(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Supplier Form Modal ─────────────────────────── */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)}
        title={editTarget ? `Edit "${editTarget.name}"` : 'Add Supplier'} size="md">
        <div className="space-y-4">
          {formError && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{formError}</p>}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Supplier Name *</label>
            <input type="text" value={supplierForm.name}
              onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. San Miguel Distributors" className="input px-3 py-2.5" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Contact</label>
              <input type="text" value={supplierForm.contact}
                onChange={e => setSupplierForm(p => ({ ...p, contact: e.target.value }))}
                placeholder="09xx…" className="input px-3 py-2.5" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Address</label>
              <input type="text" value={supplierForm.address}
                onChange={e => setSupplierForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Brgy, City…" className="input px-3 py-2.5" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Notes</label>
            <input type="text" value={supplierForm.notes}
              onChange={e => setSupplierForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Delivery schedule, terms…" className="input px-3 py-2.5" maxLength={300} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowForm(false)} className="btn btn-secondary flex-1 py-2.5">Cancel</button>
            <button onClick={handleSaveSupplier} disabled={savingS} className="btn-primary flex-1 py-2.5 font-semibold">
              {savingS ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Supplier'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Purchase Log Modal ──────────────────────────── */}
      <Modal isOpen={showPurchase} onClose={() => setShowPurchase(false)}
        title="Record Purchase" size="lg">
        <div className="space-y-4">
          {purchaseError && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{purchaseError}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Supplier</label>
              <select value={purchaseForm.supplierId}
                onChange={e => setPurchaseForm(p => ({ ...p, supplierId: e.target.value }))}
                className="input px-3 py-2.5 text-sm">
                <option value="">— Select supplier —</option>
                {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Date</label>
              <input type="date" value={purchaseForm.date}
                onChange={e => setPurchaseForm(p => ({ ...p, date: e.target.value }))}
                className="input px-3 py-2.5" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 font-medium">Items *</label>
              <button onClick={addPurchaseItem}
                className="text-xs text-amber-400 hover:text-amber-300">+ Add item</button>
            </div>
            <div className="space-y-2">
              {purchaseItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  {/* Product picker */}
                  <select
                    value={item.productId}
                    onChange={e => updatePurchaseItem(i, 'productId', e.target.value)}
                    className="input py-2 px-2 text-xs col-span-4">
                    <option value="">Custom item…</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>

                  {/* Name (editable if custom) */}
                  <input type="text" value={item.name}
                    onChange={e => updatePurchaseItem(i, 'name', e.target.value)}
                    placeholder="Item name"
                    className="input py-2 px-2 text-xs col-span-3"
                    readOnly={!!item.productId}
                  />

                  {/* Qty */}
                  <input type="number" min="1" value={item.qty}
                    onChange={e => updatePurchaseItem(i, 'qty', e.target.value)}
                    placeholder="Qty" className="input py-2 px-2 text-xs font-mono col-span-2"/>

                  {/* Unit cost */}
                  <input type="number" min="0" step="0.01" value={item.unitCost}
                    onChange={e => updatePurchaseItem(i, 'unitCost', e.target.value)}
                    placeholder="Cost" className="input py-2 px-2 text-xs font-mono col-span-2"/>

                  {purchaseItems.length > 1 && (
                    <button onClick={() => removePurchaseItem(i)}
                      className="col-span-1 text-slate-500 hover:text-red-400 flex justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between font-mono text-sm border-t border-surface-700 pt-3">
            <span className="text-slate-400">Total Cost</span>
            <span className="font-bold text-red-400">{formatPeso(purchaseTotal)}</span>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Notes</label>
            <input type="text" value={purchaseForm.notes}
              onChange={e => setPurchaseForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Payment terms, delivery info…" className="input px-3 py-2.5" maxLength={300}/>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={purchaseForm.restockProducts}
              onChange={e => setPurchaseForm(p => ({ ...p, restockProducts: e.target.checked }))}
              className="w-4 h-4 accent-amber-500" />
            <span className="text-sm text-slate-300">Auto-add quantities to product stock</span>
          </label>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowPurchase(false)} className="btn btn-secondary flex-1 py-2.5">Cancel</button>
            <button onClick={handleSavePurchase} disabled={savingP} className="btn-primary flex-1 py-2.5 font-semibold">
              {savingP ? 'Saving…' : 'Record Purchase'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSupplier}
        title="Remove Supplier" message={`Remove "${deleteTarget?.name}"?`}
        confirmLabel="Remove" danger />
    </div>
  )
}