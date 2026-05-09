/**
 * middleware/authMiddleware.js — JWT verification
 *
 * Security improvements applied:
 *  - JWT verified with issuer + audience claims (tokens from other systems rejected)
 *  - Auth failures logged to security log
 *  - JWT_SECRET validated at startup (no weak defaults)
 *  - Token only accepted from Authorization header (not query string)
 */

const jwt  = require('jsonwebtoken')
const User = require('../models/User')
const { logAuthFailure } = require('./securityLogger')

const JWT_SECRET = process.env.JWT_SECRET

// ── protect — verifies JWT, attaches req.user ──────────────────────────────
const protect = async (req, res, next) => {
  let token

  // SECURITY: only accept Bearer token from Authorization header.
  // Query string tokens (?token=...) are dangerous — appear in server logs and browser history.
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Please log in.',
      code: 'NO_TOKEN',
    })
  }

  try {
    // Verify with issuer + audience — rejects tokens created by other systems
    // or with a different secret, even if the signature format looks valid
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer:   'tindahan-pos',
      audience: 'pos-client',
    })

    // Re-verify user still exists and is active — catches deleted/deactivated users
    // even if their token hasn't expired yet
    const user = await User.findById(decoded.id)
      .select('_id username role isActive tokenVersion passwordChangedAt')
      .lean()

    if (!user || !user.isActive) {
      logAuthFailure(req, 'user_not_found_or_deactivated')
      return res.status(401).json({
        success: false,
        message: 'Session invalid. Please log in again.',
        code: 'USER_NOT_FOUND',
      })
    }

    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      logAuthFailure(req, 'token_version_mismatch')
      return res.status(401).json({
        success: false,
        message: 'Session invalid. Please log in again.',
        code: 'TOKEN_REVOKED',
      })
    }

    if (user.passwordChangedAt && decoded.iat) {
      const passwordChangedAtSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)
      if (decoded.iat < passwordChangedAtSec) {
        logAuthFailure(req, 'token_issued_before_password_change')
        return res.status(401).json({
          success: false,
          message: 'Session invalid. Please log in again.',
          code: 'TOKEN_STALE',
        })
      }
    }

    req.user = { id: user._id, username: user.username, role: user.role }
    next()
  } catch (err) {
    logAuthFailure(req, err.name)

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.',
        code: 'TOKEN_EXPIRED',
      })
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please log in again.',
      code: 'INVALID_TOKEN',
    })
  }
}

// ── requireAdmin — must follow protect ────────────────────────────────────
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.',
      code: 'FORBIDDEN',
    })
  }
  next()
}

// ── requireCashierOrAdmin — allows both roles ──────────────────────────────
const requireCashierOrAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'cashier'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied.',
      code: 'FORBIDDEN',
    })
  }
  next()
}

module.exports = { protect, requireAdmin, requireCashierOrAdmin }
