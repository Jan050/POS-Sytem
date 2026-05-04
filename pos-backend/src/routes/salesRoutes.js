const express = require("express");
const router  = express.Router();
const { getTodaySales, getSalesSummary, getBestSellers, getHourlySales } = require("../controllers/salesController");
const { protect, requireAdmin } = require("../middleware/authMiddleware");

// Sales reports: admin only
router.get("/today",        protect, requireAdmin, getTodaySales);
router.get("/summary",      protect, requireAdmin, getSalesSummary);
router.get("/best-sellers", protect, requireAdmin, getBestSellers);
router.get("/hourly",       protect, requireAdmin, getHourlySales);

module.exports = router;
