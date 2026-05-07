const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    // productId is optional for custom items (no DB product backing them)
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: [1, "Quantity must be at least 1"] },
    subtotal: { type: Number, required: true },
    // ── Phase 1: Custom Item support ──────────────────────────────────────
    isCustom: { type: Boolean, default: false },
    // ── Phase 1: Per-item discount ────────────────────────────────────────
    discount: {
      type: { type: String, enum: ["percent", "amount"], default: null },
      value:  { type: Number, default: 0 },
      amount: { type: Number, default: 0 }, // computed peso amount
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    items: {
      type: [orderItemSchema],
      required: true,
      validate: { validator: (v) => v.length > 0, message: "Order must have at least one item" },
    },
    subtotal: { type: Number, required: true }, // sum before order-level discount
    // ── Phase 1: Order-level discount ─────────────────────────────────────
    discount: {
      type:   { type: String, enum: ["percent", "amount"], default: null },
      value:  { type: Number, default: 0 },
      amount: { type: Number, default: 0 }, // computed peso discount
    },
    total: { type: Number, required: true },   // final amount after discount
    cash:   { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["completed", "voided"],
      default: "completed",
    },
    // ── Phase 1: Void order fields ─────────────────────────────────────────
    voidReason: { type: String, default: null },
    voidedAt:   { type: Date,   default: null },
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: { type: String, default: "" },
    idempotencyKey: { type: String, default: null, index: true, sparse: true },
    source: {
      type: String,
      enum: ["online", "offline-sync"],
      default: "online",
    },
    soldAt: { type: Date, default: null },
    
    // ── Phase 2: Split / multi-method payment ─────────────────────────────────
    payments: {
      type: [
    {
      method: {
        type: String,
        enum: ["cash", "gcash", "maya", "card", "other"],
        required: true,
      },
      amount: { type: Number, required: true, min: 0 },
      reference: { type: String, default: "" },  // GCash ref number
    },
  ],
  default: [],
},
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
