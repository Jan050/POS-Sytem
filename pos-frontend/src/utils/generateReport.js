/**
 * generateReport.js
 * Generates and prints a formatted sales/inventory report.
 * Uses browser print-to-PDF — no external library needed.
 */
import { escapeHtml } from './security'

const STORE_NAME = 'TindahanPOS — Sari-Sari Store'

const css = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 15mm 12mm; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    color: #1a1a2e;
    background: #fff;
    line-height: 1.5;
  }
  h1 { font-size: 18pt; font-weight: 700; color: #b45309; margin-bottom: 2mm; }
  h2 { font-size: 12pt; font-weight: 600; color: #1a1a2e; margin: 6mm 0 3mm; border-bottom: 1px solid #ddd; padding-bottom: 2mm; }
  h3 { font-size: 10pt; font-weight: 600; margin: 4mm 0 2mm; }
  .meta { font-size: 9pt; color: #666; margin-bottom: 4mm; }
  .summary-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 5mm;
  }
  .stat-card {
    border: 1px solid #e2e8f0; border-radius: 4px; padding: 3mm 4mm;
    background: #fafafa;
  }
  .stat-label { font-size: 8pt; color: #666; }
  .stat-value { font-size: 13pt; font-weight: 700; color: #b45309; }
  table {
    width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 5mm;
  }
  th {
    background: #1a1a2e; color: #fff; padding: 2mm 3mm;
    text-align: left; font-weight: 600; font-size: 8.5pt;
  }
  td { padding: 2mm 3mm; border-bottom: 1px solid #f0f0f0; }
  tr:nth-child(even) td { background: #fafafa; }
  .right { text-align: right; }
  .center { text-align: center; }
  .green { color: #16a34a; font-weight: 600; }
  .red { color: #dc2626; font-weight: 600; }
  .amber { color: #b45309; font-weight: 600; }
  .tag {
    display: inline-block; padding: 0.5mm 2mm; border-radius: 3px;
    font-size: 7.5pt; font-weight: 600;
  }
  .tag-low { background: #fef3c7; color: #92400e; }
  .tag-ok  { background: #dcfce7; color: #166534; }
  .tag-zero{ background: #fee2e2; color: #991b1b; }
  .footer {
    margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #ddd;
    font-size: 8pt; color: #999; text-align: center;
  }
  @media screen {
    body { padding: 20px; max-width: 900px; margin: 0 auto; background: #f3f4f6; }
    h1, h2, h3 { color: #1a1a2e; }
  }
`

const peso = (n) => n != null ? `₱${Number(n).toFixed(2)}` : '—'
const pct  = (n) => n != null ? `${n}%` : '—'
const esc  = (s) => escapeHtml(String(s || ''))

// ── Helpers ──────────────────────────────────────────────────────────────────

const summaryGrid = (stats) => `
  <div class="summary-grid">
    <div class="stat-card">
      <div class="stat-label">Revenue</div>
      <div class="stat-value">${peso(stats.totalRevenue ?? stats.totalSales)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Orders</div>
      <div class="stat-value">${stats.orderCount ?? '—'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Order</div>
      <div class="stat-value">${peso(stats.avgOrder)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Gross Profit</div>
      <div class="stat-value">${peso(stats.totalGrossProfit)}</div>
    </div>
  </div>
`

// ─────────────────────────────────────────────────────────────────────────────
// REPORT GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

export const generateDailySalesReport = (todayData, bestSellers, ordersData) => {
  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const bestRows = bestSellers.slice(0, 15).map((item, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${esc(item.name)}</td>
      <td class="right">${item.totalQty}</td>
      <td class="right">${item.orderCount}</td>
      <td class="right amber">${peso(item.totalRevenue)}</td>
    </tr>
  `).join('')

  const orderRows = (ordersData || []).slice(0, 30).map((order) => `
    <tr>
      <td class="center" style="font-family:monospace">#${order._id?.slice(-6).toUpperCase()}</td>
      <td>${esc(order.items.map((i) => `${i.name} ×${i.quantity}`).join(', '))}</td>
      <td class="right">${order.items.length}</td>
      <td class="right amber">${peso(order.total)}</td>
      <td class="right">${peso(order.change)}</td>
      <td>${new Date(order.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</td>
    </tr>
  `).join('')

  return buildDocument('Daily Sales Report', today, `
    <h2>Today's Summary</h2>
    ${summaryGrid({ totalRevenue: todayData?.totalSales, orderCount: todayData?.orderCount, avgOrder: todayData?.avgOrder, totalGrossProfit: null })}

    <h2>Top Products Today</h2>
    <table>
      <thead><tr>
        <th class="center">#</th><th>Product</th>
        <th class="right">Units</th><th class="right">Orders</th><th class="right">Revenue</th>
      </tr></thead>
      <tbody>${bestRows || '<tr><td colspan="5" class="center">No sales today</td></tr>'}</tbody>
    </table>

    <h2>Transactions (${(ordersData || []).length})</h2>
    <table>
      <thead><tr>
        <th>Order ID</th><th>Items</th><th class="right">Count</th>
        <th class="right">Total</th><th class="right">Change</th><th>Time</th>
      </tr></thead>
      <tbody>${orderRows || '<tr><td colspan="6" class="center">No transactions</td></tr>'}</tbody>
    </table>
  `)
}

export const generateDeadStockReport = (deadStockData, days) => {
  const rows = (deadStockData.data || []).map((p) => {
    const tag = p.stock === 0 ? '<span class="tag tag-zero">Out</span>'
              : p.stock <= 5  ? '<span class="tag tag-low">Low</span>'
              :                 '<span class="tag tag-ok">OK</span>'
    return `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.category)}</td>
        <td class="right">${p.stock}</td>
        <td class="right amber">${peso(p.price)}</td>
        <td class="right">${peso(p.stockValue)}</td>
        <td class="right">${p.costValue != null ? peso(p.costValue) : '—'}</td>
        <td class="center">${tag}</td>
      </tr>
    `
  }).join('')

  return buildDocument('Dead Stock Report', `Last ${days} days — No sales recorded`, `
    <h2>Summary</h2>
    <div class="summary-grid">
      <div class="stat-card">
        <div class="stat-label">Dead Products</div>
        <div class="stat-value">${deadStockData.count}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Stock Value at Risk</div>
        <div class="stat-value red">${peso(deadStockData.totalStockValue)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Threshold</div>
        <div class="stat-value">${days} days</div>
      </div>
    </div>

    <h2>Dead Stock Items (${deadStockData.count})</h2>
    <p style="font-size:9pt;color:#666;margin-bottom:3mm;">
      These products had zero sales in the last ${days} days. Consider discounting, returning to supplier, or promoting.
    </p>
    <table>
      <thead><tr>
        <th>Product</th><th>Category</th>
        <th class="right">Stock</th><th class="right">Price</th>
        <th class="right">Stock Value</th><th class="right">Cost Value</th><th class="center">Status</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="7" class="center">No dead stock 🎉</td></tr>'}</tbody>
    </table>
  `)
}

export const generateProfitReport = (profitData) => {
  const rows = (profitData.data || []).map((item) => {
    const marginClass = item.marginPct == null ? '' : item.marginPct >= 30 ? 'green' : item.marginPct >= 15 ? 'amber' : 'red'
    return `
      <tr>
        <td>${esc(item.name)}</td>
        <td class="right">${item.unitsSold}</td>
        <td class="right">${peso(item.avgSalePrice)}</td>
        <td class="right amber">${peso(item.revenue)}</td>
        <td class="right">${item.hasCostData ? peso(item.costPrice) : '—'}</td>
        <td class="right">${item.totalCost != null ? peso(item.totalCost) : '—'}</td>
        <td class="right ${item.grossProfit != null && item.grossProfit < 0 ? 'red' : 'green'}">${item.grossProfit != null ? peso(item.grossProfit) : '—'}</td>
        <td class="right ${marginClass}">${pct(item.marginPct)}</td>
      </tr>
    `
  }).join('')

  const { summary } = profitData
  return buildDocument('Profit Margin Report', profitData.period, `
    <h2>Overall Summary</h2>
    ${summaryGrid({ totalRevenue: summary?.totalRevenue, orderCount: null, avgOrder: null, totalGrossProfit: summary?.totalGrossProfit })}
    <div style="font-size:9pt;color:#666;margin-bottom:4mm;">
      ⚠️ ${summary?.productsTotal - summary?.productsWithCost} of ${summary?.productsTotal} products are missing cost price — add cost prices in the Products page for accurate margins.
    </div>

    <h2>Product Breakdown</h2>
    <table>
      <thead><tr>
        <th>Product</th><th class="right">Units</th><th class="right">Avg Price</th>
        <th class="right">Revenue</th><th class="right">Cost/Unit</th>
        <th class="right">Total Cost</th><th class="right">Gross Profit</th><th class="right">Margin</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="8" class="center">No data</td></tr>'}</tbody>
    </table>
  `)
}

// ── Shared document builder ───────────────────────────────────────────────────
const buildDocument = (title, subtitle, body) => `
<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"/>
  <title>${esc(title)}</title>
  <style>${css}</style>
</head><body>
  <h1>${esc(title)}</h1>
  <div class="meta">
    <strong>${esc(STORE_NAME)}</strong> &nbsp;·&nbsp;
    Generated: ${new Date().toLocaleString('en-PH')} &nbsp;·&nbsp;
    ${esc(subtitle)}
  </div>
  ${body}
  <div class="footer">TindahanPOS — Sari-Sari Store POS System</div>
</body></html>
`

// ── Print helper ──────────────────────────────────────────────────────────────
export const printReport = (html) => {
  const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
  if (!win) { alert('Pop-up blocked — please allow pop-ups for reports.'); return }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    setTimeout(() => {
      win.print()
      setTimeout(() => win.close(), 2500)
    }, 400)
  }
  return win
}
