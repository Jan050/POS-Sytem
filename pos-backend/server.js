/**
 * server.js — Secure Express entry point
 *
 * Security layers applied in order (order matters):
 *  1. helmet        — Sets 14 secure HTTP headers (prevents clickjacking, XSS, sniffing)
 *  2. cors          — Restricts which origins can call the API (not wildcard)
 *  3. mongoSanitize — Strips MongoDB operator keys ($where, $gt) from req.body/query
 *  4. hpp           — Prevents HTTP Parameter Pollution (duplicate query params)
 *  5. express.json  — Limits body size to 10kb (prevents oversized payload DoS)
 *  6. requestLogger — Logs every request with status + timing
 *  7. detectSuspiciousRequests — Flags known attack patterns
 *  8. apiLimiter    — 300 req/15min per IP on all routes
 *  9. Route handlers
 * 10. errorHandler  — Catches all errors, never exposes stack traces
 */

const express       = require('express')
const helmet        = require('helmet')
const cors          = require('cors')
const mongoSanitize = require('express-mongo-sanitize')
const hpp           = require('hpp')
const dotenv        = require('dotenv')

const connectDB    = require('./src/config/db')
const errorHandler = require('./src/middleware/errorHandler')
const { apiLimiter } = require('./src/middleware/rateLimiter')
const { requestLogger, detectSuspiciousRequests } = require('./src/middleware/securityLogger')

dotenv.config()

// ── Fail fast: refuse to start without a real JWT secret ──────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ FATAL: JWT_SECRET must be set in .env and be at least 32 characters.')
  console.error('   Generate one with: node -e "require(\'crypto\').randomBytes(48).toString(\'hex\')"')
  process.exit(1)
}

connectDB()

const app = express()

// ── 1. Helmet — secure HTTP headers ───────────────────────────────────────
// Sets: X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security,
//       Content-Security-Policy, Referrer-Policy, and 9 more.
// PROTECTS AGAINST: Clickjacking, MIME sniffing, cross-site scripting injection via headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin for API
  contentSecurityPolicy: false, // CSP is for HTML pages — our API returns JSON
}))

// ── 2. CORS — restrict to known frontend origins ──────────────────────────
// PROTECTS AGAINST: Unauthorized cross-origin requests from attacker-controlled sites
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, mobile apps, server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin "${origin}" is not allowed`))
  },
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // Cache preflight for 24h — reduces OPTIONS requests
}))

// ── 3. Body parsing — size limited ────────────────────────────────────────
// PROTECTS AGAINST: Oversized payload DoS attacks
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: false, limit: '10kb' }))

// ── 4. MongoDB sanitization ────────────────────────────────────────────────
// Strips keys starting with $ or containing . from req.body, req.params, req.query
// PROTECTS AGAINST: NoSQL injection — e.g. { "username": { "$gt": "" } }
app.use(mongoSanitize({
  replaceWith: '_',      // Replace $ with _ instead of silently removing (easier to debug)
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] MongoDB injection attempt sanitized — key: "${key}", IP: ${req.ip}`)
  },
}))

// ── 5. HTTP Parameter Pollution protection ────────────────────────────────
// PROTECTS AGAINST: ?price=0&price=99999 — takes the last value by default
// Could be used to bypass validation checks that expect a single value
app.use(hpp({
  // Allow arrays for these specific params (they legitimately can be arrays)
  whitelist: ['category'],
}))

// ── 6. Request logging + suspicious pattern detection ─────────────────────
app.use(requestLogger)
app.use(detectSuspiciousRequests)

// ── 7. Global rate limit — all API routes ─────────────────────────────────
// Individual tighter limits applied on login/write routes in their route files
app.use('/api', apiLimiter)

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./src/routes/authRoutes'))
app.use('/api/products', require('./src/routes/productRoutes'))
app.use('/api/orders',   require('./src/routes/orderRoutes'))
app.use('/api/sales',    require('./src/routes/salesRoutes'))

// ── Health check (public — no auth needed) ────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: '🏪 Sari-Sari Store POS API',
    status: 'running',
    // SECURITY: never expose version or tech stack details in production
    ...(process.env.NODE_ENV === 'development' && {
      version: '2.0.0',
      env: process.env.NODE_ENV,
    }),
  })
})

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

// ── Global error handler ──────────────────────────────────────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 POS API running on port ${PORT}`)
  console.log(`🔒 Security: helmet ✓  cors ✓  mongoSanitize ✓  rateLimit ✓  hpp ✓`)
  console.log(`🌍 Allowed origins: ${allowedOrigins.join(', ')}`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📦 Environment: ${process.env.NODE_ENV}`)
  }
})
