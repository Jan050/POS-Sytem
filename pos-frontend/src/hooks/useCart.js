import { useState, useEffect, useCallback } from 'react'

const CART_KEY = 'pos_cart'

// Load cart from localStorage (offline fallback)
const loadCart = () => {
  try {
    const stored = localStorage.getItem(CART_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Save cart to localStorage
const saveCart = (cart) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  } catch {
    // Ignore storage errors
  }
}

export const useCart = () => {
  const [cart, setCart] = useState(loadCart)

  // Persist to localStorage on every change
  useEffect(() => {
    saveCart(cart)
  }, [cart])

  // Add product to cart or increment qty if already in cart
  const addToCart = useCallback((product, overridePrice = null) => {
    const finalPrice = overridePrice !== null ? overridePrice : product.price

    setCart((prev) => {
      const existing = prev.find((item) => item._id === product._id)
      if (existing) {
        return prev.map((item) =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [
        ...prev,
        {
          _id: product._id,
          name: product.name,
          price: finalPrice,
          stock: product.stock,
          category: product.category,
          quantity: 1,
        },
      ]
    })
  }, [])

  // Remove item from cart entirely
  const removeFromCart = useCallback((productId) => {
    setCart((prev) => prev.filter((item) => item._id !== productId))
  }, [])

  // Increase quantity (respects stock limit)
  const incrementQty = useCallback((productId) => {
    setCart((prev) =>
      prev.map((item) =>
        item._id === productId && item.quantity < item.stock
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    )
  }, [])

  // Decrease quantity; remove if hits 0
  const decrementQty = useCallback((productId) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item._id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }, [])

  // Set quantity directly (from input)
  const setQty = useCallback((productId, qty) => {
    const parsed = parseInt(qty)
    if (isNaN(parsed) || parsed <= 0) {
      setCart((prev) => prev.filter((item) => item._id !== productId))
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item._id === productId ? { ...item, quantity: parsed } : item
        )
      )
    }
  }, [])

  // Override price for a specific item (sari-sari flexible pricing)
  const overridePrice = useCallback((productId, newPrice) => {
    const parsed = parseFloat(newPrice)
    if (!isNaN(parsed) && parsed >= 0) {
      setCart((prev) =>
        prev.map((item) =>
          item._id === productId ? { ...item, price: parsed } : item
        )
      )
    }
  }, [])

  // Clear entire cart
  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  // Totals
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  return {
    cart,
    total,
    itemCount,
    addToCart,
    removeFromCart,
    incrementQty,
    decrementQty,
    setQty,
    overridePrice,
    clearCart,
  }
}
