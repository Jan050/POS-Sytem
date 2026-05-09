/**
 * middleware/securityLogger.js
 *
 * PROTECTS AGAINST: Undetected attacks, no post-incident evidence.
 *
 * Lightweight file-based security logger for a small store POS.
 * Logs to console (visible in PM2/server logs) + daily rotating .log files.
 *
 * Events logged:
 *  - Failed login attempts (IP, username, timestamp)
 *  - Rate limit violations
 *  - JWT validation failures
 *  - Requests with suspicious patterns (attempted injection)
 *  - Server errors (500s)
 *
 * In production: pipe stdout to a log aggregator (Papertrail, Logtail, etc.)
 */

const fs   = require('fs')
const path = require('path')

// Create logs directory if it doesn't exist
const LOG_DIR = path.join(__dirname, '../../logs')
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

// ── Get today's log file path ─────────────────────────────────────────────
const getLogFile = (type = 'security') => {
  const date = new Date().toISOString().split('T')[0] // e.g. "2024-05-01"
  return path.join(LOG_DIR, `${type}-${date}.log`)
}

// ── Write a line to the log file + console ────────────────────────────────
const writeLog = (level, event, details = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  }

  const line = JSON.stringify(entry)

  // Always print to console (captured by PM2, Docker, systemd, etc.)
  if (level === 'WARN' || level === 'ERROR') {
    console.warn(`[${level}] ${event}`, details)
  }

  // Write to file asynchronously — don't block request handling
  const file = getLogFile(level === 'ERROR' ? 'error' : 'security')
  fs.appendFile(file, line + '\n', (err) => {
    if (err) console.error('[Logger] Failed to write log:', err.message)
  })
}

// ════════════════════════════════════════════════════════════
// EXPORTED LOG FUNCTIONS (call these in controllers)
// ════════════════════════════════════════════════════════════

/**
 * Log a failed login attempt.
 * Called from authController when credentials are wrong.
 */
const logFailedLogin = (req, username) => {
  writeLog('WARN', 'FAILED_LOGIN', {
    ip:        req.ip,
    userAgent: req.get('User-Agent')?.slice(0, 100),
    username:  username?.toLowerCase().slice(0, 30), // truncate, don't log full input
    path:      req.path,
  })
}

/**
 * Log a successful login.
 */
const logSuccessfulLogin = (req, userId, username, role) => {
  writeLog('INFO', 'LOGIN_SUCCESS', {
    ip:       req.ip,
    userId:   userId?.toString(),
    username,
    role,
  })
}

/**
 * Log a JWT auth failure (bad token, expired, tampered).
 */
const logAuthFailure = (req, reason) => {
  writeLog('WARN', 'AUTH_FAILURE', {
    ip:        req.ip,
    reason,
    path:      req.path,
    method:    req.method,
    userAgent: req.get('User-Agent')?.slice(0, 100),
  })
}

/**
 * Log suspicious input (injection attempts, invalid IDs, etc.)
 */
const logSuspiciousRequest = (req, detail) => {
  writeLog('WARN', 'SUSPICIOUS_REQUEST', {
    ip:     req.ip,
    method: req.method,
    path:   req.path,
    detail,
    // Never log full body — may contain PII
    bodyKeys: req.body ? Object.keys(req.body) : [],
  })
}

/**
 * Log a server error.
 */
const logServerError = (req, error) => {
  writeLog('ERROR', 'SERVER_ERROR', {
    ip:      req.ip,
    method:  req.method,
    path:    req.path,
    message: error.message?.slice(0, 200),
    // Stack only logged in development
    stack: process.env.NODE_ENV === 'development' ? error.stack?.slice(0, 500) : undefined,
  })
}

const logSecurityEvent = (event, details = {}) => {
  writeLog('INFO', event, details)
}

// ── Request logging middleware (attach to app for all routes) ─────────────
// Logs method, path, status, and response time for every request
const requestLogger = (req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const ms = Date.now() - start
    const log = `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms IP:${req.ip}`

    // Only log slow or error responses in production to avoid noise
    if (process.env.NODE_ENV === 'development') {
      console.log(log)
    } else if (res.statusCode >= 400 || ms > 2000) {
      console.warn(log)
    }
  })

  next()
}

// ── Detect obviously malicious query patterns ─────────────────────────────
// PROTECTS AGAINST: MongoDB operator injection in query strings ($where, $gt, etc.)
const suspiciousPatterns = [
  /\$where/i,
  /\$expr/i,
  /javascript:/i,
  /<script/i,
  /eval\s*\(/i,
  /\.\.\//,           // path traversal
  /\x00/,             // null byte injection
]

const detectSuspiciousRequests = (req, res, next) => {
  const checkValue = (val, key) => {
    if (typeof val === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(val)) {
          logSuspiciousRequest(req, `Suspicious pattern in field "${key}": ${pattern.toString()}`)
          // Don't block outright — mongo-sanitize handles actual injection
          // But flag it for monitoring
          break
        }
      }
    } else if (typeof val === 'object' && val !== null) {
      Object.entries(val).forEach(([k, v]) => checkValue(v, k))
    }
  }

  checkValue(req.query, 'query')
  checkValue(req.body,  'body')
  next()
}

module.exports = {
  logFailedLogin,
  logSuccessfulLogin,
  logAuthFailure,
  logSuspiciousRequest,
  logServerError,
  logSecurityEvent,
  requestLogger,
  detectSuspiciousRequests,
}
