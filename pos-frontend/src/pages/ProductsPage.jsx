import { useState, useEffect, useCallback } from 'react'
import { productApi } from '../api'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { categoryColor, formatPeso } from '../utils/formatters'

const CATEGORIES = [
  'Beverages', 'Snacks', 'Canned Goods', 'Noodles',
  'Condiments', 'Personal Care', 'Cigarettes', 'Bread', 'Dairy', 'Other',
]

const emptyForm = {
  name: '', price: '', stock: '', barcode: '', category: 'Beverages',
}

export default function ProductsPage() {
  const toast = useToast()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')

  // Modal state
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null)

  // ── Load ──────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    try {
      const res = await productApi.getAll()
      setProducts(res.data || [])
    } catch {
      toast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  // ── Filtered list ─────────────────────────────────
  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search))
    const matchCat = filterCategory === 'All' || p.category === filterCategory
    return matchSearch && matchCat
  })

  // ── Form handlers ─────────────────────────────────
  const openAdd = () => {
    setEditingProduct(null)
    setForm(emptyForm)
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (product) => {
    setEditingProduct(product)
    setForm({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      barcode: product.barcode || '',
      category: product.category || 'Beverages',
    })
    setFormError('')
    setShowForm(true)
  }

  const handleFormChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setFormError('')
  }

  const handleSave = async () => {
    // Validate
    if (!form.name.trim()) return setFormError('Product name is required')
    if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0)
      return setFormError('Enter a valid price')
    if (form.stock !== '' && (isNaN(parseInt(form.stock)) || parseInt(form.stock) < 0))
      return setFormError('Enter a valid stock number')

    setSaving(true)
    setFormError('')
    try {
      const payload = {
        name: form.name.trim(),
        price: parseFloat(form.price),
        stock: parseInt(form.stock) || 0,
        barcode: form.barcode.trim() || null,
        category: form.category,
      }

      if (editingProduct) {
        await productApi.update(editingProduct._id, payload)
        toast(`"${payload.name}" updated`, 'success')
      } else {
        await productApi.create(payload)
        toast(`"${payload.name}" added`, 'success')
      }

      setShowForm(false)
      loadProducts()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (product) => {
    try {
      await productApi.delete(product._id)
      toast(`"${product.name}" deleted`, 'success')
      loadProducts()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  // Unique categories for filter
  const allCategories = ['All', ...new Set(products.map((p) => p.category).filter(Boolean))]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ──────────────────────────────── */}
      <div className="px-4 md:px-6 py-4 bg-surface-800 border-b border-surface-700 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-semibold text-xl text-slate-100">Products</h1>
            <p className="text-slate-500 text-sm">{products.length} items in inventory</p>
          </div>
          <button onClick={openAdd} className="btn-primary px-4 py-2.5 text-sm shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        </div>

        {/* Search + category filter */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="input pl-9 py-2 text-sm"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input py-2 text-sm w-40 shrink-0"
          >
            {allCategories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* ── Product Table ────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-surface-700 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
              />
            </svg>
            <p>No products found</p>
            <button onClick={openAdd} className="btn-primary mt-4 px-5 py-2 text-sm">
              Add your first product
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-800 sticky top-0 z-10">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 md:px-6 py-3">Product</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3 hidden sm:table-cell">Category</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Price</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Stock</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 md:px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {filtered.map((product) => (
                <tr
                  key={product._id}
                  className="hover:bg-surface-800/50 transition-colors group"
                >
                  <td className="px-4 md:px-6 py-3.5">
                    <div>
                      <p className="font-medium text-slate-100 text-sm">{product.name}</p>
                      {product.barcode && (
                        <p className="font-mono text-xs text-slate-600 mt-0.5">{product.barcode}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 hidden sm:table-cell">
                    <span className={`badge ${categoryColor(product.category)}`}>
                      {product.category}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <span className="font-mono font-semibold text-amber-400 text-sm">
                      {formatPeso(product.price)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <span className={`font-mono text-sm font-semibold ${
                      product.stock === 0 ? 'text-red-400' :
                      product.stock <= 5  ? 'text-orange-400' :
                                            'text-slate-300'
                    }`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-3.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => openEdit(product)}
                        className="btn btn-secondary px-2.5 py-1.5 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(product)}
                        className="btn btn-danger px-2.5 py-1.5 text-xs"
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add/Edit Modal ───────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingProduct ? `Edit "${editingProduct.name}"` : 'Add New Product'}
        size="md"
      >
        <div className="space-y-4">
          {/* Error banner */}
          {formError && (
            <div className="bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2.5 text-sm text-red-300 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Product Name *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              placeholder="e.g. Coke 250ml"
              className="input px-3 py-2.5"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Price (₱) *</label>
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={handleFormChange}
                placeholder="0.00"
                className="input px-3 py-2.5 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Stock</label>
              <input
                name="stock"
                type="number"
                min="0"
                value={form.stock}
                onChange={handleFormChange}
                placeholder="0"
                className="input px-3 py-2.5 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleFormChange}
              className="input px-3 py-2.5"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              Barcode <span className="text-slate-600">(optional)</span>
            </label>
            <input
              name="barcode"
              value={form.barcode}
              onChange={handleFormChange}
              placeholder="Scan or type barcode"
              className="input px-3 py-2.5 font-mono"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="btn btn-secondary flex-1 py-2.5"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1 py-2.5 font-semibold"
            >
              {saving ? 'Saving…' : editingProduct ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirm ───────────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
