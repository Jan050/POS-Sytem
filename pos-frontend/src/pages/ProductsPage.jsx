// ProductsPage.jsx

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
  name: '',
  price: '',
  stock: '',
  barcode: '',
  category: 'Beverages',
  lowStockThreshold: '5',
  wholesalePrice: '',
  wholesaleMinQty: '1',
  imageUrl: '',
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

  // Restock
  const [restockTarget, setRestockTarget] = useState(null)
  const [restockQty, setRestockQty] = useState('')
  const [restockError, setRestockError] = useState('')
  const [restockSaving, setRestockSaving] = useState(false)

  // Low stock alert count
  const [lowStockCount, setLowStockCount] = useState(0)

  // Load products
  const loadProducts = useCallback(async () => {
    try {
      const [prodRes, lowRes] = await Promise.all([
        productApi.getAll(),
        productApi.getLowStock(),
      ])

      setProducts(prodRes.data || [])
      setLowStockCount(lowRes.count || 0)
    } catch {
      toast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // Filtered list
  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search))

    const matchCat =
      filterCategory === 'All' || p.category === filterCategory

    return matchSearch && matchCat
  })

  // Form handlers
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

      lowStockThreshold:
        (product.lowStockThreshold ?? 5).toString(),

      wholesalePrice:
        product.wholesalePrice != null
          ? product.wholesalePrice.toString()
          : '',

      wholesaleMinQty:
        (product.wholesaleMinQty || 1).toString(),

      imageUrl: product.imageUrl || '',
    })

    setFormError('')
    setShowForm(true)
  }

  const handleFormChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))

    setFormError('')
  }

  const handleSave = async () => {
    // Validation
    if (!form.name.trim()) {
      return setFormError('Product name is required')
    }

    if (
      !form.price ||
      isNaN(parseFloat(form.price)) ||
      parseFloat(form.price) < 0
    ) {
      return setFormError('Enter a valid price')
    }

    if (
      form.stock !== '' &&
      (
        isNaN(parseInt(form.stock)) ||
        parseInt(form.stock) < 0
      )
    ) {
      return setFormError('Enter a valid stock number')
    }

    if (
      form.wholesalePrice &&
      (
        isNaN(parseFloat(form.wholesalePrice)) ||
        parseFloat(form.wholesalePrice) < 0
      )
    ) {
      return setFormError('Enter a valid wholesale price')
    }

    if (
      form.wholesaleMinQty &&
      (
        isNaN(parseInt(form.wholesaleMinQty)) ||
        parseInt(form.wholesaleMinQty) < 1
      )
    ) {
      return setFormError('Minimum wholesale quantity must be at least 1')
    }

    setSaving(true)
    setFormError('')

    try {
      const payload = {
        name: form.name.trim(),
        price: parseFloat(form.price),
        stock: parseInt(form.stock) || 0,
        barcode: form.barcode.trim() || null,
        category: form.category,

        lowStockThreshold:
          parseInt(form.lowStockThreshold) >= 0
            ? parseInt(form.lowStockThreshold)
            : 5,

        wholesalePrice:
          form.wholesalePrice !== ''
            ? parseFloat(form.wholesalePrice)
            : null,

        wholesaleMinQty:
          parseInt(form.wholesaleMinQty) >= 1
            ? parseInt(form.wholesaleMinQty)
            : 1,

        imageUrl: form.imageUrl.trim() || null,
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

  const handleRestock = async () => {
    const qty = parseInt(restockQty)

    if (!Number.isInteger(qty) || qty === 0) {
      return setRestockError('Enter a non-zero quantity')
    }

    setRestockSaving(true)
    setRestockError('')

    try {
      const res = await productApi.restock(
        restockTarget._id,
        { quantity: qty }
      )

      toast(res.message, 'success')

      setRestockTarget(null)
      setRestockQty('')

      loadProducts()
    } catch (err) {
      setRestockError(err.message)
    } finally {
      setRestockSaving(false)
    }
  }

  const allCategories = [
    'All',
    ...new Set(
      products.map((p) => p.category).filter(Boolean)
    ),
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 md:px-6 py-4 bg-surface-800 border-b border-surface-700 shrink-0">
        <div className="flex items-center justify-between gap-4">

          <div>
            <h1 className="font-display font-semibold text-xl text-slate-100">
              Products
            </h1>

            <p className="text-slate-500 text-sm">
              {products.length} items in inventory
            </p>
          </div>

          <button
            onClick={openAdd}
            className="btn-primary px-4 py-2.5 text-sm shrink-0"
          >
            Add Product
          </button>
        </div>

        {/* Search + category */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">

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
            onChange={(e) =>
              setFilterCategory(e.target.value)
            }
            className="input py-2 text-sm w-40 shrink-0"
          >
            {allCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Table */}
      <div className="flex-1 overflow-y-auto">
        {/* existing table code unchanged */}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={
          editingProduct
            ? `Edit "${editingProduct.name}"`
            : 'Add New Product'
        }
        size="md"
      >
        <div className="space-y-4">

          {/* Error */}
          {formError && (
            <div className="bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2.5 text-sm text-red-300">
              {formError}
            </div>
          )}

          {/* Product Name */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              Product Name *
            </label>

            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              placeholder="e.g. Coke 250ml"
              className="input px-3 py-2.5"
              autoFocus
            />
          </div>

          {/* Price + Stock */}
          <div className="grid grid-cols-2 gap-3">

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                Price (₱) *
              </label>

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
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                Stock
              </label>

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

          {/* Category */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              Category
            </label>

            <select
              name="category"
              value={form.category}
              onChange={handleFormChange}
              className="input px-3 py-2.5"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Barcode */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              Barcode
            </label>

            <input
              name="barcode"
              value={form.barcode}
              onChange={handleFormChange}
              placeholder="Scan or type barcode"
              className="input px-3 py-2.5 font-mono"
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              Product Image URL
            </label>

            <input
              name="imageUrl"
              value={form.imageUrl}
              onChange={handleFormChange}
              placeholder="https://..."
              className="input px-3 py-2.5 text-sm"
            />

            {form.imageUrl && (
              <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden border border-surface-600 bg-surface-700">
                <img
                  src={form.imageUrl}
                  alt="preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = ''
                  }}
                />
              </div>
            )}
          </div>

          {/* Low Stock */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              Low Stock Alert Threshold
            </label>

            <input
              name="lowStockThreshold"
              type="number"
              min="0"
              value={form.lowStockThreshold}
              onChange={handleFormChange}
              placeholder="5"
              className="input px-3 py-2.5 font-mono"
            />
          </div>

          {/* Wholesale Fields */}
          <div className="grid grid-cols-2 gap-3">

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                Wholesale Price{' '}
                <span className="text-slate-600">
                  (optional)
                </span>
              </label>

              <input
                name="wholesalePrice"
                type="number"
                step="0.01"
                min="0"
                value={form.wholesalePrice}
                onChange={handleFormChange}
                placeholder="e.g. 18.00"
                className="input px-3 py-2.5 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                Min Qty for Wholesale
              </label>

              <input
                name="wholesaleMinQty"
                type="number"
                min="1"
                value={form.wholesaleMinQty}
                onChange={handleFormChange}
                placeholder="1"
                className="input px-3 py-2.5 font-mono"
              />
            </div>
          </div>

          {/* Buttons */}
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
              {saving
                ? 'Saving…'
                : editingProduct
                ? 'Save Changes'
                : 'Add Product'}
            </button>
          </div>
        </div>
      </Modal>

      {/* existing Restock Modal + ConfirmDialog unchanged */}

    </div>
  )
}