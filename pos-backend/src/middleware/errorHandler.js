/**
 * middleware/errorHandler.js — Production-safe global error handler
 *
 * PROTECTS AGAINST: Information leakage via stack traces, internal error details,
 *                   database schema exposure, dependency version info.
 *
 * Rule: The client NEVER receives raw error messages or stack traces.
 * Everything is mapped to a safe, human-readable message.
 */

const { logServerError } = require('./securityLogger')

const errorHandler = (err, req, res, next) => {
  // Always log the real error server-side (for debugging)
  logServerError(req, err)

  // ── Mongoose: invalid ObjectId (e.g. /products/not-a-real-id) ──────────
  // PROTECTS AGAINST: Leaking that your ID format is MongoDB ObjectId
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
    })
  }

  // ── Mongoose: duplicate key ─────────────────────────────────────────────
  if (err.code === 11000) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field'
    const safeField = ['username', 'barcode', 'email'].includes(field) ? field : 'value'
    return res.status(409).json({
      success: false,
      message: `${safeField.charAt(0).toUpperCase() + safeField.slice(1)} already exists`,
    })
  }

  // ── Mongoose: schema validation failed ─────────────────────────────────
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message)
    return res.status(400).json({
      success: false,
      message: messages[0] || 'Validation failed',
    })
  }

  // ── JWT errors (backup — primary handling is in authMiddleware) ─────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' })
  }

  // ── CORS rejection ──────────────────────────────────────────────────────
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ success: false, message: 'Access not allowed from this origin' })
  }

  // ── Payload too large ───────────────────────────────────────────────────
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large' })
  }

  // ── SyntaxError: malformed JSON body ───────────────────────────────────
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body' })
  }

  // ── Default 500 — NEVER send raw error.message to client ───────────────
  // PROTECTS AGAINST: Leaking DB connection strings, file paths, dependency info
  const statusCode = err.statusCode || err.status || 500

  // In development: show message for faster debugging
  // In production: generic message only
  const message = process.env.NODE_ENV === 'development'
    ? err.message || 'Internal server error'
    : 'Something went wrong. Please try again.'

  res.status(statusCode).json({ success: false, message })
}

module.exports = errorHandler
