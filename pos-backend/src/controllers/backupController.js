const Product = require('../models/Product')
const Order   = require('../models/Order')
const Expense = require('../models/Expense')
const Utang   = require('../models/Utang')

const exportData = async (req, res) => {
  try {
    const [products, orders, expenses, utang] = await Promise.all([
      Product.find({ isActive: true }).select('-__v').lean(),
      Order.find({}).select('-__v').lean(),
      Expense.find({}).select('-__v').lean(),
      Utang.find({}).select('-__v').lean(),
    ])

    res.status(200).json({
      version:    '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.username || 'admin',
      counts:     { products: products.length, orders: orders.length, expenses: expenses.length, utang: utang.length },
      data:       { products, orders, expenses, utang },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Export failed' })
  }
}

const restoreProducts = async (req, res) => {
  try {
    const { products } = req.body
    if (!Array.isArray(products) || products.length === 0)
      return res.status(400).json({ success: false, message: 'No products in backup' })

    let created = 0, skipped = 0
    for (const p of products) {
      try {
        const exists = await Product.findOne({ name: p.name, isActive: true })
        if (exists) { skipped++; continue }
        await Product.create({
          name:     p.name, price: p.price, stock: p.stock || 0,
          barcode:  p.barcode || null, category: p.category || 'Uncategorized',
          costPrice: p.costPrice || null, lowStockThreshold: p.lowStockThreshold ?? 5,
          wholesalePrice: p.wholesalePrice || null, wholesaleMinQty: p.wholesaleMinQty || 1,
          imageUrl: p.imageUrl || null, isActive: true,
        })
        created++
      } catch { skipped++ }
    }
    res.status(200).json({
      success: true,
      message: `Restored ${created} products, skipped ${skipped} duplicates`,
      created, skipped,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Restore failed' })
  }
}

module.exports = { exportData, restoreProducts }
