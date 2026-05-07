import { memo } from 'react'
import { categoryColor } from '../utils/formatters'

const ProductCard = memo(({
  product,
  onAdd,
  isQuick = false,
  priceLevel = 'retail'
}) => {
  const outOfStock = product.stock === 0
  const lowStock   = product.stock > 0 && product.stock <= 5

  const isWholesale =
    priceLevel === 'wholesale' &&
    product.wholesalePrice != null

  const displayPrice = isWholesale
    ? product.wholesalePrice
    : product.price

  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={`
        relative flex flex-col items-start p-0 rounded-xl border text-left overflow-hidden
        transition-all duration-150 group w-full
        active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
        ${isQuick
          ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/60'
          : 'bg-surface-700 border-surface-600 hover:bg-surface-600 hover:border-surface-500'
        }
      `}
    >
      {isQuick && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 z-10" />
      )}

      {/* Wholesale badge */}
      {isWholesale && (
        <div className="absolute top-2 left-2 z-10">
          <span className="bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded">
            WHOLESALE
          </span>
        </div>
      )}

      {/* Product image */}
      {product.imageUrl ? (
        <div className="w-full h-24 overflow-hidden bg-surface-600 shrink-0">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
      ) : (
        <div className={`w-full h-16 flex items-center justify-center shrink-0
          ${isQuick ? 'bg-amber-500/5' : 'bg-surface-600/50'}`}>
          <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}

      {/* Content */}
      <div className="p-2.5 w-full">
        <span className={`badge mb-1.5 ${categoryColor(product.category)}`}>
          {product.category || 'Uncategorized'}
        </span>

        <span
          className={`font-medium text-xs leading-tight mb-1 line-clamp-2 block
          ${isQuick ? 'text-amber-200' : 'text-slate-100'}
          group-hover:text-white transition-colors`}
        >
          {product.name}
        </span>

        {/* Original retail price */}
        {isWholesale && (
          <span className="text-[10px] text-amber-300/60 line-through block">
            ₱{product.price.toFixed(2)}
          </span>
        )}

        {/* Active price */}
        <span className="font-mono font-semibold text-sm text-amber-400 block">
          ₱{displayPrice.toFixed(2)}
        </span>

        <span
          className={`text-[10px] mt-0.5 font-medium block ${
            outOfStock
              ? 'text-red-400'
              : lowStock
                ? 'text-orange-400'
                : 'text-slate-500'
          }`}
        >
          {outOfStock
            ? 'Out of stock'
            : lowStock
              ? `Only ${product.stock} left`
              : `${product.stock} in stock`}
        </span>
      </div>
    </button>
  )
}, (prev, next) =>
  prev.product._id              === next.product._id &&
  prev.product.price            === next.product.price &&
  prev.product.wholesalePrice   === next.product.wholesalePrice &&
  prev.product.stock            === next.product.stock &&
  prev.product.name             === next.product.name &&
  prev.product.imageUrl         === next.product.imageUrl &&
  prev.priceLevel               === next.priceLevel &&
  prev.isQuick                  === next.isQuick
)

ProductCard.displayName = 'ProductCard'

export default ProductCard