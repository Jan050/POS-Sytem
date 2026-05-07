import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { productApi, orderApi } from '../api'
import { holdOrderApi } from '../api'
import { useCart } from '../hooks/useCart'
import { useToast } from '../components/ui/Toast'
import useDebounce from '../hooks/useDebounce'
import ProductCard from '../components/ProductCard'
import CartItem from '../components/CartItem'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { printReceipt } from '../utils/printReceipt'
import { formatPeso } from '../utils/formatters'
import HeldOrdersDrawer from '../components/HeldOrdersDrawer'
import HoldLabelModal from '../components/HoldLabelModal'
import SplitPaymentPanel from '../components/SplitPaymentPanel'

const QUICK_ITEM_KEY = 'pos_quick_items'

const loadQuickIds = () => {
  try {
    return JSON.parse(localStorage.getItem(QUICK_ITEM_KEY)) || []
  } catch {
    return []
  }
}

const saveQuickIds = (ids) =>
  localStorage.setItem(QUICK_ITEM_KEY, JSON.stringify(ids))

const validateCashInput = (rawCash, total) => {
  if (rawCash === '' || rawCash === null || rawCash === undefined)
    return { valid: false, message: 'Please enter cash received' }

  const num = Number(rawCash)

  if (!Number.isFinite(num))
    return { valid: false, message: 'Cash must be a valid number' }

  if (num < 0)
    return { valid: false, message: 'Cash cannot be negative' }

  if (num < total)
    return {
      valid: false,
      message: `Cash ₱${num.toFixed(2)} is less than total ₱${total.toFixed(2)}`
    }

  return { valid: true, message: null }
}

export default function POSPage() {
  const toast = useToast()

  const {
    cart,
    total: cartSubtotal,
    itemCount,
    addToCart,
    removeFromCart,
    incrementQty,
    decrementQty,
    overridePrice,
    clearCart
  } = useCart()

  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [categories, setCategories] = useState(['All'])
  const [loading, setLoading] = useState(true)

  // ── PRICE LEVEL STATE ──────────────────────────────
  const [priceLevel, setPriceLevel] = useState('retail') // retail | wholesale

  const [cash, setCash] = useState('')
  const [cashError, setCashError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  // ── Split Payment State ─────────────────────────────
  const [paymentMode, setPaymentMode] = useState('cash')
  const [splitPayments, setSplitPayments] = useState([])
  const [splitValid, setSplitValid] = useState(false)

  const [showReceipt, setShowReceipt] = useState(false)
  const [lastOrder, setLastOrder] = useState(null)
  const [quickIds, setQuickIds] = useState(loadQuickIds)
  const [showCartMobile, setShowCartMobile] = useState(false)

  const [autoPrint, setAutoPrint] = useState(
    () => localStorage.getItem('pos_autoprint') !== 'false'
  )

  const [paperWidth, setPaperWidth] = useState(
    () => localStorage.getItem('pos_paper') || '80mm'
  )

  // Hold order state
  const [showHeld, setShowHeld] = useState(false)
  const [showHoldLabel, setShowHoldLabel] = useState(false)
  const [heldCount, setHeldCount] = useState(0)
  const [holdSaving, setHoldSaving] = useState(false)

  // Discount state
  const [discountType, setDiscountType] = useState('none')
  const [discountValue, setDiscountValue] = useState('')

  // Custom item state
  const [showCustomItem, setShowCustomItem] = useState(false)

  const [customItem, setCustomItem] = useState({
    name: '',
    price: '',
    quantity: '1'
  })

  const [customError, setCustomError] = useState('')

  const searchRef = useRef(null)

  const debouncedSearch = useDebounce(search, 300)

  const discountAmount = useMemo(() => {
    const v = parseFloat(discountValue)

    if (!v || v <= 0 || discountType === 'none') return 0

    if (discountType === 'percent') {
      return parseFloat(((v / 100) * cartSubtotal).toFixed(2))
    }

    return parseFloat(Math.min(v, cartSubtotal).toFixed(2))
  }, [discountType, discountValue, cartSubtotal])

  const total = parseFloat(
    (cartSubtotal - discountAmount).toFixed(2)
  )

  const cashValidation = useMemo(
    () => validateCashInput(cash, total),
    [cash, total]
  )

  const change =
    cash !== '' && cashValidation.valid
      ? parseFloat((Number(cash) - total).toFixed(2))
      : null

  // ── Updated Checkout Disabled Logic ─────────────────
  const isCheckoutDisabled =
    checkoutLoading ||
    cart.length === 0 ||
    (paymentMode === 'cash' &&
      (cash === '' || !cashValidation.valid)) ||
    (paymentMode === 'split' && !splitValid)

  const changePresets = useMemo(() => {
    const rounded = Math.ceil(total / 100) * 100

    return [
      total,
      rounded,
      rounded + 100,
      rounded + 500
    ].filter((v, i, arr) => arr.indexOf(v) === i)
  }, [total])

  const loadProducts = useCallback(async () => {
    try {
      const res = await productApi.getAll()

      const data = res.data || []

      setProducts(data)

      const cats = [
        'All',
        ...new Set(data.map((p) => p.category).filter(Boolean))
      ]

      setCategories(cats)
    } catch {
      toast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh held-order badge count
  const refreshHeldCount = useCallback(async () => {
    try {
      const res = await holdOrderApi.getAll()
      setHeldCount((res.data || []).length)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    loadProducts()
    refreshHeldCount()
  }, [loadProducts, refreshHeldCount])

  const filtered = useMemo(() => {
    let result = products

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()

      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode === debouncedSearch
      )
    }

    if (activeCategory !== 'All') {
      result = result.filter(
        (p) => p.category === activeCategory
      )
    }

    return result
  }, [products, debouncedSearch, activeCategory])

  const quickProducts = useMemo(
    () => products.filter((p) => quickIds.includes(p._id)),
    [products, quickIds]
  )

  // Barcode scanner focus
  useEffect(() => {
    const handler = (e) => {
      const active = e.target

      const isInteractive =
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(
          active?.tagName
        ) ||
        active?.isContentEditable ||
        active?.getAttribute?.('role') === 'textbox'

      if (
        active !== searchRef.current &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isInteractive
      ) {
        searchRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handler)

    return () =>
      window.removeEventListener('keydown', handler)
  }, [])

  const toggleQuick = useCallback(
    (id) => {
      const updated = quickIds.includes(id)
        ? quickIds.filter((q) => q !== id)
        : [...quickIds, id]

      setQuickIds(updated)
      saveQuickIds(updated)
    },
    [quickIds]
  )

  // Add custom item
  const handleAddCustomItem = useCallback(() => {
    const price = parseFloat(customItem.price)
    const qty = parseInt(customItem.quantity)

    if (!customItem.name.trim()) {
      return setCustomError('Item name is required')
    }

    if (!Number.isFinite(price) || price < 0) {
      return setCustomError('Enter a valid price')
    }

    if (!Number.isInteger(qty) || qty < 1) {
      return setCustomError('Enter a valid quantity')
    }

    const fakeId = `custom_${Date.now()}`

    const product = {
      _id: fakeId,
      name: customItem.name.trim(),
      price,
      stock: 9999,
      category: 'Custom',
      isCustom: true
    }

    for (let i = 0; i < qty; i++) {
      addToCart(product)
    }

    setCustomItem({
      name: '',
      price: '',
      quantity: '1'
    })

    setCustomError('')
    setShowCustomItem(false)

    toast(`Added: ${product.name}`, 'success')
  }, [customItem, addToCart])

  // Hold current cart
  const holdCurrentCart = useCallback(async (label) => {
    if (cart.length === 0) return

    setHoldSaving(true)

    try {
      await holdOrderApi.hold({
        label,
        items: cart,
        discountType,
        discountValue: discountValue
          ? parseFloat(discountValue)
          : 0,
        subtotal: cartSubtotal,
      })

      clearCart()
      setCash('')
      setDiscountType('none')
      setDiscountValue('')
      setShowHoldLabel(false)

      setHeldCount((c) => c + 1)

      toast('Order held ✅', 'success')
    } catch {
      toast('Failed to hold order', 'error')
    } finally {
      setHoldSaving(false)
    }
  }, [
    cart,
    discountType,
    discountValue,
    cartSubtotal,
    clearCart
  ])

  // Resume held order
  const resumeHeldOrder = useCallback((order) => {
    clearCart()

    order.items.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        addToCart({
          _id:
            item._id ||
            `custom_${Date.now()}_${Math.random()}`,
          name: item.name,
          price: item.price,
          stock: item.stock || 9999,
          category: item.category || '',
          isCustom: item.isCustom || false,
        })
      }
    })

    if (
      order.discountType &&
      order.discountType !== 'none'
    ) {
      setDiscountType(order.discountType)
      setDiscountValue(String(order.discountValue))
    }

    setHeldCount((c) => Math.max(0, c - 1))

    toast('Order resumed 🛒', 'success')
  }, [clearCart, addToCart])

  // ── Checkout Logic ──────────────────────────────────
  const handleCheckout = async () => {
    if (paymentMode === 'cash') {
      const validation = validateCashInput(cash, total)

      if (!validation.valid) {
        setCashError(validation.message)
        return toast(validation.message, 'error')
      }
    } else {
      if (!splitValid)
        return toast(
          'Please complete the payment breakdown',
          'error'
        )
    }

    try {
      setCheckoutLoading(true)

      const payload = {
        items: cart.map((item) => ({
          productId: item.isCustom ? undefined : item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          isCustom: item.isCustom || false,
        })),

        ...(paymentMode === 'split'
          ? {
              payments: splitPayments,
              cash:
                splitPayments.find(
                  (p) => p.method === 'cash'
                )?.amount || 0
            }
          : {
              cash: Number(cash)
            }
        ),

        discount:
          discountType !== 'none' && discountValue
            ? {
                type: discountType,
                value: parseFloat(discountValue)
              }
            : null,
      }

      const res = await orderApi.create(payload)

      setLastOrder(res.data)
      setShowReceipt(true)

      if (autoPrint) {
        printReceipt(res.data, {
          paperWidth
        })
      }

      clearCart()
      setCash('')
      setCashError('')
      setPaymentMode('cash')
      setSplitPayments([])
      setSplitValid(false)

      toast('Order completed ✅', 'success')
    } catch (err) {
      toast(
        err?.response?.data?.message ||
          'Checkout failed',
        'error'
      )
    } finally {
      setCheckoutLoading(false)
    }
  }

return (
  <div className="flex h-full overflow-hidden">

    {/* ── PRODUCT SECTION ─────────────────────────── */}
    <div className="flex-1 flex flex-col overflow-hidden p-4">

      {/* Search + Category + Price Toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-4">

        {/* Search */}
        <input
          ref={searchRef}
          type="text"
          placeholder="Search product or scan barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-[220px]"
        />

        {/* Categories */}
        <div className="flex gap-1 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
                ${
                  activeCategory === cat
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-surface-700 text-slate-300 hover:bg-surface-600'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Price Toggle */}
        <div className="flex bg-surface-700 rounded-xl p-1 gap-0.5 shrink-0">
          {[
            { key: 'retail', label: '🏷️ Retail' },
            { key: 'wholesale', label: '📦 Wholesale' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPriceLevel(key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                ${
                  priceLevel === key
                    ? 'bg-amber-500 text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">

          {filtered.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              onAdd={(p) =>
                addToCart(
                  p,
                  priceLevel === 'wholesale' &&
                  p.wholesalePrice != null
                    ? p.wholesalePrice
                    : null
                )
              }
              isQuick={quickIds.includes(product._id)}
              onToggleQuick={() => toggleQuick(product._id)}
            />
          ))}

        </div>
      </div>
    </div>

    {/* ── PAYMENT SECTION ─────────────────────────── */}
    <div className="w-[340px] bg-surface-800 border-l border-surface-700 p-4 flex flex-col gap-4 overflow-y-auto">

      {/* Payment mode tabs */}
      <div className="flex bg-surface-700 rounded-xl p-1 gap-0.5">
        {[
          { key: 'cash', label: '💵 Cash' },
          { key: 'split', label: '💳 Split / GCash' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setPaymentMode(key)
              setCashError('')
            }}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${
                paymentMode === key
                  ? 'bg-amber-500 text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Cash / Split */}
      {paymentMode === 'cash' ? (
        <div>
          <label className="text-xs text-slate-500 block mb-1">
            Cash Received{' '}
            <span className="text-red-400">*</span>
          </label>

          <div
            className={`relative rounded-lg ${
              cashError ? 'ring-1 ring-red-500' : ''
            }`}
          >
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
              ₱
            </span>

            <input
              type="number"
              min="0"
              step="1"
              value={cash}
              onChange={(e) => {
                setCash(e.target.value)
                setCashError('')
              }}
              placeholder="Enter cash amount"
              className={`input pl-8 py-2.5 text-lg font-mono font-semibold text-slate-100 ${
                cashError ? 'border-red-500' : ''
              }`}
            />
          </div>

          {cashError && (
            <p className="text-red-400 text-xs mt-1">
              {cashError}
            </p>
          )}

          <div className="flex gap-1.5 mt-2 flex-wrap">
            {changePresets.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setCash(preset.toString())
                  setCashError('')
                }}
                className={`text-xs px-2 py-1 rounded-lg transition-colors font-mono
                  ${
                    Number(cash) === preset
                      ? 'bg-amber-500 text-slate-900 font-semibold'
                      : 'bg-surface-600 text-slate-300 hover:bg-surface-500'
                  }`}
              >
                ₱{preset}
              </button>
            ))}

            <button
              onClick={() => {
                setCash(total.toFixed(2))
                setCashError('')
              }}
              className="text-xs px-2 py-1 rounded-lg bg-surface-600 text-slate-300 hover:bg-surface-500 transition-colors"
            >
              Exact
            </button>
          </div>
        </div>
      ) : (
        <SplitPaymentPanel
          total={total}
          onChange={(payments, valid) => {
            setSplitPayments(payments)
            setSplitValid(valid)
          }}
        />
      )}

      {/* Change */}
      {paymentMode === 'cash' && change !== null && (
        <div className="bg-green-900/40 border border-green-700/50 rounded-xl px-3 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-green-300">
            Change
          </span>

          <span className="font-mono font-bold text-lg text-green-400">
            {formatPeso(change)}
          </span>
        </div>
      )}

      {/* Checkout */}
      <button
        onClick={handleCheckout}
        disabled={isCheckoutDisabled}
        className="btn btn-primary w-full"
      >
        {checkoutLoading
          ? 'Processing...'
          : 'Complete Order'}
      </button>
    </div>

    {/* Held Orders Drawer */}
    <HeldOrdersDrawer
      isOpen={showHeld}
      onClose={() => setShowHeld(false)}
      onResume={resumeHeldOrder}
    />

    {/* Hold Label Modal */}
    <HoldLabelModal
      isOpen={showHoldLabel}
      onClose={() => setShowHoldLabel(false)}
      onConfirm={holdCurrentCart}
      itemCount={itemCount}
    />

  </div>
)
}
