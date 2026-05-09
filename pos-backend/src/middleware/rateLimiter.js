/**
 * middleware/rateLimiter.js
 *
 * PROTECTS AGAINST: Brute-force attacks, credential stuffing, DoS via repeated requests.
 *
 * Why separate limits per endpoint?
 *  - Login needs a tight window (10 attempts / 15 min) — prevents password guessing
 *  - General API needs a generous limit (300 / 15 min) — supports normal cashier use
 *  - Strict limit (50 / 15 min) on write operations — prevents bulk data manipulation
 */

const rateLimit = require('express-rate-limit')

// ── Shared handler: returns JSON (not HTML) on limit exceeded ──────────────
const limitReachedHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please wait a moment and try again.',
    retryAfter: Math.ceil(req.rateLimit.resetTime / 1000 - Date.now() / 1000),
  })
}

// ── 1. Login rate limit — TIGHT ───────────────────────────────────────────
// 10 attempts per 15 minutes per IP. Stops password brute-forcing.
const loginLimiter = rateLimit({
  windowMs: (parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MIN) || 15) * 60 * 1000,
  max:       parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,   // Sends RateLimit-* headers to client
  legacyHeaders:   false,
  handler: (req, res) => {
    // Log brute-force attempts (console visible in server logs / monitoring)
    console.warn(`[SECURITY] Rate limit hit on /api/auth/login — IP: ${req.ip} at ${new Date().toISOString()}`)
    limitReachedHandler(req, res)
  },
})

// ── 2. General API limit — GENEROUS ──────────────────────────────────────
// 300 requests per 15 min per IP. Allows busy cashier workflows.
const apiLimiter = rateLimit({
  windowMs: (parseInt(process.env.API_RATE_LIMIT_WINDOW_MIN) || 15) * 60 * 1000,
  max:       parseInt(process.env.API_RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: limitReachedHandler,
})

// ── 3. Write operation limit — MODERATE ──────────────────────────────────
// 50 write requests per 15 min. Prevents bulk product creation/deletion attacks.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    console.warn(`[SECURITY] Write rate limit hit — IP: ${req.ip}, route: ${req.path}`)
    limitReachedHandler(req, res)
  },
})

// ── 4. Password change limiter — STRICT IP + user key ─────────────────────
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${rateLimit.ipKeyGenerator(req.ip)}:${req.user?.id || 'anonymous'}`,
  handler: (req, res) => {
    console.warn(`[SECURITY] Password change rate limit hit — IP: ${req.ip}, user: ${req.user?.id || 'unknown'}`)
    limitReachedHandler(req, res)
  },
})

module.exports = { loginLimiter, apiLimiter, writeLimiter, passwordChangeLimiter }
