const CashDrawer = require("../models/CashDrawer");
const Order      = require("../models/Order");

// GET /api/cash-drawer/current — get the currently open session
const getCurrent = async (req, res) => {
  try {
    const drawer = await CashDrawer.findOne({ status: "open" })
      .sort({ openedAt: -1 })
      .populate("openedBy", "displayName username")
      .lean();

    if (!drawer)
      return res.status(200).json({ success: true, data: null, message: "No drawer open" });

    res.status(200).json({ success: true, data: drawer });
  } catch {
    res.status(500).json({ success: false, message: "Failed to get drawer status" });
  }
};

// POST /api/cash-drawer/open
const openDrawer = async (req, res) => {
  try {
    // Only one open session at a time
    const existing = await CashDrawer.findOne({ status: "open" });
    if (existing)
      return res.status(400).json({
        success: false,
        message: "A cash drawer session is already open. Close it before opening a new one.",
      });

    const openingCash = parseFloat(req.body.openingCash);
    if (!Number.isFinite(openingCash) || openingCash < 0)
      return res.status(400).json({ success: false, message: "Opening cash must be a non-negative number" });

    const drawer = await CashDrawer.create({
      openingCash,
      openedBy: req.user.id,
      notes: req.body.notes?.trim().slice(0, 300) || "",
    });

    res.status(201).json({ success: true, message: "Cash drawer opened", data: drawer });
  } catch {
    res.status(500).json({ success: false, message: "Failed to open drawer" });
  }
};

// PUT /api/cash-drawer/:id/close
const closeDrawer = async (req, res) => {
  try {
    const drawer = await CashDrawer.findById(req.params.id);
    if (!drawer)
      return res.status(404).json({ success: false, message: "Drawer session not found" });
    if (drawer.status === "closed")
      return res.status(400).json({ success: false, message: "This drawer is already closed" });

    const closingCash = parseFloat(req.body.closingCash);
    if (!Number.isFinite(closingCash) || closingCash < 0)
      return res.status(400).json({ success: false, message: "Closing cash must be a non-negative number" });

    // Tally all completed orders since the drawer opened
    const salesAgg = await Order.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: drawer.openedAt },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          totalCash:  { $sum: "$cash" },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const sales = salesAgg[0] || { totalSales: 0, totalCash: 0, orderCount: 0 };
    const expectedCash  = parseFloat((drawer.openingCash + sales.totalCash).toFixed(2));
    const discrepancy   = parseFloat((closingCash - expectedCash).toFixed(2));

    drawer.closingCash  = closingCash;
    drawer.expectedCash = expectedCash;
    drawer.discrepancy  = discrepancy;
    drawer.totalSales   = parseFloat(sales.totalSales.toFixed(2));
    drawer.orderCount   = sales.orderCount;
    drawer.closedAt     = new Date();
    drawer.closedBy     = req.user.id;
    drawer.status       = "closed";
    drawer.notes        = req.body.notes?.trim().slice(0, 300) || drawer.notes;
    await drawer.save();

    res.status(200).json({ success: true, message: "Cash drawer closed", data: drawer });
  } catch {
    res.status(500).json({ success: false, message: "Failed to close drawer" });
  }
};

// GET /api/cash-drawer — list past sessions
const getHistory = async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const drawers = await CashDrawer.find({ status: "closed" })
      .sort({ closedAt: -1 })
      .limit(limit)
      .populate("openedBy closedBy", "displayName username")
      .lean();

    res.status(200).json({ success: true, count: drawers.length, data: drawers });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load history" });
  }
};

module.exports = { getCurrent, openDrawer, closeDrawer, getHistory };
