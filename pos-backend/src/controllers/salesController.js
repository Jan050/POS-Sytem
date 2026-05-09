const Order = require("../models/Order");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Build a { $gte: start, $lte: end } date range for a given period */
const buildDateRange = (period, customStart, customEnd) => {
  const now = new Date();

  if (customStart && customEnd) {
    return { $gte: new Date(customStart), $lte: new Date(customEnd) };
  }

  switch (period) {
    case "today": {
      const s = new Date(now); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      return { $gte: s, $lte: e };
    }
    case "7days": {
      const s = new Date(now); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      return { $gte: s, $lte: e };
    }
    case "30days": {
      const s = new Date(now); s.setDate(s.getDate() - 29); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      return { $gte: s, $lte: e };
    }
    case "month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { $gte: s, $lte: e };
    }
    default: {
      // Default = today
      const s = new Date(now); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      return { $gte: s, $lte: e };
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/today
// ─────────────────────────────────────────────────────────────────────────────
const getTodaySales = async (req, res) => {
  try {
    const dateRange = buildDateRange("today");

    const result = await Order.aggregate([
      { $match: { status: "completed", createdAt: dateRange } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          orderCount: { $sum: 1 },
          totalCash: { $sum: "$cash" },
        },
      },
    ]);

    const summary = result[0] || { totalSales: 0, orderCount: 0, totalCash: 0 };

    res.status(200).json({
      success: true,
      data: {
        date: new Date().toISOString().split("T")[0],
        totalSales: parseFloat(summary.totalSales.toFixed(2)),
        orderCount: summary.orderCount,
        avgOrder: summary.orderCount > 0
          ? parseFloat((summary.totalSales / summary.orderCount).toFixed(2))
          : 0,
      },
    });
  } catch (error) {
    console.error('[sales/getTodaySales] Unexpected error:', error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/summary?period=7days|30days|today|month
// Returns day-by-day breakdown for charting
// ─────────────────────────────────────────────────────────────────────────────
const getSalesSummary = async (req, res) => {
  try {
    const { period = "7days", startDate, endDate } = req.query;
    const dateRange = buildDateRange(period, startDate, endDate);

    const [daily, totals] = await Promise.all([
      // Daily breakdown
      Order.aggregate([
        { $match: { status: "completed", createdAt: dateRange } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            totalSales: { $sum: "$total" },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Overall totals for the period
      Order.aggregate([
        { $match: { status: "completed", createdAt: dateRange } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$total" },
            orderCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const periodTotals = totals[0] || { totalSales: 0, orderCount: 0 };

    res.status(200).json({
      success: true,
      period,
      totals: {
        totalSales: parseFloat(periodTotals.totalSales.toFixed(2)),
        orderCount: periodTotals.orderCount,
        avgOrder: periodTotals.orderCount > 0
          ? parseFloat((periodTotals.totalSales / periodTotals.orderCount).toFixed(2))
          : 0,
      },
      data: daily.map((d) => ({
        date: d._id,
        totalSales: parseFloat(d.totalSales.toFixed(2)),
        orderCount: d.orderCount,
      })),
    });
  } catch (error) {
    console.error('[sales/getSalesSummary] Unexpected error:', error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/best-sellers?period=7days&limit=10
// Top products by revenue and quantity sold
// ─────────────────────────────────────────────────────────────────────────────
const getBestSellers = async (req, res) => {
  try {
    const { period = "7days", limit = 10 } = req.query;
    const dateRange = buildDateRange(period);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));

    const results = await Order.aggregate([
      { $match: { status: "completed", createdAt: dateRange } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          totalQty: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.subtotal" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limitNum },
    ]);

    res.status(200).json({
      success: true,
      period,
      data: results.map((r) => ({
        productId: r._id,
        name: r.name,
        totalQty: r.totalQty,
        totalRevenue: parseFloat(r.totalRevenue.toFixed(2)),
        orderCount: r.orderCount,
      })),
    });
  } catch (error) {
    console.error('[sales/getBestSellers] Unexpected error:', error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/hourly?date=YYYY-MM-DD
// Sales breakdown by hour for a specific day (useful for peak hour analysis)
// ─────────────────────────────────────────────────────────────────────────────
const getHourlySales = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split("T")[0];
    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dayEnd   = new Date(dateStr + "T23:59:59.999Z");

    const results = await Order.aggregate([
      { $match: { status: "completed", createdAt: { $gte: dayStart, $lte: dayEnd } } },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          totalSales: { $sum: "$total" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill all 24 hours (0–23) even if no sales
    const hours = Array.from({ length: 24 }, (_, h) => {
      const found = results.find((r) => r._id === h);
      return {
        hour: h,
        label: `${h.toString().padStart(2, "0")}:00`,
        totalSales: found ? parseFloat(found.totalSales.toFixed(2)) : 0,
        orderCount: found ? found.orderCount : 0,
      };
    });

    res.status(200).json({ success: true, date: dateStr, data: hours });
  } catch (error) {
    console.error('[sales/getHourlySales] Unexpected error:', error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/monthly?months=2
// Current month vs previous month — side-by-side comparison
// ─────────────────────────────────────────────────────────────────────────────
const getMonthlyComparison = async (req, res) => {
  try {
    const now       = new Date();
    const thisYear  = now.getFullYear();
    const thisMonth = now.getMonth();

    // Build ranges for current + previous month
    const ranges = [
      {
        label: new Date(thisYear, thisMonth, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
        start: new Date(thisYear, thisMonth, 1),
        end:   new Date(thisYear, thisMonth + 1, 0, 23, 59, 59, 999),
      },
      {
        label: new Date(thisYear, thisMonth - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
        start: new Date(thisYear, thisMonth - 1, 1),
        end:   new Date(thisYear, thisMonth, 0, 23, 59, 59, 999),
      },
    ];

    const results = await Promise.all(ranges.map(async (range) => {
      const [totalsAgg, dailyAgg] = await Promise.all([
        Order.aggregate([
          { $match: { status: 'completed', createdAt: { $gte: range.start, $lte: range.end } } },
          { $group: {
            _id: null,
            totalSales:  { $sum: '$total' },
            orderCount:  { $sum: 1 },
            totalItems:  { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } },
          }},
        ]),
        Order.aggregate([
          { $match: { status: 'completed', createdAt: { $gte: range.start, $lte: range.end } } },
          { $group: {
            _id: { $dayOfMonth: '$createdAt' },
            totalSales: { $sum: '$total' },
            orderCount: { $sum: 1 },
          }},
          { $sort: { '_id': 1 } },
        ]),
      ]);

      const totals = totalsAgg[0] || { totalSales: 0, orderCount: 0, totalItems: 0 };

      // Fill all days of the month
      const daysInMonth = new Date(range.end).getDate();
      const days = Array.from({ length: daysInMonth }, (_, i) => {
        const found = dailyAgg.find((d) => d._id === i + 1);
        return {
          day: i + 1,
          totalSales: found ? parseFloat(found.totalSales.toFixed(2)) : 0,
          orderCount: found ? found.orderCount : 0,
        };
      });

      return {
        label:      range.label,
        totalSales: parseFloat(totals.totalSales.toFixed(2)),
        orderCount: totals.orderCount,
        avgOrder:   totals.orderCount > 0 ? parseFloat((totals.totalSales / totals.orderCount).toFixed(2)) : 0,
        totalItems: totals.totalItems,
        days,
      };
    }));

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('[sales/getMonthlyComparison] Unexpected error:', error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/dead-stock?days=30
// Products with no recorded sales in the last N days
// ─────────────────────────────────────────────────────────────────────────────
const getDeadStock = async (req, res) => {
  try {
    const Product = require('../models/Product');
    const days    = Math.max(1, parseInt(req.query.days) || 30);
    const cutoff  = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // IDs of products sold in the period
    const activeSales = await Order.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: cutoff } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId' } },
    ]);
    const activeIds = activeSales.map((s) => s._id?.toString()).filter(Boolean);

    // Products NOT in active sales (dead stock)
    const allProducts = await Product.find({ isActive: true }).select('-__v').lean();
    const dead = allProducts
      .filter((p) => !activeIds.includes(p._id.toString()))
      .map((p) => ({
        ...p,
        stockValue: parseFloat((p.stock * p.price).toFixed(2)),
        costValue:  p.costPrice != null ? parseFloat((p.stock * p.costPrice).toFixed(2)) : null,
      }))
      .sort((a, b) => b.stockValue - a.stockValue);

    const totalStockValue = dead.reduce((s, p) => s + p.stockValue, 0);

    res.status(200).json({
      success: true,
      days,
      count:           dead.length,
      totalStockValue: parseFloat(totalStockValue.toFixed(2)),
      data:            dead,
    });
  } catch (error) {
    console.error('[sales/getDeadStock] Unexpected error:', error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/profit-margins?period=30days
// Revenue vs cost per product — shows gross profit and margin %
// ─────────────────────────────────────────────────────────────────────────────
const getProfitMargins = async (req, res) => {
  try {
    const Product = require('../models/Product');
    const { period = '30days' } = req.query;
    const dateRange = buildDateRange(period);

    // Sales aggregation per product
    const salesData = await Order.aggregate([
      { $match: { status: 'completed', createdAt: dateRange } },
      { $unwind: '$items' },
      {
        $group: {
          _id:         '$items.productId',
          name:        { $first: '$items.name' },
          unitsSold:   { $sum: '$items.quantity' },
          revenue:     { $sum: '$items.subtotal' },
          avgSalePrice:{ $avg: '$items.price' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Enrich with product cost data
    const productIds = salesData.map((s) => s._id).filter(Boolean);
    const products   = await Product.find({ _id: { $in: productIds } })
      .select('costPrice price')
      .lean();

    const productMap = {};
    products.forEach((p) => { productMap[p._id.toString()] = p; });

    const enriched = salesData.map((s) => {
      const product    = s._id ? productMap[s._id.toString()] : null;
      const costPrice  = product?.costPrice ?? null;
      const totalCost  = costPrice != null ? parseFloat((s.unitsSold * costPrice).toFixed(2)) : null;
      const grossProfit = totalCost != null ? parseFloat((s.revenue - totalCost).toFixed(2)) : null;
      const marginPct   = totalCost != null && s.revenue > 0
        ? parseFloat(((grossProfit / s.revenue) * 100).toFixed(1))
        : null;

      return {
        productId:    s._id,
        name:         s.name,
        unitsSold:    s.unitsSold,
        revenue:      parseFloat(s.revenue.toFixed(2)),
        avgSalePrice: parseFloat(s.avgSalePrice.toFixed(2)),
        costPrice,
        totalCost,
        grossProfit,
        marginPct,
        hasCostData:  costPrice != null,
      };
    });

    // Summary
    const withCost   = enriched.filter((e) => e.hasCostData);
    const totalRev   = enriched.reduce((s, e) => s + e.revenue, 0);
    const totalCost  = withCost.reduce((s, e) => s + (e.totalCost || 0), 0);
    const totalProfit= withCost.reduce((s, e) => s + (e.grossProfit || 0), 0);

    res.status(200).json({
      success: true,
      period,
      summary: {
        totalRevenue:    parseFloat(totalRev.toFixed(2)),
        totalCost:       parseFloat(totalCost.toFixed(2)),
        totalGrossProfit:parseFloat(totalProfit.toFixed(2)),
        overallMargin:   totalRev > 0 ? parseFloat(((totalProfit / totalRev) * 100).toFixed(1)) : null,
        productsWithCost:withCost.length,
        productsTotal:   enriched.length,
      },
      data: enriched,
    });
  } catch (error) {
    console.error('[sales/getProfitMargins] Unexpected error:', error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

module.exports = {
  getTodaySales,
  getSalesSummary,
  getBestSellers,
  getHourlySales,
  getMonthlyComparison, // ← Phase 3
  getDeadStock,         // ← Phase 3
  getProfitMargins,     // ← Phase 3
};
