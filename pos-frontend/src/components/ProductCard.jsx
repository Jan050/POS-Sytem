import { memo } from 'react'
import { categoryColor } from '../utils/formatters'

// React.memo: only re-renders when product data or quick status changes
const ProductCard = memo(({ product, onAdd, isQuick = false }) => {
  const outOfStock = product.stock === 0
  const lowStock   = product.stock > 0 && product.stock <= 5

  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={`
        relative flex flex-col items-start p-3 rounded-xl border text-left
        transition-all duration-150 group w-full
        active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
        ${isQuick
          ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/60'
          : 'bg-surface-700 border-surface-600 hover:bg-surface-600 hover:border-surface-500'
        }
      `}
    >
      {isQuick && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" />}

      <span className={`badge mb-2 ${categoryColor(product.category)}`}>
        {product.category || 'Uncategorized'}
      </span>

      <span className={`font-medium text-sm leading-tight mb-1 line-clamp-2
        ${isQuick ? 'text-amber-200' : 'text-slate-100'} group-hover:text-white transition-colors`}>
        {product.name}
      </span>

      <span className="font-mono font-semibold text-base text-amber-400">
        ₱{product.price.toFixed(2)}
      </span>

      <span className={`text-xs mt-1 font-medium ${
        outOfStock ? 'text-red-400' : lowStock ? 'text-orange-400' : 'text-slate-500'
      }`}>
        {outOfStock ? 'Out of stock' : lowStock ? `Only ${product.stock} left` : `${product.stock} in stock`}
      </span>
    </button>
  )
}, (prev, next) =>
  // Custom comparison: skip re-render if nothing relevant changed
  prev.product._id    === next.product._id    &&
  prev.product.price  === next.product.price  &&
  prev.product.stock  === next.product.stock  &&
  prev.product.name   === next.product.name   &&
  prev.isQuick        === next.isQuick
)

ProductCard.displayName = 'ProductCard'
export default ProductCard
