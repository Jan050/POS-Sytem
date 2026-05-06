const express = require('express')
const router  = express.Router()
const { getExpenses, createExpense, deleteExpense, getCategories } = require('../controllers/expenseController')
const { protect, requireAdmin } = require('../middleware/authMiddleware')
const { writeLimiter } = require('../middleware/rateLimiter')

router.get('/categories', protect, getCategories)
router.get('/',    protect, requireAdmin, getExpenses)
router.post('/',   protect, requireAdmin, writeLimiter, createExpense)
router.delete('/:id', protect, requireAdmin, writeLimiter, deleteExpense)

module.exports = router
