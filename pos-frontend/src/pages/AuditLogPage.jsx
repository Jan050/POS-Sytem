import { useState, useEffect, useCallback } from 'react'
import { auditApi } from '../api'
import { useToast } from '../components/ui/Toast'

const EVENT_COLORS = {
  FAILED_LOGIN:         'text-red-400 bg-red-500/10',
  LOGIN_SUCCESS:        'text-green-400 bg-green-500/10',
  AUTH_FAILURE:         'text-orange-400 bg-orange-500/10',
  SUSPICIOUS_REQUEST:   'text-yellow-400 bg-yellow-500/10',
  SERVER_ERROR:         'text-red-400 bg-red-500/10',
  DEFAULT:              'text-slate-400 bg-surface-700',
}

const EVENT_ICONS = {
  FAILED_LOGIN:         '🔒',
  LOGIN_SUCCESS:        '✅',
  AUTH_FAILURE:         '⚠️',
  SUSPICIOUS_REQUEST:   '🚨',
  SERVER_ERROR:         '💥',
}

export default function AuditLogPage() {
  const toast = useToast()
  const [logs,      setLogs]      = useState([])
  const [dates,     setDates]     = useState([])
  const [date,      setDate]      = useState(new Date().toISOString().split('T')[0])
  const [logType,   setLogType]   = useState('security')
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('all')

  const loadDates = useCallback(async () => {
    try {
      const res = await auditApi.getDates()
      setDates(res.data || [])
    } catch { /* silent */ }
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await auditApi.getLogs({ date, type: logType, limit: 300 })
      setLogs(res.data || [])
    } catch (err) {
      if (err.status !== 404) toast('Failed to load logs', 'error')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [date, logType])

  useEffect(() => { loadDates() }, [loadDates])
  useEffect(() => { loadLogs()  }, [loadLogs])

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.event === filter)
  const eventTypes = [...new Set(logs.map((l) => l.event))].sort()

  const getColor = (event) => EVENT_COLORS[event] || EVENT_COLORS.DEFAULT
  const getIcon  = (event) => EVENT_ICONS[event]  || '📋'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 bg-surface-800 border-b border-surface-700 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-semibold text-xl text-slate-100">Activity Audit Log</h1>
            <p className="text-slate-500 text-sm">Security events and system activity</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Log type */}
            <div className="flex bg-surface-700 rounded-xl p-1 gap-0.5">
              {[{ k: 'security', l: '🔐 Security' }, { k: 'error', l: '💥 Errors' }].map(({ k, l }) => (
                <button key={k} onClick={() => setLogType(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${logType === k ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Date */}
            <input type="date" value={date} max={new Date().toISOString().split('T')[0]}
              onChange={e => setDate(e.target.value)}
              className="input py-2 px-3 text-sm w-40" />

            <button onClick={loadLogs} className="btn btn-secondary px-3 py-2 text-xs">
              Refresh
            </button>
          </div>
        </div>

        {/* Event type filter */}
        {eventTypes.length > 0 && (
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
            <button onClick={() => setFilter('all')}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all
                ${filter === 'all' ? 'bg-amber-500 text-slate-900' : 'bg-surface-700 text-slate-400 hover:bg-surface-600'}`}>
              All ({logs.length})
            </button>
            {eventTypes.map((evt) => (
              <button key={evt} onClick={() => setFilter(evt)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all
                  ${filter === evt ? 'bg-amber-500 text-slate-900' : 'bg-surface-700 text-slate-400 hover:bg-surface-600'}`}>
                {getIcon(evt)} {evt.replace(/_/g, ' ')} ({logs.filter(l => l.event === evt).length})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Summary cards */}
        {!loading && logs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Events',    value: logs.length,                                                      color: 'text-slate-200' },
              { label: 'Failed Logins',   value: logs.filter(l => l.event === 'FAILED_LOGIN').length,              color: 'text-red-400'   },
              { label: 'Logins',          value: logs.filter(l => l.event === 'LOGIN_SUCCESS').length,             color: 'text-green-400' },
              { label: 'Suspicious',      value: logs.filter(l => l.event === 'SUSPICIOUS_REQUEST').length,        color: 'text-yellow-400'},
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-3 text-center">
                <p className={`font-mono font-bold text-2xl ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Log table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="divide-y divide-surface-700">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
                  <div className="w-8 h-5 bg-surface-700 rounded shrink-0"/>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-surface-700 rounded w-1/3"/>
                    <div className="h-3 bg-surface-700 rounded w-1/2"/>
                  </div>
                  <div className="h-3 bg-surface-700 rounded w-20 shrink-0"/>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <span className="text-4xl block mb-3">📋</span>
              <p className="text-sm">No events for this date</p>
              <p className="text-xs mt-1">Try selecting a different date or log type</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-800 sticky top-0 z-10">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Time</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2.5">Level</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2.5">Event</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2.5">Details</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700">
                  {filtered.map((log, i) => (
                    <tr key={i} className="hover:bg-surface-700/30 group">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`badge text-xs font-bold ${
                          log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                          log.level === 'WARN'  ? 'bg-orange-500/20 text-orange-400' :
                          'bg-surface-600 text-slate-400'
                        }`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getColor(log.event)}`}>
                          {getIcon(log.event)} {log.event?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-xs">
                        {log.username && <span className="font-mono text-slate-300 mr-2">@{log.username}</span>}
                        {log.path && <span className="text-slate-600">{log.method} {log.path}</span>}
                        {log.reason && <span className="text-orange-400/80">{log.reason}</span>}
                        {log.message && <span className="text-red-400/80 truncate block">{log.message?.slice(0, 80)}</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{log.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
