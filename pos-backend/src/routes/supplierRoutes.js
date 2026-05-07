const express = require("express");
const router  = express.Router();
const {
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
  getPurchaseLogs, createPurchaseLog,
} = require("../controllers/supplierController");
const { protect, requireAdmin }         = require("../middleware/authMiddleware");
const { writeLimiter }                  = require("../middleware/rateLimiter");

// Suppliers CRUD (admin only)
router.get("/",             protect, requireAdmin, getSuppliers);
router.post("/",            protect, requireAdmin, writeLimiter, createSupplier);
router.put("/:id",          protect, requireAdmin, writeLimiter, updateSupplier);
router.delete("/:id",       protect, requireAdmin, writeLimiter, deleteSupplier);

// Purchase logs
router.get("/purchases",    protect, requireAdmin, getPurchaseLogs);
router.post("/purchases",   protect, requireAdmin, writeLimiter, createPurchaseLog);

module.exports = router;