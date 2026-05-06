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

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ FATAL: JWT_SECRET must be set in .env and be at least 32 characters.')
  process.exit(1)
}

connectDB()
const app = express()

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }))

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',').map(o => o.trim())

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin "${origin}" is not allowed`))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}))

app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: false, limit: '10kb' }))
app.use(mongoSanitize({ replaceWith: '_' }))
app.use(hpp({ whitelist: ['category'] }))
app.use(requestLogger)
app.use(detectSuspiciousRequests)
app.use('/api', apiLimiter)

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./src/routes/authRoutes'))
app.use('/api/products',    require('./src/routes/productRoutes'))
app.use('/api/orders',      require('./src/routes/orderRoutes'))
app.use('/api/sales',       require('./src/routes/salesRoutes'))
app.use('/api/expenses',    require('./src/routes/expenseRoutes'))
app.use('/api/cash-drawer', require('./src/routes/cashDrawerRoutes'))
app.use('/api/utang',       require('./src/routes/utangRoutes'))

app.get('/', (req, res) => {
  res.json({ message: '🏪 Sari-Sari Store POS API', status: 'running' })
})

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})
app.use(errorHandler)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 POS API running on port ${PORT}`)
  console.log(`🔒 Security: helmet ✓  cors ✓  mongoSanitize ✓  rateLimit ✓`)
  console.log(`🌍 Allowed origins: ${allowedOrigins.join(', ')}`)
})
