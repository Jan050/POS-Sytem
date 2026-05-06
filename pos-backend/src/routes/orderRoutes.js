const express = require('express')
const router  = express.Router()
const { createOrder, voidOrder, getOrders, getOrderById } = require('../controllers/orderController')
const { protect, requireAdmin, requireCashierOrAdmin } = require('../middleware/authMiddleware')
const { writeLimiter } = require('../middleware/rateLimiter')
const { validateCreateOrder } = require('../middleware/validators')

router.post('/', protect, requireCashierOrAdmin, writeLimiter, validateCreateOrder, createOrder)
router.get('/',    protect, requireCashierOrAdmin, getOrders)
router.get('/:id', protect, requireCashierOrAdmin, getOrderById)
// Void: admin only (cashier cannot void)
router.put('/:id/void', protect, requireAdmin, voidOrder)

module.exports = router
