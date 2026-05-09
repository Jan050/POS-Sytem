/**
 * authController.js — Secure authentication
 *
 * Security improvements applied:
 *  - JWT_SECRET validated at startup (no weak defaults)
 *  - All failed logins logged with IP + timestamp
 *  - Successful logins logged
 *  - Vague error messages (don't confirm if username exists)
 *  - No raw error.message in 500 responses
 *  - Constant-time password comparison (bcrypt handles this)
 *  - Password never returned in any response
 */

const jwt  = require('jsonwebtoken')
const User = require('../models/User')
const {
  logFailedLogin,
  logSuccessfulLogin,
} = require('../middleware/securityLogger')

// ── Startup validation — crash loudly if JWT_SECRET is missing/weak ────────
// Prevents accidentally running with a default/empty secret
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRE = process.env.JWT_EXPIRE || '8h'

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET is missing or too short. Set it in .env (min 32 chars).')
}

const signToken = (user) =>
  jwt.sign(
    {
      id:       user._id,
      role:     user.role,
      username: user.username,
      tokenVersion: user.tokenVersion || 0,
      // Note: don't add password, email, or other sensitive fields to payload
      // JWT payload is base64 encoded, NOT encrypted — it's readable to anyone
    },
    JWT_SECRET,
    {
      expiresIn:  JWT_EXPIRE,
      issuer:     'tindahan-pos',   // Helps detect tokens from other systems
      audience:   'pos-client',
    }
  )

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    // Note: input validation (length, chars) already handled by validateLogin middleware
    const { username, password } = req.body

    // .select('+password') because password has `select: false` in schema
    const user = await User.findOne({ username: username.toLowerCase().trim() }).select('+password')

    // SECURITY: identical message whether username not found OR password wrong.
    // Different messages let attackers enumerate valid usernames (user enumeration attack).
    if (!user || !user.isActive) {
      logFailedLogin(req, username)
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      logFailedLogin(req, username)  // Log each failed attempt with IP
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      })
    }

    // Update last login timestamp (non-blocking — don't fail login if this fails)
    User.findByIdAndUpdate(user._id, { lastLogin: new Date() }).catch(() => {})

    logSuccessfulLogin(req, user._id, user.username, user.role)

    const token = signToken(user)

    // SECURITY: only return what the frontend needs — not the full user document
    res.status(200).json({
      success:   true,
      token,
      expiresIn: JWT_EXPIRE,
      user: {
        id:          user._id,
        username:    user.username,
        displayName: user.displayName || user.username,
        role:        user.role,
        requirePasswordChange: !!user.requirePasswordChange,
        // never include: password, __v, internal flags
      },
    })
  } catch (error) {
    // SECURITY: never expose error.message here — could leak DB internals
    console.error('[auth/login] Unexpected error:', error.message)
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    // req.user.id set by protect middleware — already verified
    const user = await User.findById(req.user.id).select('-password -__v')
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }
    res.status(200).json({
      success: true,
      user: {
        id:          user._id,
        username:    user.username,
        displayName: user.displayName || user.username,
        role:        user.role,
        lastLogin:   user.lastLogin,
        createdAt:   user.createdAt,
        requirePasswordChange: !!user.requirePasswordChange,
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to retrieve profile' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/change-password  (protected)
// ─────────────────────────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    // Validation (length, required) handled by validateChangePassword middleware
    const { currentPassword, newPassword } = req.body

    const user = await User.findById(req.user.id).select('+password')
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      // Log failed password change attempt — could indicate account takeover attempt
      console.warn(`[SECURITY] Failed password change for user: ${user.username}, IP: ${req.ip}`)
      return res.status(401).json({ success: false, message: 'Current password is incorrect' })
    }

    user.password = newPassword  // Schema pre-save hook will hash this
    user.requirePasswordChange = false
    await user.save()

    console.info(`[AUTH] Password changed for user: ${user.username}`)
    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
      forceRelogin: true,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to change password' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/users  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    // SECURITY: explicitly exclude password even though select:false is set
    // Belt-and-suspenders approach — if schema changes, this still protects
    const users = await User.find({})
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .lean()

    res.status(200).json({ success: true, count: users.length, data: users })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load users' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/users  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
const createUser = async (req, res) => {
  try {
    // Validation handled by validateCreateUser middleware
    const { username, password, role, displayName } = req.body

    const exists = await User.findOne({ username: username.toLowerCase() })
    if (exists) {
      return res.status(409).json({ success: false, message: 'Username already exists' })
    }

    const user = await User.create({
      username:    username.toLowerCase().trim(),
      password,                                      // Hashed by pre-save hook
      role:        role || 'cashier',
      displayName: displayName?.trim() || username,
      requirePasswordChange: true,
    })

    console.info(`[AUTH] New user created: ${user.username} (${user.role}) by admin: ${req.user.username}`)

    // SECURITY: return the new user object via toJSON() which strips password
    res.status(201).json({
      success: true,
      data: {
        id:          user._id,
        username:    user.username,
        displayName: user.displayName,
        role:        user.role,
        isActive:    user.isActive,
        createdAt:   user.createdAt,
      },
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message)
      return res.status(400).json({ success: false, message: messages[0] })
    }
    res.status(500).json({ success: false, message: 'Failed to create user' })
  }
}

module.exports = { login, getMe, changePassword, getUsers, createUser }
