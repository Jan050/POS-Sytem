/**
 * middleware/validators.js
 *
 * PROTECTS AGAINST: SQL/NoSQL injection, malformed payloads, oversized inputs,
 *                   type coercion attacks, unexpected field injection.
 *
 * Uses express-validator — chain rules declaratively, check at route level.
 *
 * Pattern: define rules array → attach to route → call handleValidation() in controller.
 */

const { body, param, query, validationResult } = require('express-validator')

// ── Helper: run after validators, reject if any failed ────────────────────
const handleValidation = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    // Return only the first error message — don't leak field names en masse
    const first = errors.array()[0]
    return res.status(400).json({
      success: false,
      message: first.msg,
      field: first.path,   // tells frontend which field to highlight
    })
  }
  next()
}

// ════════════════════════════════════════════════════════════
// AUTH VALIDATORS
// ════════════════════════════════════════════════════════════

const validateLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters')
    // SECURITY: only alphanumeric + underscore — blocks injection chars like $, {, }
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username contains invalid characters'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 1, max: 100 }).withMessage('Password is too long'),
    // Note: we don't expose password requirements here — don't help attackers

  handleValidation,
]

const validateCreateUser = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6, max: 100 }).withMessage('Password must be at least 6 characters'),

  body('role')
    .optional()
    // SECURITY: whitelist — only these exact values accepted, blocks arbitrary role injection
    .isIn(['admin', 'cashier']).withMessage('Role must be "admin" or "cashier"'),

  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Display name cannot exceed 50 characters')
    // Strip any HTML tags to block XSS stored in display names
    .customSanitizer(v => v?.replace(/<[^>]*>/g, '') || v),

  handleValidation,
]

const validateChangePassword = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6, max: 100 }).withMessage('New password must be at least 6 characters'),

  handleValidation,
]

// ════════════════════════════════════════════════════════════
// PRODUCT VALIDATORS
// ════════════════════════════════════════════════════════════

const VALID_CATEGORIES = [
  'Beverages', 'Snacks', 'Canned Goods', 'Noodles',
  'Condiments', 'Personal Care', 'Cigarettes', 'Bread', 'Dairy',
  'Uncategorized', 'Other',
]

const validateCreateProduct = [
  body('name')
    .trim()
    .notEmpty().withMessage('Product name is required')
    .isLength({ min: 1, max: 100 }).withMessage('Product name cannot exceed 100 characters')
    // Strip HTML — product name must be plain text
    .customSanitizer(v => v?.replace(/<[^>]*>/g, '') || v),

  body('price')
    .notEmpty().withMessage('Price is required')
    // isFloat also validates it's a real number — blocks NaN/"abc"
    .isFloat({ min: 0, max: 999999 }).withMessage('Price must be a number between 0 and 999,999')
    .toFloat(),  // coerce to actual float after validation

  body('stock')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 999999 }).withMessage('Stock must be a whole number (0–999,999)')
    .toInt(),

  body('barcode')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 50 }).withMessage('Barcode cannot exceed 50 characters')
    // SECURITY: barcodes are numeric/alphanumeric — no special chars needed
    .matches(/^[a-zA-Z0-9\-]*$/).withMessage('Barcode contains invalid characters'),

  body('category')
    .optional()
    .trim()
    // SECURITY: whitelist category — no free-text injection into this field
    .isIn(VALID_CATEGORIES).withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),

  handleValidation,
]

const validateUpdateProduct = [
  param('id')
    .isMongoId().withMessage('Invalid product ID'),

  ...validateCreateProduct.slice(0, -1),  // Reuse product body rules (minus handleValidation)
  handleValidation,
]

// ════════════════════════════════════════════════════════════
// ORDER VALIDATORS
// ════════════════════════════════════════════════════════════

const validateCreateOrder = [
  body('items')
    .isArray({ min: 1, max: 100 }).withMessage('Order must contain 1–100 items'),

  body('items.*.productId')
    // SECURITY: must be valid MongoDB ObjectId — blocks arbitrary string injection
    .isMongoId().withMessage('Each item must have a valid productId'),

  body('items.*.quantity')
    .isInt({ min: 1, max: 9999 }).withMessage('Item quantity must be between 1 and 9,999')
    .toInt(),

  body('items.*.price')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 999999 }).withMessage('Price override must be a non-negative number')
    .toFloat(),

  body('cash')
    .notEmpty().withMessage('Cash received is required')
    .isFloat({ min: 0 }).withMessage('Cash received must be a non-negative number')
    .toFloat(),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Note cannot exceed 200 characters')
    .customSanitizer(v => v?.replace(/<[^>]*>/g, '') || v),

  body('idempotencyKey')
    .optional()
    .trim()
    .isLength({ max: 64 }).withMessage('Idempotency key too long')
    // Only safe characters — UUID format or similar
    .matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Invalid idempotency key format'),

  handleValidation,
]

// ════════════════════════════════════════════════════════════
// QUERY PARAM VALIDATORS (search, pagination)
// ════════════════════════════════════════════════════════════

const validateProductQuery = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Search query too long')
    // SECURITY: strip regex metacharacters that could cause ReDoS
    .customSanitizer(v => v?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || v),

  query('category')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Category filter too long'),

  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 }).withMessage('Invalid page number')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be 1–100')
    .toInt(),

  handleValidation,
]

module.exports = {
  validateLogin,
  validateCreateUser,
  validateChangePassword,
  validateCreateProduct,
  validateUpdateProduct,
  validateCreateOrder,
  validateProductQuery,
}
