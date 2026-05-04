import { useState, memo } from 'react'

// React.memo: only re-renders when this specific cart item changes
const CartItem = memo(({ item, onIncrement, onDecrement, onRemove, onPriceOverride }) => {
  const [editingPrice, setEditingPrice] = useState(false)
  const [tempPrice, setTempPrice]       = useState(item.price.toString())

  const handlePriceBlur = () => {
    const parsed = parseFloat(tempPrice)
    if (!isNaN(parsed) && parsed >= 0) onPriceOverride(item._id, parsed)
    else setTempPrice(item.price.toString())
    setEditingPrice(false)
  }

  const handlePriceKey = (e) => {
    if (e.key === 'Enter')  handlePriceBlur()
    if (e.key === 'Escape') { setTempPrice(item.price.toString()); setEditingPrice(false) }
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-700 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-100 truncate">{item.name}</p>

        {editingPrice ? (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-slate-400">₱</span>
            <input
              autoFocus
              type="number" step="0.01" min="0"
              value={tempPrice}
              onChange={(e) => setTempPrice(e.target.value)}
              onBlur={handlePriceBlur}
              onKeyDown={handlePriceKey}
              className="input w-20 py-0.5 px-2 text-xs text-amber-400 font-mono"
            />
          </div>
        ) : (
          <button
            onClick={() => { setEditingPrice(true); setTempPrice(item.price.toString()) }}
            title="Click to override price"
            className="flex items-center gap-1 mt-0.5 group/price"
          >
            <span className="text-xs font-mono text-amber-400 group-hover/price:text-amber-300 transition-colors">
              ₱{item.price.toFixed(2)}
            </span>
            <svg className="w-3 h-3 text-slate-600 group-hover/price:text-amber-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => onDecrement(item._id)}
          className="w-7 h-7 rounded-lg bg-surface-600 hover:bg-surface-500 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-90">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
        </button>
        <span className="w-6 text-center font-mono text-sm font-semibold text-slate-100">{item.quantity}</span>
        <button onClick={() => onIncrement(item._id)} disabled={item.quantity >= item.stock}
          className="w-7 h-7 rounded-lg bg-surface-600 hover:bg-surface-500 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>

      <div className="text-right shrink-0 w-16">
        <span className="font-mono text-sm font-semibold text-slate-100">
          ₱{(item.price * item.quantity).toFixed(2)}
        </span>
      </div>

      <button onClick={() => onRemove(item._id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-red-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}, (prev, next) =>
  // Only re-render if this item's data changed
  prev.item._id      === next.item._id      &&
  prev.item.price    === next.item.price    &&
  prev.item.quantity === next.item.quantity
)

CartItem.displayName = 'CartItem'
export default CartItem
