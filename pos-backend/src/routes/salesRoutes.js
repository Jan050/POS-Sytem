const express = require("express");
const router  = express.Router();
const {
  getTodaySales,
  getSalesSummary,
  getBestSellers,
  getHourlySales,
  getMonthlyComparison,
  getDeadStock,
  getProfitMargins,
} = require("../controllers/salesController");
const { protect, requireAdmin } = require("../middleware/authMiddleware");

router.get("/today",           protect, requireAdmin, getTodaySales);
router.get("/summary",         protect, requireAdmin, getSalesSummary);
router.get("/best-sellers",    protect, requireAdmin, getBestSellers);
router.get("/hourly",          protect, requireAdmin, getHourlySales);
router.get("/monthly",         protect, requireAdmin, getMonthlyComparison); // Phase 3
router.get("/dead-stock",      protect, requireAdmin, getDeadStock);         // Phase 3
router.get("/profit-margins",  protect, requireAdmin, getProfitMargins);     // Phase 3

module.exports = router;
