const express = require('express')
const router  = express.Router()
const { getUtang, createUtang, recordPayment, deleteUtang } = require('../controllers/utangController')
const { protect, requireCashierOrAdmin } = require('../middleware/authMiddleware')
const { writeLimiter } = require('../middleware/rateLimiter')

router.get('/',    protect, requireCashierOrAdmin, getUtang)
router.post('/',   protect, requireCashierOrAdmin, writeLimiter, createUtang)
router.put('/:id/pay',    protect, requireCashierOrAdmin, writeLimiter, recordPayment)
router.delete('/:id',     protect, requireCashierOrAdmin, writeLimiter, deleteUtang)

module.exports = router
