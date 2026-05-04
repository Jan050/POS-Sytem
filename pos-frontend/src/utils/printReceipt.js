/**
 * printReceipt.js
 * Opens a print-ready receipt in a new window.
 * Works with 58mm and 80mm thermal printers via browser print dialog.
 * Falls back gracefully to any printer / PDF save.
 *
 * SECURITY: All user-supplied strings (product names, notes) are HTML-escaped
 * before being injected into the document.write template.
 * PROTECTS AGAINST: Stored XSS via product names containing <script> tags.
 */

import { escapeHtml } from './security'

const STORE_CONFIG = {
  name: 'TindahanPOS',
  subtitle: 'Sari-Sari Store',
  address: '', // e.g. "123 Mayon St., Davao City"
  phone: '',   // e.g. "0917-123-4567"
  footer: 'Salamat sa inyong pagbili!',
  footer2: 'Please come again 😊',
  width: '80mm', // '58mm' or '80mm'
}

/**
 * Format a number as ₱XX.XX with right-aligned padding
 * @param {number} amount
 * @param {number} totalWidth - total character width for the amount string
 */
const peso = (amount, totalWidth = 8) => {
  const str = `P${amount.toFixed(2)}`
  return str.padStart(totalWidth)
}

/**
 * Generate the receipt HTML string
 * @param {object} order - order object from backend
 * @param {object} config - optional store config overrides
 */
export const generateReceiptHTML = (order, config = {}) => {
  const store = { ...STORE_CONFIG, ...config }
  const date = new Date(order.createdAt || Date.now())
  const dateStr = date.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const orderId = order._id?.slice(-8).toUpperCase() || 'N/A'

  // Determine column widths based on paper size
  const is58mm = store.width === '58mm'
  const lineWidth = is58mm ? 32 : 42 // chars per line
  const divider = '-'.repeat(lineWidth)
  const dblDivider = '='.repeat(lineWidth)

  // Build item lines
  const itemLines = (order.items || []).map((item) => {
    const qtyPrice = `${item.quantity} x P${item.price.toFixed(2)}`
    const subtotal = `P${item.subtotal.toFixed(2)}`
    const nameMaxLen = lineWidth - subtotal.length - 1
    // SECURITY: escape HTML in product name before injecting into document.write
    const safeName = escapeHtml(
      item.name.length > nameMaxLen
        ? item.name.slice(0, nameMaxLen - 1) + '…'
        : item.name
    )

    // Line 1: product name right-aligned to subtotal
    const line1 = safeName.padEnd(lineWidth - subtotal.length) + subtotal
    // Line 2: qty x price indented
    const line2 = `  ${qtyPrice}`
    return `<div class="item-line">${line1}</div><div class="item-detail">${line2}</div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt #${orderId}</title>
  <style>
    /* ── Base ── */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    @page {
      size: ${store.width} auto;
      margin: 2mm 1mm;
    }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${is58mm ? '9pt' : '10pt'};
      width: ${is58mm ? '54mm' : '76mm'};
      color: #000;
      background: #fff;
      line-height: 1.4;
      padding: 2mm 1mm;
    }

    /* ── Header ── */
    .store-name {
      font-size: ${is58mm ? '14pt' : '16pt'};
      font-weight: bold;
      text-align: center;
      letter-spacing: 1px;
      margin-bottom: 1mm;
    }
    .store-sub {
      text-align: center;
      font-size: ${is58mm ? '8pt' : '9pt'};
      margin-bottom: 0.5mm;
    }
    .store-contact {
      text-align: center;
      font-size: 8pt;
    }

    /* ── Dividers ── */
    .divider { white-space: pre; margin: 1.5mm 0; }

    /* ── Meta (order #, date) ── */
    .meta { font-size: ${is58mm ? '8pt' : '9pt'}; margin: 1mm 0; }
    .meta-row { display: flex; justify-content: space-between; }

    /* ── Items ── */
    .items { margin: 1mm 0; }
    .item-line { white-space: pre; font-size: ${is58mm ? '8.5pt' : '9.5pt'}; }
    .item-detail { white-space: pre; font-size: ${is58mm ? '7.5pt' : '8.5pt'}; color: #444; margin-bottom: 0.5mm; }

    /* ── Totals ── */
    .totals { margin: 1mm 0; }
    .total-row { display: flex; justify-content: space-between; font-size: ${is58mm ? '9pt' : '10pt'}; margin: 0.5mm 0; }
    .total-row.grand {
      font-size: ${is58mm ? '11pt' : '13pt'};
      font-weight: bold;
      margin: 1mm 0;
    }
    .total-row.change { font-weight: bold; }

    /* ── Footer ── */
    .footer {
      text-align: center;
      font-size: ${is58mm ? '8pt' : '9pt'};
      margin-top: 2mm;
      line-height: 1.6;
    }

    /* ── Print-only: hide everything else ── */
    @media screen {
      body {
        background: #f3f3f3;
        padding: 20px;
        max-width: 400px;
        margin: 0 auto;
        box-shadow: 0 2px 16px rgba(0,0,0,0.1);
      }
    }
  </style>
</head>
<body>
  <div class="store-name">${store.name}</div>
  <div class="store-sub">${store.subtitle}</div>
  ${store.address ? `<div class="store-contact">${store.address}</div>` : ''}
  ${store.phone ? `<div class="store-contact">Tel: ${store.phone}</div>` : ''}

  <div class="divider">${divider}</div>

  <div class="meta">
    <div class="meta-row"><span>Order #</span><span>${orderId}</span></div>
    <div class="meta-row"><span>Date</span><span>${dateStr}</span></div>
    <div class="meta-row"><span>Time</span><span>${timeStr}</span></div>
  </div>

  <div class="divider">${divider}</div>

  <div class="items">${itemLines}</div>

  <div class="divider">${divider}</div>

  <div class="totals">
    <div class="total-row"><span>Items</span><span>${order.items?.reduce((s, i) => s + i.quantity, 0) || 0}</span></div>
    <div class="total-row grand"><span>TOTAL</span><span>P${order.total?.toFixed(2) || '0.00'}</span></div>
    ${order.cash > 0 ? `
    <div class="total-row"><span>Cash</span><span>P${order.cash.toFixed(2)}</span></div>
    <div class="total-row change"><span>Change</span><span>P${order.change.toFixed(2)}</span></div>
    ` : ''}
  </div>

  <div class="divider">${dblDivider}</div>

  <div class="footer">
    <div>${store.footer}</div>
    <div>${store.footer2}</div>
    <br/>
    <div style="font-size:7pt;color:#666;">Powered by TindahanPOS</div>
  </div>
</body>
</html>`
}

/**
 * Opens a new window with the receipt and triggers print.
 * @param {object} order - completed order object from backend
 * @param {object} options
 * @param {boolean} options.autoPrint - auto-trigger window.print() (default: true)
 * @param {'58mm'|'80mm'} options.paperWidth - thermal paper size (default: '80mm')
 * @param {object} options.storeConfig - override store details
 */
export const printReceipt = (order, options = {}) => {
  const { autoPrint = true, paperWidth = '80mm', storeConfig = {} } = options

  if (!order) {
    console.error('[printReceipt] No order provided')
    return
  }

  const html = generateReceiptHTML(order, { ...STORE_CONFIG, width: paperWidth, ...storeConfig })

  const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes')
  if (!printWindow) {
    alert('Pop-up blocked. Please allow pop-ups for receipt printing.')
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()

  if (autoPrint) {
    // Wait for fonts/styles to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        // Close window after print dialog (delay allows cancel without blank window)
        setTimeout(() => printWindow.close(), 2000)
      }, 300)
    }
  }

  return printWindow
}

/**
 * Print to a specific paper size
 */
export const printReceipt58mm = (order, options = {}) =>
  printReceipt(order, { ...options, paperWidth: '58mm' })

export const printReceipt80mm = (order, options = {}) =>
  printReceipt(order, { ...options, paperWidth: '80mm' })

export default printReceipt
