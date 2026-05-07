// Product.js
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

    // ── Phase 2: Wholesale price ─────────────────────────────────────────────
    // When set, cashier can toggle between retail and wholesale price.
    wholesalePrice: {
      type: Number,
      default: null,
      min: [0, "Wholesale price cannot be negative"],
    },

    wholesaleMinQty: {
      type: Number,
      default: 1,
      min: [1, "Minimum quantity must be at least 1"],
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

    // ── Phase 2: Product Images ─────────────────────────────────────────────
    // URL to product image (external CDN or data URL)
    // Optional field — existing products may not have this value.
    imageUrl: {
      type: String,
      trim: true,
      default: null,
      // validate: basic URL check
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────

// Fast barcode lookups
productSchema.index({ barcode: 1 });

// Text search for product names
productSchema.index({ name: "text" });

// Fast low-stock queries
productSchema.index({ stock: 1, isActive: 1 });

// Note:
// imageUrl does not require an index.
// wholesalePrice / wholesaleMinQty are optional.
// No migration required — existing products will continue working.

module.exports = mongoose.model("Product", productSchema);