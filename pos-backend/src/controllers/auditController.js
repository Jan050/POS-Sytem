const fs   = require('fs')
const path = require('path')
const { logSuspiciousRequest } = require('../middleware/securityLogger')

const LOG_DIR = path.resolve(path.join(__dirname, '../../logs'))

const VALID_LOG_TYPES = new Set(['security', 'error'])
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/

const resolveLogPath = (type, date) => {
  if (!VALID_LOG_TYPES.has(type)) {
    return { error: 'Invalid log type' }
  }

  if (!DATE_FORMAT.test(date)) {
    return { error: 'Invalid date format' }
  }

  const filename = `${type}-${date}.log`
  const normalizedFilename = path.normalize(filename)
  if (normalizedFilename !== filename || normalizedFilename.includes(path.sep)) {
    return { error: 'Invalid log filename' }
  }

  const resolved = path.resolve(LOG_DIR, normalizedFilename)
  const expectedPrefix = `${LOG_DIR}${path.sep}`
  if (!resolved.startsWith(expectedPrefix)) {
    return { error: 'Path traversal detected' }
  }

  return { filepath: resolved }
}

const getAuditLogs = async (req, res) => {
  try {
    const { date, type = 'security', limit = 300 } = req.query
    const targetDate = date || new Date().toISOString().split('T')[0]
    const { filepath, error } = resolveLogPath(type, targetDate)
    if (error) {
      logSuspiciousRequest(req, `Blocked audit log read: ${error}`)
      return res.status(400).json({ success: false, message: 'Invalid log request' })
    }

    if (!fs.existsSync(filepath))
      return res.status(200).json({ success: true, date: targetDate, count: 0, data: [] })

    const raw     = fs.readFileSync(filepath, 'utf8')
    const entries = raw.trim().split('\n').filter(Boolean)
      .map(line => { try { return JSON.parse(line) } catch { return null } })
      .filter(Boolean)
      .reverse()
      .slice(0, parseInt(limit) || 300)

    res.status(200).json({ success: true, date: targetDate, count: entries.length, data: entries })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to read logs' })
  }
}

const getAvailableDates = async (req, res) => {
  try {
    if (!fs.existsSync(LOG_DIR))
      return res.status(200).json({ success: true, data: [] })

    const files = fs.readdirSync(LOG_DIR)
    const dates = [...new Set(
      files.filter(f => f.endsWith('.log'))
           .map(f => f.replace(/^(security|error)-/, '').replace('.log', ''))
    )].sort().reverse()

    res.status(200).json({ success: true, data: dates })
  } catch {
    res.status(500).json({ success: false, message: 'Failed to read log directory' })
  }
}

module.exports = { getAuditLogs, getAvailableDates }
