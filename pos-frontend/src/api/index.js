import axios from 'axios'

const TOKEN_KEY = 'pos_token'

const api = axios.create({
  // Dev: VITE_API_URL is unset → uses Vite proxy → '/api' works
  // Prod (Vercel): VITE_API_URL = 'https://pos-sytem.onrender.com' → full URL
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: inject JWT from localStorage ────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor: unwrap data or throw meaningful error ──────────────
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status  = err.response?.status
    const message = err.response?.data?.message || err.message || 'Network error'
    const code    = err.response?.data?.code

    // 401: token expired/invalid → clear session and redirect to login
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem('pos_user')
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }

    const error = new Error(message)
    error.status = status
    error.code   = code
    return Promise.reject(error)
  }
)

// ════════════════════════════════════════
// AUTH
// ════════════════════════════════════════
export const authApi = {
  login:          (data) => api.post('/auth/login', data),
  getMe:          ()     => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
  getUsers:       ()     => api.get('/auth/users'),
  createUser:     (data) => api.post('/auth/users', data),
}

// ════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════
export const productApi = {
  getAll:    (params = {}) => api.get('/products', { params }),
  getById:   (id)          => api.get(`/products/${id}`),
  getLowStock:()           => api.get('/products/low-stock'),
  restock:   (id, data)    => api.post(`/products/${id}/restock`, data),
  create:    (data)        => api.post('/products', data),
  update:    (id, data)    => api.put(`/products/${id}`, data),
  delete:    (id)          => api.delete(`/products/${id}`),
}

// ════════════════════════════════════════
// ORDERS
// ════════════════════════════════════════
export const orderApi = {
  create:   (data)        => api.post('/orders', data),
  getAll:   (params = {}) => api.get('/orders', { params }),
  getById:  (id)          => api.get(`/orders/${id}`),
  void:     (id, data)    => api.put(`/orders/${id}/void`, data),
}

// ════════════════════════════════════════
// SALES
// ════════════════════════════════════════
export const salesApi = {
  getToday:         ()                    => api.get('/sales/today'),
  getSummary:       (period = '7days')    => api.get('/sales/summary', { params: { period } }),
  getBestSellers:   (period = '7days', limit = 10) => api.get('/sales/best-sellers', { params: { period, limit } }),
  getHourly:        (date)               => api.get('/sales/hourly', { params: { date } }),
  // ── Phase 3 ──────────────────────────────────────────────────────────────
  getMonthly:       ()                   => api.get('/sales/monthly'),
  getDeadStock:     (days = 30)          => api.get('/sales/dead-stock', { params: { days } }),
  getProfitMargins: (period = '30days')  => api.get('/sales/profit-margins', { params: { period } }),
}

// ════════════════════════════════════════
// EXPENSES
// ════════════════════════════════════════
export const expenseApi = {
  getAll:       (params = {}) => api.get('/expenses', { params }),
  getCategories:()            => api.get('/expenses/categories'),
  create:       (data)        => api.post('/expenses', data),
  delete:       (id)          => api.delete(`/expenses/${id}`),
}

// ════════════════════════════════════════
// CASH DRAWER
// ════════════════════════════════════════
export const cashDrawerApi = {
  getCurrent: ()         => api.get('/cash-drawer/current'),
  getHistory: (params={})=> api.get('/cash-drawer', { params }),
  open:       (data)     => api.post('/cash-drawer/open', data),
  close:      (id, data) => api.put(`/cash-drawer/${id}/close`, data),
}

// ════════════════════════════════════════
// UTANG
// ════════════════════════════════════════
export const utangApi = {
  getAll:       (params = {}) => api.get('/utang', { params }),
  create:       (data)        => api.post('/utang', data),
  recordPayment:(id, data)    => api.put(`/utang/${id}/pay`, data),
  delete:       (id)          => api.delete(`/utang/${id}`),
}

// ════════════════════════════════════════
// HOLD ORDERS
// ════════════════════════════════════════
export const holdOrderApi = {
  getAll:  ()         => api.get('/hold-orders'),
  hold:    (data)     => api.post('/hold-orders', data),
  delete:  (id)       => api.delete(`/hold-orders/${id}`),
}

// ════════════════════════════════════════
// SUPPLIERS
// ════════════════════════════════════════
export const supplierApi = {
  getAll:         ()         => api.get('/suppliers'),
  create:         (data)     => api.post('/suppliers', data),
  update:         (id, data) => api.put(`/suppliers/${id}`, data),
  delete:         (id)       => api.delete(`/suppliers/${id}`),
  getPurchases:   (p = {})   => api.get('/suppliers/purchases', { params: p }),
  createPurchase: (data)     => api.post('/suppliers/purchases', data),
}

export default api
