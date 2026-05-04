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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getTodaySales, getSalesSummary, getBestSellers, getHourlySales };
