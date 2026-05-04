const express = require('express')
const router  = express.Router()
const { createOrder, getOrders, getOrderById } = require('../controllers/orderController')
const { protect, requireCashierOrAdmin } = require('../middleware/authMiddleware')
const { writeLimiter } = require('../middleware/rateLimiter')
const { validateCreateOrder } = require('../middleware/validators')

// POST /api/orders — checkout: both roles, write limit, full validation
router.post('/', protect, requireCashierOrAdmin, writeLimiter, validateCreateOrder, createOrder)

// GET: admin + cashier can view orders
router.get('/',    protect, requireCashierOrAdmin, getOrders)
router.get('/:id', protect, requireCashierOrAdmin, getOrderById)

module.exports = router
