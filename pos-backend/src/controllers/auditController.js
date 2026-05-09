const fs   = require('fs')
const path = require('path')

const LOG_DIR = path.join(__dirname, '../../logs')

const getAuditLogs = async (req, res) => {
  try {
    const { date, type = 'security', limit = 300 } = req.query
    const targetDate = date || new Date().toISOString().split('T')[0]
    const filepath   = path.join(LOG_DIR, `${type}-${targetDate}.log`)

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
