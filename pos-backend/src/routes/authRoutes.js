const express = require('express')
const router  = express.Router()
const { login, getMe, changePassword, getUsers, createUser } = require('../controllers/authController')
const { protect, requireAdmin } = require('../middleware/authMiddleware')
const { loginLimiter }  = require('../middleware/rateLimiter')
const {
  validateLogin,
  validateCreateUser,
  validateChangePassword,
} = require('../middleware/validators')

// POST /api/auth/login
//  loginLimiter: 10 attempts/15min per IP — brute-force protection
//  validateLogin: sanitizes and validates username/password fields
router.post('/login', loginLimiter, validateLogin, login)

// GET /api/auth/me
router.get('/me', protect, getMe)

// POST /api/auth/change-password
router.post('/change-password', protect, validateChangePassword, changePassword)

// GET/POST /api/auth/users (admin only)
router.get('/users',  protect, requireAdmin, getUsers)
router.post('/users', protect, requireAdmin, validateCreateUser, createUser)

module.exports = router
