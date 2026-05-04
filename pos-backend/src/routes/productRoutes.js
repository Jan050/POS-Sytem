const express = require('express')
const router  = express.Router()
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct } = require('../controllers/productController')
const { protect, requireAdmin } = require('../middleware/authMiddleware')
const { writeLimiter } = require('../middleware/rateLimiter')
const {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductQuery,
} = require('../middleware/validators')

// Read: any authenticated user (cashier + admin need the product list for POS)
router.get('/',    protect, validateProductQuery, getProducts)
router.get('/:id', protect, getProductById)

// Write: admin only + write rate limit + input validation
router.post('/',      protect, requireAdmin, writeLimiter, validateCreateProduct, createProduct)
router.put('/:id',   protect, requireAdmin, writeLimiter, validateUpdateProduct,  updateProduct)
router.delete('/:id', protect, requireAdmin, writeLimiter, deleteProduct)

module.exports = router
