const express = require('express')
const router  = express.Router()
const { getCurrent, openDrawer, closeDrawer, getHistory } = require('../controllers/cashDrawerController')
const { protect, requireAdmin } = require('../middleware/authMiddleware')
const { writeLimiter } = require('../middleware/rateLimiter')

router.get('/current',      protect, getCurrent)
router.get('/',             protect, requireAdmin, getHistory)
router.post('/open',        protect, requireAdmin, writeLimiter, openDrawer)
router.put('/:id/close',   protect, requireAdmin, writeLimiter, closeDrawer)

module.exports = router
