const mongoose = require("mongoose");

// Each item inside an order (line item)
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true, // Snapshot of product name at time of sale
    },
    price: {
      type: Number,
      required: true, // Snapshot of price at time of sale (supports price override)
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    subtotal: {
      type: Number,
      required: true, // price * quantity
    },
  },
  { _id: false } // No separate _id for sub-documents
);

const orderSchema = new mongoose.Schema(
  {
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (v) => v.length > 0,
        message: "Order must have at least one item",
      },
    },
    total: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
    },
    cash: {
      type: Number,
      default: 0, // Amount of cash given by customer
    },
    change: {
      type: Number,
      default: 0, // Change returned to customer
    },
    status: {
      type: String,
      enum: ["completed", "voided"],
      default: "completed",
    },
    note: {
      type: String,
      default: "", // Optional cashier note
    },
    // ── Offline sync deduplication ───────────────────────────────────────────
    // Frontend generates a UUID before sending. If the same key arrives twice
    // (retry after network hiccup), the backend returns the existing order
    // instead of creating a duplicate.
    idempotencyKey: {
      type: String,
      default: null,
      index: true,        // Fast lookup
      sparse: true,       // Ignore nulls in the unique index
    },
    // Track where the order originated (for audit + sync debugging)
    source: {
      type: String,
      enum: ["online", "offline-sync"],
      default: "online",
    },
    // Timestamp of when the sale actually happened (differs from createdAt when syncing offline orders)
    soldAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt = when record was written to DB
  }
);

module.exports = mongoose.model("Order", orderSchema);
