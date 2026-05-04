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
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { salesApi, orderApi } from '../api'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import { StatCardSkeleton, ChartSkeleton, RowSkeleton, BestSellerSkeleton } from '../components/ui/Skeleton'
import { formatPeso, formatDateTime, shortId } from '../utils/formatters'
import { printReceipt } from '../utils/printReceipt'

const PERIODS = [
  { key: 'today',  label: 'Today'   },
  { key: '7days',  label: '7 Days'  },
  { key: '30days', label: '30 Days' },
]

// ── Custom tooltips ─────────────────────────────────────────────────────────
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

const ProductTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-700 border border-surface-500 rounded-xl px-3 py-2.5 shadow-xl text-xs">
      <p className="font-medium text-slate-200 mb-1">{payload[0]?.payload?.name}</p>
      <p className="font-mono font-bold text-amber-400">{formatPeso(payload[0]?.value || 0)}</p>
      <p className="text-slate-400">{payload[0]?.payload?.totalQty} units sold</p>
    </div>
  )
}

// ── Stat card ───────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color, icon }) => (
  <div className="card p-4">
    <div className={`inline-flex p-2 rounded-lg mb-3 ${color.replace('text-', 'bg-').replace('-400', '-500/10').replace('-300', '-500/10')}`}>
      <span className={color}>{icon}</span>
    </div>
    <p className={`font-mono font-bold text-xl md:text-2xl ${color}`}>{value}</p>
    <p className="text-slate-400 text-xs font-medium mt-1">{label}</p>
    {sub && <p className="text-slate-600 text-xs mt-0.5">{sub}</p>}
  </div>
)

// ── Best seller row ─────────────────────────────────────────────────────────
const BestSellerRow = ({ item, rank, maxRevenue }) => {
  const pct = maxRevenue > 0 ? (item.totalRevenue / maxRevenue) * 100 : 0
  const medal = ['🥇', '🥈', '🥉']
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-700/60 last:border-0">
      <span className="text-base w-6 shrink-0 text-center">{medal[rank] || `${rank + 1}.`}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className="text-sm font-medium text-slate-200 truncate">{item.name}</span>
          <span className="font-mono text-xs text-amber-400 shrink-0">{formatPeso(item.totalRevenue)}</span>
        </div>
        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 delay-100
              ${rank === 0 ? 'bg-amber-500' : rank === 1 ? 'bg-amber-600/70' : 'bg-surface-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-600 mt-1">{item.totalQty} units · {item.orderCount} orders</p>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function SalesPage() {
  const toast = useToast()

  const [period,         setPeriod]         = useState('7days')
  const [todayData,      setTodayData]      = useState(null)
  const [summary,        setSummary]        = useState([])
  const [summaryTotals,  setSummaryTotals]  = useState(null)
  const [bestSellers,    setBestSellers]    = useState([])
  const [orders,         setOrders]         = useState([])
  const [selectedOrder,  setSelectedOrder]  = useState(null)

  // Granular skeleton: each section loads independently
  const [loadingStats,  setLoadingStats]  = useState(true)
  const [loadingChart,  setLoadingChart]  = useState(true)
  const [loadingBest,   setLoadingBest]   = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)

  const fetchTodayStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await salesApi.getToday()
      setTodayData(res.data)
    } catch { toast("Failed to load today's stats", 'error') }
    finally { setLoadingStats(false) }
  }, [])

  const fetchPeriodData = useCallback(async (p) => {
    setLoadingChart(true)
    setLoadingBest(true)
    try {
      const [summaryRes, bestRes] = await Promise.all([
        salesApi.getSummary(p),
        salesApi.getBestSellers(p, 8),
      ])
      setSummary(summaryRes.data || [])
      setSummaryTotals(summaryRes.totals || null)
      setBestSellers(bestRes.data || [])
    } catch { toast('Failed to load chart data', 'error') }
    finally { setLoadingChart(false); setLoadingBest(false) }
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const res = await orderApi.getAll({ limit: 30 })
      setOrders(res.data || [])
    } catch { toast('Failed to load orders', 'error') }
    finally { setLoadingOrders(false) }
  }, [])

  useEffect(() => { fetchTodayStats(); fetchOrders() }, [fetchTodayStats, fetchOrders])
  useEffect(() => { fetchPeriodData(period) }, [period, fetchPeriodData])

  const refreshAll = () => { fetchTodayStats(); fetchPeriodData(period); fetchOrders() }
  const isLoading  = loadingStats || loadingChart || loadingBest || loadingOrders

  // Display stats: period totals when not "today"; today snapshot for today tab
  const displayStats = period === 'today' ? todayData : summaryTotals

  // Format chart X-axis labels
  const chartData = useMemo(() => summary.map((d) => ({
    ...d,
    label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-PH', {
      month: 'short', day: 'numeric',
    }),
  })), [summary])

  const maxRevenue = useMemo(
    () => Math.max(...bestSellers.map((b) => b.totalRevenue), 1),
    [bestSellers]
  )

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
          <div className="flex items-center gap-2">
            {/* Period tabs */}
            <div className="flex bg-surface-700 rounded-xl p-1 gap-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
                    ${period === p.key ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={refreshAll}
              disabled={isLoading}
              className="btn btn-secondary px-3 py-2 text-sm"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loadingStats ? (
            Array(4).fill(0).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                label="Revenue"
                value={formatPeso(displayStats?.totalSales || 0)}
                sub={PERIODS.find((p) => p.key === period)?.label}
                color="text-amber-400"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <StatCard
                label="Transactions"
                value={displayStats?.orderCount ?? 0}
                sub="Completed orders"
                color="text-blue-400"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
              />
              <StatCard
                label="Avg Order"
                value={formatPeso(displayStats?.avgOrder || 0)}
                sub="Per transaction"
                color="text-green-400"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
              />
              <StatCard
                label="Today"
                value={formatPeso(todayData?.totalSales || 0)}
                sub={`${todayData?.orderCount ?? 0} orders today`}
                color="text-purple-400"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
            </>
          )}
        </div>

        {/* Chart + Best Sellers */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

          {/* Sales Trend (3/5 col) */}
          <div className="xl:col-span-3">
            {loadingChart ? <ChartSkeleton height={220} /> : (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-slate-200 text-sm">Sales Trend</h3>
                  <span className="text-xs text-slate-500 bg-surface-700 px-2 py-1 rounded-lg">
                    {PERIODS.find((p) => p.key === period)?.label}
                  </span>
                </div>
                {chartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-600">
                    <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" />
                    </svg>
                    <p className="text-sm">No data for this period</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2e3347" vertical={false} />
                      <XAxis dataKey="label"
                        tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
                        interval="preserveStartEnd" />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `₱${(v/1000).toFixed(1)}k` : `₱${v}`} />
                      <Tooltip content={<SalesTooltip />} />
                      <Area type="monotone" dataKey="totalSales"
                        stroke="#f59e0b" strokeWidth={2.5}
                        fill="url(#salesGrad)"
                        dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }}
                        activeDot={{ r: 5, fill: '#fbbf24' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>

          {/* Best Sellers (2/5 col) */}
          <div className="xl:col-span-2">
            {loadingBest ? (
              <div className="card p-4">
                <div className="h-4 w-28 bg-surface-700 rounded animate-pulse mb-4" />
                {Array(5).fill(0).map((_, i) => <BestSellerSkeleton key={i} />)}
              </div>
            ) : (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-slate-200 text-sm">Best Sellers</h3>
                  <span className="text-xs text-slate-500 bg-surface-700 px-2 py-1 rounded-lg">by revenue</span>
                </div>
                {bestSellers.length === 0 ? (
                  <div className="text-center py-10 text-slate-600 text-sm">No data yet</div>
                ) : bestSellers.map((item, i) => (
                  <BestSellerRow key={item.productId || i} item={item} rank={i} maxRevenue={maxRevenue} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Horizontal bar chart (product revenue) */}
        {!loadingBest && bestSellers.length > 0 && (
          <div className="card p-4">
            <h3 className="font-display font-semibold text-slate-200 text-sm mb-4">Revenue by Product</h3>
            <ResponsiveContainer width="100%" height={Math.max(160, bestSellers.slice(0,8).length * 34)}>
              <BarChart layout="vertical" data={bestSellers.slice(0, 8)}
                margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3347" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `₱${(v/1000).toFixed(1)}k` : `₱${v}`} />
                <YAxis type="category" dataKey="name" width={110}
                  tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v.length > 15 ? v.slice(0, 14) + '…' : v} />
                <Tooltip content={<ProductTooltip />} />
                <Bar dataKey="totalRevenue" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {bestSellers.slice(0,8).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#f59e0b' : i === 1 ? '#d97706' : '#3a4058'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
            <h3 className="font-display font-semibold text-slate-200">Recent Transactions</h3>
            {!loadingOrders && (
              <span className="text-xs text-slate-500 bg-surface-700 px-2 py-1 rounded-lg">{orders.length} orders</span>
            )}
          </div>

          {loadingOrders ? (
            Array(6).fill(0).map((_, i) => <RowSkeleton key={i} />)
          ) : orders.length === 0 ? (
            <div className="text-center py-14 text-slate-600">
              <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">No transactions yet</p>
              <p className="text-xs mt-1">Start selling on the POS screen</p>
            </div>
          ) : orders.map((order) => (
            <button key={order._id} onClick={() => setSelectedOrder(order)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-surface-700 last:border-0 hover:bg-surface-700/40 transition-colors text-left group">
              <span className="font-mono text-xs bg-surface-700 group-hover:bg-surface-600 text-slate-400 px-2 py-1 rounded-lg transition-colors shrink-0">
                #{shortId(order._id)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">
                  {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {formatDateTime(order.createdAt)} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-bold text-amber-400">{formatPeso(order.total)}</p>
                {order.change > 0 && <p className="text-xs text-green-500 mt-0.5">chg ₱{order.change.toFixed(2)}</p>}
              </div>
              <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Order Detail Modal */}
      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)}
        title={`Order #${shortId(selectedOrder?._id)}`} size="sm">
        {selectedOrder && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              {new Date(selectedOrder.createdAt).toLocaleString('en-PH', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
            <div className="bg-surface-900 rounded-xl divide-y divide-surface-700">
              {selectedOrder.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm text-slate-200">{item.name}</p>
                    <p className="text-xs text-slate-500 font-mono">₱{item.price.toFixed(2)} × {item.quantity}</p>
                  </div>
                  <span className="font-mono font-semibold text-slate-200">₱{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="bg-surface-900 rounded-xl p-4 space-y-2">
              <div className="flex justify-between font-bold text-amber-400">
                <span>Total</span><span className="font-mono">{formatPeso(selectedOrder.total)}</span>
              </div>
              {selectedOrder.cash > 0 && (
                <>
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Cash</span><span className="font-mono">₱{selectedOrder.cash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-400">
                    <span>Change</span><span className="font-mono">₱{selectedOrder.change.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => printReceipt(selectedOrder)} className="btn btn-secondary flex-1 py-2.5 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Reprint
              </button>
              <button onClick={() => setSelectedOrder(null)} className="btn btn-secondary flex-1 py-2.5 text-sm">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
