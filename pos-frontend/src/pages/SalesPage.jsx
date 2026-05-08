/**
 * SalesPage.jsx — Advanced Sales Dashboard
 * Features:
 *  - Period tabs: Today | 7 Days | 30 Days
 *  - Metrics cards: revenue, orders, avg order, today snapshot
 *  - Recharts AreaChart: sales trend
 *  - Recharts BarChart: top products by revenue
 *  - Granular loading skeletons per section
 *  - Clickable order detail modal with reprint
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { salesApi, orderApi } from '../api'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import { StatCardSkeleton, ChartSkeleton, RowSkeleton, BestSellerSkeleton } from '../components/ui/Skeleton'
import { formatPeso, formatDateTime, shortId } from '../utils/formatters'
import { printReceipt } from '../utils/printReceipt'
import {
  generateDailySalesReport,
  generateDeadStockReport,
  generateProfitReport,
  printReport,
} from '../utils/generateReport'

// ────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ────────────────────────────────────────────────────────────────────────────

const PERIODS = [
  { key: 'today',  label: 'Today'   },
  { key: '7days',  label: '7 Days'  },
  { key: '30days', label: '30 Days' },
]

const TABS = [
  { key: 'overview',  label: '📊 Overview'  },
  { key: 'hourly',    label: '⏰ Hourly'    },
  { key: 'monthly',   label: '📅 Monthly'   },
  { key: 'inventory', label: '📦 Inventory' },
]

const SalesTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-700 border border-surface-500 rounded-xl px-3 py-2.5 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-mono font-bold text-amber-400">{formatPeso(payload[0]?.value || 0)}</p>
      {payload[0]?.payload?.orderCount !== undefined && (
        <p className="text-slate-400 mt-0.5">{payload[0].payload.orderCount} orders</p>
      )}
    </div>
  )
}

const StatCard = ({ label, value, sub, color, icon }) => (
  <div className="card p-4">
    <div className={`inline-flex p-2 rounded-lg mb-3 ${color.includes('amber') ? 'bg-amber-500/10' : color.includes('blue') ? 'bg-blue-500/10' : color.includes('green') ? 'bg-green-500/10' : 'bg-purple-500/10'}`}>
      <span className={color}>{icon}</span>
    </div>
    <p className={`font-mono font-bold text-xl md:text-2xl ${color}`}>{value}</p>
    <p className="text-slate-400 text-xs font-medium mt-1">{label}</p>
    {sub && <p className="text-slate-600 text-xs mt-0.5">{sub}</p>}
  </div>
)

const BestSellerRow = ({ item, rank, maxRevenue }) => {
  const pct    = maxRevenue > 0 ? (item.totalRevenue / maxRevenue) * 100 : 0
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-700/60 last:border-0">
      <span className="text-base w-6 shrink-0 text-center">{medals[rank] || `${rank + 1}.`}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className="text-sm font-medium text-slate-200 truncate">{item.name}</span>
          <span className="font-mono text-xs text-amber-400 shrink-0">{formatPeso(item.totalRevenue)}</span>
        </div>
        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${rank === 0 ? 'bg-amber-500' : rank === 1 ? 'bg-amber-600/70' : 'bg-surface-500'}`}
               style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-600 mt-1">{item.totalQty} units · {item.orderCount} orders</p>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: OVERVIEW (existing content, refactored)
// ────────────────────────────────────────────────────────────────────────────
const OverviewTab = ({ period, onVoid }) => {
  const toast = useToast()
  const [todayData,     setTodayData]     = useState(null)
  const [summary,       setSummary]       = useState([])
  const [summaryTotals, setSummaryTotals] = useState(null)
  const [bestSellers,   setBestSellers]   = useState([])
  const [orders,        setOrders]        = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [loadingStats,  setLoadingStats]  = useState(true)
  const [loadingChart,  setLoadingChart]  = useState(true)
  const [loadingBest,   setLoadingBest]   = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoadingStats(true); setLoadingChart(true); setLoadingBest(true); setLoadingOrders(true)
    try {
      const [todayRes, summaryRes, bestRes, ordersRes] = await Promise.all([
        salesApi.getToday(),
        salesApi.getSummary(period),
        salesApi.getBestSellers(period, 8),
        orderApi.getAll({ limit: 30 }),
      ])
      setTodayData(todayRes.data)
      setSummary(summaryRes.data || [])
      setSummaryTotals(summaryRes.totals || null)
      setBestSellers(bestRes.data || [])
      setOrders(ordersRes.data || [])
    } catch { toast('Failed to load data', 'error') }
    finally {
      setLoadingStats(false); setLoadingChart(false)
      setLoadingBest(false); setLoadingOrders(false)
    }
  }, [period])

  useEffect(() => { fetchAll() }, [fetchAll])

  const displayStats = period === 'today' ? todayData : summaryTotals
  const chartData    = useMemo(() => summary.map((d) => ({
    ...d,
    label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
  })), [summary])
  const maxRevenue = useMemo(() => Math.max(...bestSellers.map((b) => b.totalRevenue), 1), [bestSellers])

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loadingStats ? Array(4).fill(0).map((_, i) => <StatCardSkeleton key={i} />) : (
          <>
            <StatCard label="Revenue"      value={formatPeso(displayStats?.totalSales || 0)} sub={PERIODS.find((p) => p.key === period)?.label} color="text-amber-400"  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <StatCard label="Transactions" value={displayStats?.orderCount ?? 0}              sub="Completed orders"                                                          color="text-blue-400"   icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} />
            <StatCard label="Avg Order"    value={formatPeso(displayStats?.avgOrder || 0)}    sub="Per transaction"                                                          color="text-green-400"  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
            <StatCard label="Today"        value={formatPeso(todayData?.totalSales || 0)}      sub={`${todayData?.orderCount ?? 0} orders today`}                           color="text-purple-400" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          </>
        )}
      </div>

      {/* Chart + Best Sellers */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3">
          {loadingChart ? <ChartSkeleton height={220} /> : (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-slate-200 text-sm">Sales Trend</h3>
                <span className="text-xs text-slate-500 bg-surface-700 px-2 py-1 rounded-lg">{PERIODS.find((p) => p.key === period)?.label}</span>
              </div>
              {chartData.length === 0 ? <div className="flex items-center justify-center h-48 text-slate-600 text-sm">No data for this period</div> : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                    <defs><linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2e3347" vertical={false}/>
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `₱${(v/1000).toFixed(1)}k` : `₱${v}`}/>
                    <Tooltip content={<SalesTooltip />}/>
                    <Area type="monotone" dataKey="totalSales" stroke="#f59e0b" strokeWidth={2.5} fill="url(#salesGrad)" dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: '#fbbf24' }}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
        <div className="xl:col-span-2">
          {loadingBest ? (
            <div className="card p-4"><div className="h-4 w-28 bg-surface-700 rounded animate-pulse mb-4"/>{Array(5).fill(0).map((_, i) => <BestSellerSkeleton key={i}/>)}</div>
          ) : (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-slate-200 text-sm">Best Sellers</h3>
                <span className="text-xs text-slate-500 bg-surface-700 px-2 py-1 rounded-lg">by revenue</span>
              </div>
              {bestSellers.length === 0 ? <div className="text-center py-10 text-slate-600 text-sm">No data yet</div>
                : bestSellers.map((item, i) => <BestSellerRow key={item.productId || i} item={item} rank={i} maxRevenue={maxRevenue}/>)}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
          <h3 className="font-display font-semibold text-slate-200">Recent Transactions</h3>
          {!loadingOrders && <span className="text-xs text-slate-500 bg-surface-700 px-2 py-1 rounded-lg">{orders.length} orders</span>}
        </div>
        {loadingOrders ? Array(6).fill(0).map((_, i) => <RowSkeleton key={i}/>) : orders.length === 0 ? (
          <div className="text-center py-14 text-slate-600 text-sm">No transactions yet</div>
        ) : orders.map((order) => (
          <button key={order._id} onClick={() => setSelectedOrder(order)}
            className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-surface-700 last:border-0 hover:bg-surface-700/40 transition-colors text-left group">
            <span className="font-mono text-xs bg-surface-700 group-hover:bg-surface-600 text-slate-400 px-2 py-1 rounded-lg shrink-0">#{shortId(order._id)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300 truncate">{order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</p>
              <p className="text-xs text-slate-600 mt-0.5">{formatDateTime(order.createdAt)} · {order.items.length} items</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono font-bold text-amber-400">{formatPeso(order.total)}</p>
              {order.change > 0 && <p className="text-xs text-green-500 mt-0.5">chg ₱{order.change.toFixed(2)}</p>}
            </div>
            <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
        ))}
      </div>

      {/* Order Detail Modal */}
      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Order #${shortId(selectedOrder?._id)}`} size="sm">
        {selectedOrder && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">{new Date(selectedOrder.createdAt).toLocaleString('en-PH', { dateStyle: 'full', timeStyle: 'short' })}</p>
            <div className="bg-surface-900 rounded-xl divide-y divide-surface-700">
              {selectedOrder.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div><p className="text-sm text-slate-200">{item.name}</p><p className="text-xs text-slate-500 font-mono">₱{item.price.toFixed(2)} × {item.quantity}</p></div>
                  <span className="font-mono font-semibold text-slate-200">₱{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="bg-surface-900 rounded-xl p-4 space-y-2">
              <div className="flex justify-between font-bold text-amber-400"><span>Total</span><span className="font-mono">{formatPeso(selectedOrder.total)}</span></div>
              {selectedOrder.cash > 0 && <>
                <div className="flex justify-between text-sm text-slate-400"><span>Cash</span><span className="font-mono">₱{selectedOrder.cash.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-green-400"><span>Change</span><span className="font-mono">₱{selectedOrder.change.toFixed(2)}</span></div>
              </>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => printReceipt(selectedOrder)} className="btn btn-secondary flex-1 py-2.5 text-sm">🖨 Reprint</button>
              {selectedOrder.status !== 'voided' && (
                <button onClick={() => { onVoid(selectedOrder); setSelectedOrder(null) }} className="btn btn-danger px-3 py-2.5 text-sm">Void</button>
              )}
              <button onClick={() => setSelectedOrder(null)} className="btn btn-secondary px-3 py-2.5 text-sm">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: HOURLY
// ────────────────────────────────────────────────────────────────────────────
const HourlyTab = () => {
  const toast = useToast()
  const today = new Date().toISOString().split('T')[0]
  const [date,    setDate]    = useState(today)
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await salesApi.getHourly(date)
      setData(res.data || [])
    } catch { toast('Failed to load hourly data', 'error') }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { load() }, [load])

  const peakHour  = data.reduce((max, h) => h.totalSales > max.totalSales ? h : max, data[0] || { hour: 0, totalSales: 0, label: '—' })
  const totalSales= data.reduce((s, h) => s + h.totalSales, 0)
  const totalOrds = data.reduce((s, h) => s + h.orderCount, 0)

  const HourlyTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-surface-700 border border-surface-500 rounded-xl px-3 py-2.5 shadow-xl text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className="font-mono font-bold text-amber-400">{formatPeso(payload[0]?.value || 0)}</p>
        {payload[1] && <p className="text-blue-400 mt-0.5">{payload[1]?.value} orders</p>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Date picker + summary */}
      <div className="card p-4">
        <div className="flex items-center gap-4 flex-wrap mb-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              max={today} className="input px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3 flex-1 min-w-0">
            <div className="bg-surface-700 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">Total Revenue</p>
              <p className="font-mono font-bold text-amber-400 text-lg">{formatPeso(totalSales)}</p>
            </div>
            <div className="bg-surface-700 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">Total Orders</p>
              <p className="font-mono font-bold text-blue-400 text-lg">{totalOrds}</p>
            </div>
            <div className="bg-surface-700 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">Peak Hour</p>
              <p className="font-mono font-bold text-green-400 text-lg">{peakHour?.label || '—'}</p>
            </div>
          </div>
        </div>

        {loading ? <div className="h-64 bg-surface-700 animate-pulse rounded-xl"/> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e3347" vertical={false}/>
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} interval={1}/>
              <YAxis yAxisId="left"  tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `₱${(v/1000).toFixed(1)}k` : `₱${v}`}/>
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false}/>
              <Tooltip content={<HourlyTooltip />}/>
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}/>
              <Bar yAxisId="left"  dataKey="totalSales" name="Revenue (₱)" fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={28}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.hour === peakHour?.hour && d.totalSales > 0 ? '#f59e0b' : '#3a4058'}/>
                ))}
              </Bar>
              <Bar yAxisId="right" dataKey="orderCount" name="Orders" fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={16} opacity={0.6}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Hourly breakdown table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-700">
          <h3 className="font-display font-semibold text-slate-200 text-sm">Hourly Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-800">
              <tr>
                {['Hour','Revenue','Orders','Avg/Order','Activity'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {data.filter((h) => h.totalSales > 0).length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-600 text-sm">No sales on this date</td></tr>
              ) : data.map((hour) => {
                const barPct = totalSales > 0 ? (hour.totalSales / peakHour.totalSales) * 100 : 0
                const avg    = hour.orderCount > 0 ? hour.totalSales / hour.orderCount : 0
                return (
                  <tr key={hour.hour} className={`${hour.hour === peakHour?.hour && hour.totalSales > 0 ? 'bg-amber-500/5' : ''} hover:bg-surface-700/30`}>
                    <td className="px-4 py-2.5 font-mono text-slate-300">{hour.label}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-amber-400">{hour.totalSales > 0 ? formatPeso(hour.totalSales) : <span className="text-slate-600">—</span>}</td>
                    <td className="px-4 py-2.5 text-slate-300">{hour.orderCount || <span className="text-slate-600">—</span>}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-400">{avg > 0 ? formatPeso(avg) : <span className="text-slate-600">—</span>}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden max-w-[80px]">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${barPct}%` }}/>
                        </div>
                        {hour.hour === peakHour?.hour && hour.totalSales > 0 && (
                          <span className="text-[10px] text-amber-400 font-bold">PEAK</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: MONTHLY COMPARISON
// ────────────────────────────────────────────────────────────────────────────
const MonthlyTab = () => {
  const toast = useToast()
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    salesApi.getMonthly()
      .then((res) => setData(res.data || []))
      .catch(() => toast('Failed to load monthly data', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const [current, previous] = data
  const pctChange = current && previous && previous.totalSales > 0
    ? parseFloat((((current.totalSales - previous.totalSales) / previous.totalSales) * 100).toFixed(1))
    : null

  // Overlay chart data: zip days from both months
  const overlayData = useMemo(() => {
    if (!current || !previous) return []
    const maxDays = Math.max(current.days.length, previous.days.length)
    return Array.from({ length: maxDays }, (_, i) => ({
      day:      i + 1,
      current:  current.days[i]?.totalSales  || 0,
      previous: previous.days[i]?.totalSales || 0,
    }))
  }, [current, previous])

  const OverlayTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-surface-700 border border-surface-500 rounded-xl px-3 py-2.5 shadow-xl text-xs">
        <p className="text-slate-400 mb-1.5">Day {label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-mono">{p.name}: {formatPeso(p.value)}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array(2).fill(0).map((_, i) => <div key={i} className="h-40 rounded-xl bg-surface-700 animate-pulse"/>)}
        </div>
      ) : (
        <>
          {/* Month comparison cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.map((month, i) => (
              <div key={i} className={`card p-5 ${i === 0 ? 'border-amber-500/30 bg-amber-500/5' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-display font-semibold text-slate-200">{month.label}</p>
                  {i === 0 && pctChange !== null && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${pctChange >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {pctChange >= 0 ? '▲' : '▼'} {Math.abs(pctChange)}%
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Revenue</p>
                    <p className="font-mono font-bold text-xl text-amber-400">{formatPeso(month.totalSales)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Orders</p>
                    <p className="font-mono font-bold text-xl text-blue-400">{month.orderCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Avg Order</p>
                    <p className="font-mono font-semibold text-slate-300">{formatPeso(month.avgOrder)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Items Sold</p>
                    <p className="font-mono font-semibold text-slate-300">{month.totalItems}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Overlay line chart */}
          {overlayData.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-slate-200 text-sm">Month-over-Month Trend</h3>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded"/>{current?.label}</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-slate-500 inline-block rounded"/>{previous?.label}</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={overlayData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e3347" vertical={false}/>
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} interval={4}/>
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `₱${(v/1000).toFixed(1)}k` : `₱${v}`}/>
                  <Tooltip content={<OverlayTooltip />}/>
                  <Line type="monotone" dataKey="current"  name={current?.label}  stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }}/>
                  <Line type="monotone" dataKey="previous" name={previous?.label} stroke="#3a4058" strokeWidth={1.5} strokeDasharray="4 2" dot={false} activeDot={{ r: 3 }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Day-by-day table for current month */}
          {current && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-700">
                <h3 className="font-display font-semibold text-slate-200 text-sm">{current.label} — Daily Breakdown</h3>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="bg-surface-800 sticky top-0">
                    <tr>
                      {['Day','Revenue','Orders','vs Last Month'].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-700">
                    {current.days.map((day, i) => {
                      const prevDay = previous?.days[i]
                      const diff    = prevDay ? day.totalSales - prevDay.totalSales : null
                      return (
                        <tr key={i} className="hover:bg-surface-700/30">
                          <td className="px-4 py-2.5 text-slate-400">{current.label.split(' ')[0]} {day.day}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold text-amber-400">{day.totalSales > 0 ? formatPeso(day.totalSales) : <span className="text-slate-600">—</span>}</td>
                          <td className="px-4 py-2.5 text-slate-300">{day.orderCount || <span className="text-slate-600">—</span>}</td>
                          <td className="px-4 py-2.5">
                            {diff !== null && prevDay?.totalSales > 0 ? (
                              <span className={`text-xs font-semibold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {diff >= 0 ? '▲' : '▼'} {formatPeso(Math.abs(diff))}
                              </span>
                            ) : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// TAB: INVENTORY (Dead Stock + Profit Margins)
// ────────────────────────────────────────────────────────────────────────────
const InventoryTab = () => {
  const toast = useToast()
  const [subTab,        setSubTab]        = useState('deadstock') // 'deadstock' | 'profit'
  const [deadDays,      setDeadDays]      = useState(30)
  const [deadData,      setDeadData]      = useState(null)
  const [profitPeriod,  setProfitPeriod]  = useState('30days')
  const [profitData,    setProfitData]    = useState(null)
  const [loadingDead,   setLoadingDead]   = useState(false)
  const [loadingProfit, setLoadingProfit] = useState(false)

  const loadDeadStock = useCallback(async () => {
    setLoadingDead(true)
    try {
      const res = await salesApi.getDeadStock(deadDays)
      setDeadData(res)
    } catch { toast('Failed to load dead stock', 'error') }
    finally { setLoadingDead(false) }
  }, [deadDays])

  const loadProfit = useCallback(async () => {
    setLoadingProfit(true)
    try {
      const res = await salesApi.getProfitMargins(profitPeriod)
      setProfitData(res)
    } catch { toast('Failed to load profit data', 'error') }
    finally { setLoadingProfit(false) }
  }, [profitPeriod])

  useEffect(() => { if (subTab === 'deadstock') loadDeadStock() }, [subTab, loadDeadStock])
  useEffect(() => { if (subTab === 'profit') loadProfit() }, [subTab, loadProfit])

  const exportDeadStock  = () => { if (deadData)  printReport(generateDeadStockReport(deadData, deadDays)) }
  const exportProfitRpt  = () => { if (profitData) printReport(generateProfitReport(profitData)) }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex bg-surface-700 rounded-xl p-1 gap-0.5 w-fit">
        {[
          { key: 'deadstock', label: '⚰️ Dead Stock' },
          { key: 'profit',    label: '💰 Profit Margins' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all
              ${subTab === key ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── DEAD STOCK ─────────────────────────────────────────────────────── */}
      {subTab === 'deadstock' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">No sales in last</label>
              <select value={deadDays} onChange={(e) => setDeadDays(Number(e.target.value))}
                className="input py-1.5 px-2 text-xs w-24">
                {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <button onClick={loadDeadStock} disabled={loadingDead} className="btn btn-secondary px-3 py-1.5 text-xs">
              {loadingDead ? 'Loading…' : 'Refresh'}
            </button>
            {deadData && (
              <button onClick={exportDeadStock} className="btn btn-secondary px-3 py-1.5 text-xs">
                📄 Export PDF
              </button>
            )}
          </div>

          {loadingDead ? (
            <div className="h-40 bg-surface-700 animate-pulse rounded-xl"/>
          ) : deadData && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="card p-4 text-center">
                  <p className="text-3xl font-bold text-red-400">{deadData.count}</p>
                  <p className="text-xs text-slate-500 mt-1">Dead Products</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="font-mono font-bold text-xl text-orange-400">{formatPeso(deadData.totalStockValue)}</p>
                  <p className="text-xs text-slate-500 mt-1">Stock Value at Risk</p>
                </div>
                <div className="card p-4 text-center col-span-2 sm:col-span-1">
                  <p className="text-3xl font-bold text-slate-400">{deadDays}</p>
                  <p className="text-xs text-slate-500 mt-1">Days Threshold</p>
                </div>
              </div>

              {deadData.count === 0 ? (
                <div className="card p-10 text-center text-slate-600">
                  <span className="text-4xl block mb-3">🎉</span>
                  <p>No dead stock! All products sold recently.</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
                    <h3 className="font-display font-semibold text-slate-200 text-sm">Dead Stock Items</h3>
                    <p className="text-xs text-slate-500">No sales in {deadDays}+ days</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-800">
                        <tr>
                          {['Product','Category','Stock','Price','Stock Value','Status'].map((h) => (
                            <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-700">
                        {deadData.data.map((p) => (
                          <tr key={p._id} className="hover:bg-surface-700/30">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-200">{p.name}</p>
                              {p.barcode && <p className="font-mono text-xs text-slate-600">{p.barcode}</p>}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs">{p.category}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-slate-200">{p.stock}</td>
                            <td className="px-4 py-3 font-mono text-amber-400">{formatPeso(p.price)}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-orange-400">{formatPeso(p.stockValue)}</td>
                            <td className="px-4 py-3">
                              {p.stock === 0
                                ? <span className="badge bg-red-500/20 text-red-400">Out of stock</span>
                                : p.stock <= 5
                                  ? <span className="badge bg-orange-500/20 text-orange-400">Low stock</span>
                                  : <span className="badge bg-surface-600 text-slate-400">Unsold</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── PROFIT MARGINS ─────────────────────────────────────────────────── */}
      {subTab === 'profit' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-surface-700 rounded-xl p-1 gap-0.5">
              {[{ key: '7days', label: '7 Days' }, { key: '30days', label: '30 Days' }, { key: 'month', label: 'This Month' }].map(({ key, label }) => (
                <button key={key} onClick={() => setProfitPeriod(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${profitPeriod === key ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={loadProfit} disabled={loadingProfit} className="btn btn-secondary px-3 py-1.5 text-xs">
              {loadingProfit ? 'Loading…' : 'Refresh'}
            </button>
            {profitData && (
              <button onClick={exportProfitRpt} className="btn btn-secondary px-3 py-1.5 text-xs">
                📄 Export PDF
              </button>
            )}
          </div>

          {loadingProfit ? (
            <div className="h-40 bg-surface-700 animate-pulse rounded-xl"/>
          ) : profitData && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card p-4">
                  <p className="text-xs text-slate-500">Revenue</p>
                  <p className="font-mono font-bold text-xl text-amber-400">{formatPeso(profitData.summary?.totalRevenue)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-slate-500">Total Cost</p>
                  <p className="font-mono font-bold text-xl text-red-400">{formatPeso(profitData.summary?.totalCost)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-slate-500">Gross Profit</p>
                  <p className={`font-mono font-bold text-xl ${(profitData.summary?.totalGrossProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPeso(profitData.summary?.totalGrossProfit)}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-slate-500">Avg Margin</p>
                  <p className={`font-mono font-bold text-xl ${(profitData.summary?.overallMargin || 0) >= 20 ? 'text-green-400' : 'text-orange-400'}`}>
                    {profitData.summary?.overallMargin != null ? `${profitData.summary.overallMargin}%` : '—'}
                  </p>
                </div>
              </div>

              {/* Missing cost price notice */}
              {(profitData.summary?.productsTotal - profitData.summary?.productsWithCost) > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm">
                  <p className="text-amber-300 font-medium">⚠️ {profitData.summary?.productsTotal - profitData.summary?.productsWithCost} products missing cost price</p>
                  <p className="text-amber-400/70 text-xs mt-0.5">Go to Products → Edit a product → Add "Cost Price" to see full margin data.</p>
                </div>
              )}

              {/* Profit table */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-700">
                  <h3 className="font-display font-semibold text-slate-200 text-sm">Product Margins</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-800">
                      <tr>
                        {['Product','Units','Revenue','Cost/Unit','Gross Profit','Margin'].map((h) => (
                          <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-700">
                      {profitData.data.map((item) => {
                        const marginColor = item.marginPct == null ? 'text-slate-600'
                          : item.marginPct >= 30 ? 'text-green-400'
                          : item.marginPct >= 15 ? 'text-amber-400' : 'text-red-400'
                        return (
                          <tr key={item.productId || item.name} className="hover:bg-surface-700/30">
                            <td className="px-4 py-3 font-medium text-slate-200">{item.name}</td>
                            <td className="px-4 py-3 text-slate-300">{item.unitsSold}</td>
                            <td className="px-4 py-3 font-mono text-amber-400">{formatPeso(item.revenue)}</td>
                            <td className="px-4 py-3 font-mono text-slate-400">
                              {item.hasCostData ? formatPeso(item.costPrice) : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3 font-mono">
                              {item.grossProfit != null
                                ? <span className={item.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{formatPeso(item.grossProfit)}</span>
                                : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {item.marginPct != null
                                ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-12 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${item.marginPct >= 30 ? 'bg-green-500' : item.marginPct >= 15 ? 'bg-amber-500' : 'bg-red-500'}`}
                                           style={{ width: `${Math.min(100, item.marginPct)}%` }}/>
                                    </div>
                                    <span className={`font-mono font-bold text-xs ${marginColor}`}>{item.marginPct}%</span>
                                  </div>
                                ) : <span className="text-slate-600 text-xs">No cost data</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN SALES PAGE
// ────────────────────────────────────────────────────────────────────────────
export default function SalesPage() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [period,    setPeriod]    = useState('7days')

  // Void order (lifted up so Overview can trigger it)
  const [voidTarget,  setVoidTarget]  = useState(null)
  const [voidReason,  setVoidReason]  = useState('')
  const [voidError,   setVoidError]   = useState('')
  const [voidSaving,  setVoidSaving]  = useState(false)

  const handleVoid = async () => {
    if (!voidReason.trim()) return setVoidError('A reason is required')
    setVoidSaving(true); setVoidError('')
    try {
      await orderApi.void(voidTarget._id, { reason: voidReason.trim() })
      toast('Order voided and stock restored', 'success')
      setVoidTarget(null); setVoidReason('')
    } catch (err) { setVoidError(err.message) }
    finally { setVoidSaving(false) }
  }

  // PDF export for daily report
  const [exporting, setExporting] = useState(false)
  const handleExportDaily = async () => {
    setExporting(true)
    try {
      const [todayRes, bestRes, ordersRes] = await Promise.all([
        salesApi.getToday(),
        salesApi.getBestSellers('today', 15),
        orderApi.getAll({ limit: 50 }),
      ])
      const html = generateDailySalesReport(todayRes.data, bestRes.data || [], ordersRes.data || [])
      printReport(html)
    } catch { toast('Export failed', 'error') }
    finally { setExporting(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 md:px-6 py-4 bg-surface-800 border-b border-surface-700 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-semibold text-xl text-slate-100">Sales Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period (only for Overview) */}
            {activeTab === 'overview' && (
              <div className="flex bg-surface-700 rounded-xl p-1 gap-0.5">
                {PERIODS.map((p) => (
                  <button key={p.key} onClick={() => setPeriod(p.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${period === p.key ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            {/* Export Daily PDF */}
            <button onClick={handleExportDaily} disabled={exporting}
              className="btn btn-secondary px-3 py-2 text-xs">
              {exporting ? '⏳' : '📄'} Export Today
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-0.5">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0
                ${activeTab === key ? 'bg-amber-500 text-slate-900' : 'bg-surface-700 text-slate-400 hover:text-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === 'overview'  && <OverviewTab  period={period} onVoid={(order) => { setVoidTarget(order); setVoidReason(''); setVoidError('') }} />}
        {activeTab === 'hourly'    && <HourlyTab    />}
        {activeTab === 'monthly'   && <MonthlyTab   />}
        {activeTab === 'inventory' && <InventoryTab />}
      </div>

      {/* Void Modal */}
      <Modal isOpen={!!voidTarget} onClose={() => { setVoidTarget(null); setVoidError('') }} title="Void Order" size="sm">
        {voidTarget && (
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-3 text-sm">
              <p className="text-red-300 font-semibold">This will:</p>
              <ul className="text-red-400/80 text-xs mt-1 space-y-0.5 list-disc list-inside">
                <li>Mark order #{shortId(voidTarget._id)} as voided</li>
                <li>Restore stock for all items</li>
                <li>Remove from sales totals</li>
              </ul>
            </div>
            {voidError && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{voidError}</p>}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Reason *</label>
              <input type="text" value={voidReason}
                onChange={(e) => { setVoidReason(e.target.value); setVoidError('') }}
                placeholder="e.g. Customer changed mind" className="input px-3 py-2.5" autoFocus maxLength={300}/>
            </div>
            <div className="flex gap-2 flex-wrap">
              {["Customer changed mind","Wrong items","Duplicate order","Test order"].map((r) => (
                <button key={r} onClick={() => setVoidReason(r)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${voidReason === r ? 'bg-red-700 text-white' : 'bg-surface-600 text-slate-300 hover:bg-surface-500'}`}>
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setVoidTarget(null)} className="btn btn-secondary flex-1 py-2.5">Cancel</button>
              <button onClick={handleVoid} disabled={voidSaving} className="btn btn-danger flex-1 py-2.5 font-semibold">
                {voidSaving ? 'Voiding…' : 'Confirm Void'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
