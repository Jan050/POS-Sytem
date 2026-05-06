import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { productApi, orderApi } from '../api'
import { useCart } from '../hooks/useCart'
import { useToast } from '../components/ui/Toast'
import useDebounce from '../hooks/useDebounce'
import ProductCard from '../components/ProductCard'
import CartItem from '../components/CartItem'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { printReceipt } from '../utils/printReceipt'
import { formatPeso } from '../utils/formatters'

const QUICK_ITEM_KEY = 'pos_quick_items'
const loadQuickIds   = () => { try { return JSON.parse(localStorage.getItem(QUICK_ITEM_KEY)) || [] } catch { return [] } }
const saveQuickIds   = (ids) => localStorage.setItem(QUICK_ITEM_KEY, JSON.stringify(ids))

const validateCashInput = (rawCash, total) => {
  if (rawCash === '' || rawCash === null || rawCash === undefined)
    return { valid: false, message: 'Please enter cash received' }
  const num = Number(rawCash)
  if (!Number.isFinite(num)) return { valid: false, message: 'Cash must be a valid number' }
  if (num < 0)               return { valid: false, message: 'Cash cannot be negative' }
  if (num < total)           return { valid: false, message: `Cash ₱${num.toFixed(2)} is less than total ₱${total.toFixed(2)}` }
  return { valid: true, message: null }
}

export default function POSPage() {
  const toast = useToast()
  const { cart, total: cartSubtotal, itemCount, addToCart, removeFromCart,
          incrementQty, decrementQty, overridePrice, clearCart } = useCart()

  const [products, setProducts]               = useState([])
  const [search, setSearch]                   = useState('')
  const [activeCategory, setActiveCategory]   = useState('All')
  const [categories, setCategories]           = useState(['All'])
  const [loading, setLoading]                 = useState(true)
  const [cash, setCash]                       = useState('')
  const [cashError, setCashError]             = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [showReceipt, setShowReceipt]         = useState(false)
  const [lastOrder, setLastOrder]             = useState(null)
  const [quickIds, setQuickIds]               = useState(loadQuickIds)
  const [showCartMobile, setShowCartMobile]   = useState(false)
  const [autoPrint, setAutoPrint]             = useState(() => localStorage.getItem('pos_autoprint') !== 'false')
  const [paperWidth, setPaperWidth]           = useState(() => localStorage.getItem('pos_paper') || '80mm')

  // ── Phase 1: Discount state ─────────────────────────────────────────────
  const [discountType,  setDiscountType]  = useState('none') // 'none' | 'percent' | 'amount'
  const [discountValue, setDiscountValue] = useState('')

  // ── Phase 1: Custom Item state ──────────────────────────────────────────
  const [showCustomItem, setShowCustomItem] = useState(false)
  const [customItem, setCustomItem]         = useState({ name: '', price: '', quantity: '1' })
  const [customError, setCustomError]       = useState('')

  // ── Phase 1: Utang (credit) checkout ────────────────────────────────────
  const [showUtangConfirm, setShowUtangConfirm] = useState(false)

  const searchRef = useRef(null)
  const debouncedSearch = useDebounce(search, 300)

  // ── Compute discount amount + final total ───────────────────────────────
  const discountAmount = useMemo(() => {
    const v = parseFloat(discountValue)
    if (!v || v <= 0 || discountType === 'none') return 0
    if (discountType === 'percent') return parseFloat(((v / 100) * cartSubtotal).toFixed(2))
    return parseFloat(Math.min(v, cartSubtotal).toFixed(2))
  }, [discountType, discountValue, cartSubtotal])

  const total = parseFloat((cartSubtotal - discountAmount).toFixed(2))

  const cashValidation = useMemo(() => validateCashInput(cash, total), [cash, total])
  const change         = cash !== '' && cashValidation.valid ? parseFloat((Number(cash) - total).toFixed(2)) : null
  const isCheckoutDisabled = checkoutLoading || cart.length === 0

  const loadProducts = useCallback(async () => {
    try {
      const res = await productApi.getAll()
      const data = res.data || []
      setProducts(data)
      const cats = ['All', ...new Set(data.map((p) => p.category).filter(Boolean))]
      setCategories(cats)
    } catch {
      toast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  const filtered = useMemo(() => {
    let result = products
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.barcode === debouncedSearch)
    }
    if (activeCategory !== 'All') result = result.filter((p) => p.category === activeCategory)
    return result
  }, [products, debouncedSearch, activeCategory])

  const quickProducts = useMemo(() => products.filter((p) => quickIds.includes(p._id)), [products, quickIds])

  // Barcode scanner — auto-focus search
  useEffect(() => {
    const handler = (e) => {
      const active = e.target
      const isInteractive = ['INPUT','TEXTAREA','SELECT','BUTTON'].includes(active?.tagName) ||
        active?.isContentEditable || active?.getAttribute?.('role') === 'textbox'
      if (active !== searchRef.current && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !isInteractive)
        searchRef.current?.focus()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggleQuick = useCallback((id) => {
    const updated = quickIds.includes(id) ? quickIds.filter((q) => q !== id) : [...quickIds, id]
    setQuickIds(updated)
    saveQuickIds(updated)
  }, [quickIds])

  // ── Add Custom Item to cart ─────────────────────────────────────────────
  const handleAddCustomItem = useCallback(() => {
    const price = parseFloat(customItem.price)
    const qty   = parseInt(customItem.quantity)
    if (!customItem.name.trim()) return setCustomError('Item name is required')
    if (!Number.isFinite(price) || price < 0) return setCustomError('Enter a valid price')
    if (!Number.isInteger(qty)  || qty < 1)   return setCustomError('Enter a valid quantity')

    // Custom items use a timestamp-based fake ID so they can coexist with real products
    const fakeId = `custom_${Date.now()}`
    const product = { _id: fakeId, name: customItem.name.trim(), price, stock: 9999, category: 'Custom', isCustom: true }
    // Add qty times
    for (let i = 0; i < qty; i++) addToCart(product)
    setCustomItem({ name: '', price: '', quantity: '1' })
    setCustomError('')
    setShowCustomItem(false)
    toast(`Added: ${product.name}`, 'success')
  }, [customItem, addToCart])

  // ── Checkout ────────────────────────────────────────────────────────────
  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return toast('Cart is empty', 'error')
    const validation = validateCashInput(cash, total)
    if (!validation.valid) { setCashError(validation.message); return toast(validation.message, 'error') }

    setCheckoutLoading(true)
    setCashError('')
    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.isCustom ? undefined : item._id,
          name:      item.name,
          price:     item.price,
          quantity:  item.quantity,
          isCustom:  item.isCustom || false,
        })),
        cash:     Number(cash),
        discount: discountType !== 'none' && discountValue
          ? { type: discountType, value: parseFloat(discountValue) }
          : null,
      }

      const res = await orderApi.create(payload)
      setLastOrder(res.data)
      setShowReceipt(true)
      clearCart()
      setCash('')
      setDiscountType('none')
      setDiscountValue('')
      setShowCartMobile(false)
      loadProducts()
      toast('Order complete! 🎉', 'success')
      if (autoPrint) setTimeout(() => printReceipt(res.data, { paperWidth, autoPrint: true }), 500)
    } catch (err) {
      if (err.message?.toLowerCase().includes('cash')) setCashError(err.message)
      toast(err.message || 'Checkout failed', 'error')
    } finally {
      setCheckoutLoading(false)
    }
  }, [cart, cash, total, discountType, discountValue, clearCart, loadProducts, autoPrint, paperWidth])

  const changePresets = [20, 50, 100, 200, 500, 1000]

  // ── Cart Panel ──────────────────────────────────────────────────────────
  const CartPanel = useCallback(() => (
    <div className="flex flex-col h-full bg-surface-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold text-slate-100">Cart</h2>
          {itemCount > 0 && <span className="px-2 py-0.5 bg-amber-500 text-slate-900 text-xs font-bold rounded-full">{itemCount}</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Custom item button */}
          <button
            onClick={() => setShowCustomItem(true)}
            title="Add custom item"
            className="text-xs px-2 py-1 rounded-lg bg-surface-600 text-slate-300 hover:bg-surface-500 transition-colors"
          >
            + Custom
          </button>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-4 min-h-0">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 py-10">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.4 5.6M17 18a1 1 0 100 2 1 1 0 000-2zm-8 0a1 1 0 100 2 1 1 0 000-2z" />
            </svg>
            <p className="text-sm">Cart is empty</p>
            <p className="text-xs mt-1">Tap a product or "+ Custom"</p>
          </div>
        ) : (
          cart.map((item) => (
            <CartItem key={item._id} item={item}
              onIncrement={incrementQty} onDecrement={decrementQty}
              onRemove={removeFromCart}  onPriceOverride={overridePrice} />
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="shrink-0 border-t border-surface-700 p-4 space-y-3">
          {/* Subtotal row */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Subtotal</span>
            <span className="font-mono text-slate-300">{formatPeso(cartSubtotal)}</span>
          </div>

          {/* ── Discount ────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Discount</span>
              <div className="flex bg-surface-700 rounded-lg p-0.5 gap-0.5">
                {['none','percent','amount'].map((t) => (
                  <button key={t}
                    onClick={() => { setDiscountType(t); if (t === 'none') setDiscountValue('') }}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all
                      ${discountType === t ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    {t === 'none' ? 'None' : t === 'percent' ? '%' : '₱'}
                  </button>
                ))}
              </div>
              {discountType !== 'none' && (
                <input
                  type="number" min="0" value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percent' ? '10' : '20'}
                  className="input py-1 px-2 text-xs font-mono w-20 ml-auto"
                />
              )}
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-xs text-green-400">
                <span>Discount applied</span>
                <span className="font-mono">-{formatPeso(discountAmount)}</span>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-semibold">Total</span>
            <span className="font-display font-bold text-2xl text-amber-400 font-mono">{formatPeso(total)}</span>
          </div>

          {/* Cash input */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Cash Received <span className="text-red-400">*</span></label>
            <div className={`relative rounded-lg ${cashError ? 'ring-1 ring-red-500' : ''}`}>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₱</span>
              <input type="number" min="0" step="1" value={cash}
                onChange={(e) => { setCash(e.target.value); setCashError('') }}
                placeholder="Enter cash amount"
                className={`input pl-8 py-2.5 text-lg font-mono font-semibold text-slate-100 ${cashError ? 'border-red-500' : ''}`}
              />
            </div>
            {cashError && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {cashError}
              </p>
            )}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {changePresets.map((preset) => (
                <button key={preset}
                  onClick={() => { setCash(preset.toString()); setCashError('') }}
                  className={`text-xs px-2 py-1 rounded-lg transition-colors font-mono
                    ${Number(cash) === preset ? 'bg-amber-500 text-slate-900 font-semibold' : 'bg-surface-600 text-slate-300 hover:bg-surface-500'}`}
                >₱{preset}</button>
              ))}
              <button onClick={() => { setCash(total.toFixed(2)); setCashError('') }}
                className="text-xs px-2 py-1 rounded-lg bg-surface-600 text-slate-300 hover:bg-surface-500 transition-colors">
                Exact
              </button>
            </div>
          </div>

          {/* Change */}
          {change !== null && (
            <div className="bg-green-900/40 border border-green-700/50 rounded-xl px-3 py-2 flex items-center justify-between animate-slide-in">
              <span className="text-sm font-medium text-green-300">Change</span>
              <span className="font-mono font-bold text-lg text-green-400">{formatPeso(change)}</span>
            </div>
          )}

          {/* Checkout */}
          <button onClick={handleCheckout} disabled={isCheckoutDisabled}
            className="btn-primary w-full py-3.5 text-base font-bold tracking-wide rounded-xl">
            {checkoutLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>Processing…
              </span>
            ) : cash === '' ? 'Enter cash to checkout'
              : !cashValidation.valid ? 'Fix cash amount'
              : `Checkout · ${formatPeso(total)}`}
          </button>

          {/* Print settings */}
          <div className="flex items-center justify-between pt-1 border-t border-surface-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoPrint}
                onChange={(e) => { setAutoPrint(e.target.checked); localStorage.setItem('pos_autoprint', e.target.checked) }}
                className="w-3.5 h-3.5 accent-amber-500" />
              <span className="text-xs text-slate-500">Auto-print receipt</span>
            </label>
            <select value={paperWidth}
              onChange={(e) => { setPaperWidth(e.target.value); localStorage.setItem('pos_paper', e.target.value) }}
              className="text-xs bg-surface-700 border border-surface-600 rounded px-1.5 py-0.5 text-slate-400">
              <option value="80mm">80mm</option>
              <option value="58mm">58mm</option>
            </select>
          </div>
        </div>
      )}
    </div>
  ), [cart, cartSubtotal, total, discountAmount, discountType, discountValue,
      itemCount, cash, cashError, cashValidation, change, isCheckoutDisabled,
      checkoutLoading, autoPrint, paperWidth, handleCheckout, clearCart,
      incrementQty, decrementQty, removeFromCart, overridePrice])

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── LEFT: Products ─────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden border-r border-surface-700">
        {/* Search + categories */}
        <div className="p-3 space-y-2 bg-surface-800 border-b border-surface-700 shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input ref={searchRef} type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or scan barcode…"
              className="input pl-9 pr-4 py-2.5 text-sm" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all
                  ${activeCategory === cat ? 'bg-amber-500 text-slate-900' : 'bg-surface-700 text-slate-400 hover:bg-surface-600 hover:text-slate-200'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Quick items */}
        {quickProducts.length > 0 && (
          <div className="px-3 pt-2 shrink-0">
            <p className="text-[10px] font-semibold text-amber-500/70 uppercase tracking-widest mb-2">⚡ Quick Items</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {quickProducts.map((p) => (
                <button key={p._id} onClick={() => addToCart(p)} disabled={p.stock === 0}
                  className="shrink-0 flex flex-col items-start px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all active:scale-95 min-w-[110px] disabled:opacity-40">
                  <span className="text-sm font-medium text-amber-100 truncate w-full">{p.name}</span>
                  <span className="text-amber-400 font-mono text-sm font-bold mt-0.5">{formatPeso(p.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Array(9).fill(0).map((_, i) => <div key={i} className="h-24 rounded-xl bg-surface-700 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <p className="text-lg">No products found</p>
              <p className="text-sm mt-1">Try a different search</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {filtered.map((product) => (
                <div key={product._id} className="relative group/card">
                  <ProductCard product={product} onAdd={addToCart} isQuick={quickIds.includes(product._id)} />
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleQuick(product._id) }}
                    title={quickIds.includes(product._id) ? 'Remove from quick items' : 'Pin as quick item'}
                    className={`absolute bottom-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded-md text-[10px] font-bold
                      ${quickIds.includes(product._id) ? 'bg-amber-500 text-slate-900' : 'bg-surface-500 text-slate-300 hover:bg-amber-500 hover:text-slate-900'}`}>
                    ⚡
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Cart (desktop) ───────────────────────── */}
      <div className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0">
        {CartPanel()}
      </div>

      {/* Mobile floating cart button */}
      {itemCount > 0 && (
        <button onClick={() => setShowCartMobile(true)}
          className="lg:hidden fixed bottom-5 right-5 z-30 btn-primary px-5 py-3 rounded-2xl shadow-2xl">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 5.6M17 18a1 1 0 100 2 1 1 0 000-2zm-8 0a1 1 0 100 2 1 1 0 000-2z" />
          </svg>
          <span className="font-bold">{itemCount} items · {formatPeso(total)}</span>
        </button>
      )}

      {/* Mobile cart sheet */}
      {showCartMobile && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowCartMobile(false)}>
          <div className="absolute bottom-0 left-0 right-0 h-[85dvh] rounded-t-2xl overflow-hidden animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 bg-surface-700 border-b border-surface-600">
              <span className="font-display font-semibold">Cart</span>
              <button onClick={() => setShowCartMobile(false)} className="btn-ghost p-1.5 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="h-full overflow-hidden">{CartPanel()}</div>
          </div>
        </div>
      )}

      {/* ── Custom Item Modal ───────────────────────────── */}
      <Modal isOpen={showCustomItem} onClose={() => { setShowCustomItem(false); setCustomError('') }} title="Add Custom Item" size="sm">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">For items not in your product list — a service, a special order, etc.</p>
          {customError && <p className="text-red-400 text-xs bg-red-900/20 rounded-lg px-3 py-2">{customError}</p>}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Item Name *</label>
            <input type="text" value={customItem.name}
              onChange={(e) => setCustomItem(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Ice, Load, Special order"
              className="input px-3 py-2.5" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Price (₱) *</label>
              <input type="number" min="0" step="0.01" value={customItem.price}
                onChange={(e) => setCustomItem(p => ({ ...p, price: e.target.value }))}
                placeholder="0.00" className="input px-3 py-2.5 font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Quantity</label>
              <input type="number" min="1" step="1" value={customItem.quantity}
                onChange={(e) => setCustomItem(p => ({ ...p, quantity: e.target.value }))}
                className="input px-3 py-2.5 font-mono" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => { setShowCustomItem(false); setCustomError('') }} className="btn btn-secondary flex-1 py-2.5">Cancel</button>
            <button onClick={handleAddCustomItem} className="btn-primary flex-1 py-2.5 font-semibold">Add to Cart</button>
          </div>
        </div>
      </Modal>

      {/* ── Receipt Modal ───────────────────────────────── */}
      <Modal isOpen={showReceipt} onClose={() => setShowReceipt(false)} title="✅ Order Complete" size="sm">
        {lastOrder && (
          <div className="space-y-4">
            <div className="bg-surface-900 rounded-xl p-4 font-mono text-sm space-y-2">
              <div className="text-center border-b border-surface-700 pb-2 mb-3">
                <p className="font-display text-amber-400 font-bold text-base">TindahanPOS</p>
                <p className="text-slate-500 text-xs">{new Date(lastOrder.createdAt).toLocaleString('en-PH')}</p>
              </div>
              {lastOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-slate-300">{item.name} × {item.quantity}{item.isCustom ? ' ✎' : ''}</span>
                  <span className="text-slate-200">{formatPeso(item.subtotal)}</span>
                </div>
              ))}
              <div className="border-t border-surface-700 pt-2 mt-2 space-y-1">
                {lastOrder.discount?.amount > 0 && (
                  <div className="flex justify-between text-xs text-green-400">
                    <span>Discount</span><span>-{formatPeso(lastOrder.discount.amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-amber-400">
                  <span>TOTAL</span><span>{formatPeso(lastOrder.total)}</span>
                </div>
                {lastOrder.cash > 0 && (
                  <>
                    <div className="flex justify-between text-slate-400 text-xs"><span>Cash</span><span>{formatPeso(lastOrder.cash)}</span></div>
                    <div className="flex justify-between text-green-400 text-xs"><span>Change</span><span>{formatPeso(lastOrder.change)}</span></div>
                  </>
                )}
              </div>
            </div>
            {lastOrder.change > 0 && (
              <div className="bg-green-900/40 border border-green-700/50 rounded-xl p-4 text-center">
                <p className="text-green-400 text-xs mb-1">Change to return</p>
                <p className="text-green-300 font-mono font-bold text-3xl">{formatPeso(lastOrder.change)}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => printReceipt(lastOrder, { paperWidth })} className="btn btn-secondary flex-1 py-2.5 text-sm">
                🖨 Reprint
              </button>
              <button onClick={() => setShowReceipt(false)} className="btn-primary flex-1 py-3 text-base font-bold rounded-xl">
                New Transaction
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
