/**
 * productController.js — Secure CRUD operations
 *
 * Security improvements applied:
 *  - $regex constructed from pre-escaped input (ReDoS fix)
 *  - No raw error.message in 500 responses
 *  - Input sanitized by validators middleware before reaching here
 *  - .lean() on read queries (faster + prevents prototype pollution)
 *  - Explicit field selection on updates (no mass assignment)
 */

const Product = require('../models/Product')

// ── GET /api/products ──────────────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const { search, category } = req.query
    // Note: search is already regex-escaped by validateProductQuery middleware

    const filter = { isActive: true }

    if (search) {
      // SECURITY: search has already been escaped by express-validator sanitizer.
      // Additional escape here as defense-in-depth.
      // PROTECTS AGAINST: ReDoS — e.g. search="(a+)+" would hang the regex engine
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { name:    { $regex: escaped, $options: 'i' } },
        { barcode: search },  // Exact match only for barcode (no regex needed)
      ]
    }

    if (category) {
      // SECURITY: category is whitelisted in validators.js — no injection possible
      // But we still use exact match here (not $regex) since categories are controlled values
      filter.category = category
    }

    // .lean() returns plain JS objects — faster and prevents prototype pollution attacks
    const products = await Product.find(filter)
      .sort({ name: 1 })
      .select('-__v')  // Strip internal version key from responses
      .lean()

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load products' })
  }
}

// ── GET /api/products/:id ──────────────────────────────────────────────────
const getProductById = async (req, res) => {
  try {
    // Note: :id validated as MongoId by param('id').isMongoId() in validators
    const product = await Product.findById(req.params.id).select('-__v').lean()

    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' })
    }

    res.status(200).json({ success: true, data: product })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load product' })
  }
}

// ── POST /api/products ─────────────────────────────────────────────────────
const createProduct = async (req, res) => {
  try {
    // SECURITY: destructure explicitly — prevents mass assignment attacks
    // (e.g. attacker sending isActive:false or _id in the body)
    const { name, price, stock, barcode, category } = req.body

    if (barcode) {
      const existing = await Product.findOne({ barcode, isActive: true }).select('name').lean()
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Barcode is already assigned to another product`,
          // SECURITY: we don't return the existing product name (data minimization)
        })
      }
    }

    const product = await Product.create({
      name:     name.trim(),
      price:    parseFloat(price),
      stock:    parseInt(stock) || 0,
      barcode:  barcode?.trim() || null,
      category: category || 'Uncategorized',
    })

    res.status(201).json({ success: true, data: product })
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message)
      return res.status(400).json({ success: false, message: messages[0] })
    }
    res.status(500).json({ success: false, message: 'Failed to create product' })
  }
}

// ── PUT /api/products/:id ──────────────────────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    // SECURITY: explicit destructure — same mass-assignment protection as create
    const { name, price, stock, barcode, category } = req.body

    if (barcode) {
      const existing = await Product.findOne({
        barcode,
        isActive: true,
        _id: { $ne: req.params.id },
      }).select('_id').lean()

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Barcode is already in use by another product',
        })
      }
    }

    // SECURITY: build update object explicitly — never spread req.body into the update
    const updateData = {}
    if (name      !== undefined) updateData.name     = name.trim()
    if (price     !== undefined) updateData.price    = parseFloat(price)
    if (stock     !== undefined) updateData.stock    = parseInt(stock)
    if (barcode   !== undefined) updateData.barcode  = barcode?.trim() || null
    if (category  !== undefined) updateData.category = category

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }  // runValidators: re-validate on update
    ).select('-__v')

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' })
    }

    res.status(200).json({ success: true, data: product })
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message)
      return res.status(400).json({ success: false, message: messages[0] })
    }
    res.status(500).json({ success: false, message: 'Failed to update product' })
  }
}

// ── DELETE /api/products/:id ───────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    // Soft delete — preserves historical order data integrity
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('name')

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' })
    }

    res.status(200).json({ success: true, message: 'Product deleted successfully' })
    // SECURITY: don't return the product name in delete — data minimization
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete product' })
  }
}

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct }
