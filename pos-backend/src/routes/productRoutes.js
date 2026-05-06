const express = require('express')
const router  = express.Router()
const {
  getProducts, getLowStock, restockProduct,
  getProductById, createProduct, updateProduct, deleteProduct,
} = require('../controllers/productController')
const { protect, requireAdmin } = require('../middleware/authMiddleware')
const { writeLimiter } = require('../middleware/rateLimiter')
const { validateCreateProduct, validateUpdateProduct, validateProductQuery } = require('../middleware/validators')

// Low stock alerts — cashier and admin both see this
router.get('/low-stock', protect, getLowStock)
router.get('/',    protect, validateProductQuery, getProducts)
router.get('/:id', protect, getProductById)

// Restock: admin only
router.post('/:id/restock', protect, requireAdmin, writeLimiter, restockProduct)

router.post('/',       protect, requireAdmin, writeLimiter, validateCreateProduct, createProduct)
router.put('/:id',    protect, requireAdmin, writeLimiter, validateUpdateProduct,  updateProduct)
router.delete('/:id', protect, requireAdmin, writeLimiter, deleteProduct)

module.exports = router
