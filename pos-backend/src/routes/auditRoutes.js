const express = require('express')
const router  = express.Router()
const { getAuditLogs, getAvailableDates } = require('../controllers/auditController')
const { protect, requireAdmin } = require('../middleware/authMiddleware')

router.get('/logs',  protect, requireAdmin, getAuditLogs)
router.get('/dates', protect, requireAdmin, getAvailableDates)

module.exports = router
