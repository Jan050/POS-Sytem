import { useState, useEffect } from 'react'

/**
 * Debounces a value — only updates after the delay has passed without changes.
 * Prevents search from firing on every keystroke.
 *
 * @param {*} value - The value to debounce
 * @param {number} delay - Milliseconds to wait (default 300ms)
 * @returns debounced value
 *
 * Usage:
 *   const debouncedSearch = useDebounce(search, 300)
 *   useEffect(() => { fetchProducts(debouncedSearch) }, [debouncedSearch])
 */
const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer) // Cleanup on each change
  }, [value, delay])

  return debouncedValue
}

export default useDebounce
