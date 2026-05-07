const express  = require("express");
const router   = express.Router();
const {
  getHeldOrders,
  holdOrder,
  resumeHeldOrder,
  deleteHeldOrder,
} = require("../controllers/holdOrderController");
const { protect, requireCashierOrAdmin } = require("../middleware/authMiddleware");
const { writeLimiter } = require("../middleware/rateLimiter");

router.get("/",     protect, requireCashierOrAdmin, getHeldOrders);
router.post("/",    protect, requireCashierOrAdmin, writeLimiter, holdOrder);
router.delete("/:id", protect, requireCashierOrAdmin, writeLimiter, deleteHeldOrder);

module.exports = router;