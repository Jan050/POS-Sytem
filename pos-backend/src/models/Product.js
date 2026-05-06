const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    stock: {
      type: Number,
      required: [true, "Stock is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    // ── Phase 1: Low Stock Alert threshold ──────────────────────────────────
    // When stock drops to or below this number, the product appears in alerts.
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: [0, "Threshold cannot be negative"],
    },
    barcode: {
      type: String,
      trim: true,
      default: null,
    },
    category: {
      type: String,
      trim: true,
      default: "Uncategorized",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

productSchema.index({ barcode: 1 });
productSchema.index({ name: "text" });
// Index for fast low-stock queries
productSchema.index({ stock: 1, isActive: 1 });

module.exports = mongoose.model("Product", productSchema);
