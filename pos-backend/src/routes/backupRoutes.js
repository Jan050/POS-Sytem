const express = require('express')
const router  = express.Router()
const { exportData, restoreProducts } = require('../controllers/backupController')
const { protect, requireAdmin } = require('../middleware/authMiddleware')
const { writeLimiter } = require('../middleware/rateLimiter')

router.get('/export',           protect, requireAdmin, exportData)
router.post('/restore-products',protect, requireAdmin, writeLimiter, restoreProducts)

module.exports = router
