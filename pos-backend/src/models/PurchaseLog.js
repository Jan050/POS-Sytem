const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    name:      { type: String, required: true },
    qty:       { type: Number, required: true, min: 1 },
    unitCost:  { type: Number, required: true, min: 0 },
    subtotal:  { type: Number, required: true },
  },
  { _id: false }
);

const purchaseLogSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    supplierName: { type: String, default: "" },  // snapshot
    items: {
      type: [purchaseItemSchema],
      required: true,
      validate: { validator: v => v.length > 0, message: "Must have at least one item" },
    },
    totalCost:  { type: Number, required: true },
    notes:      { type: String, trim: true, maxlength: 300, default: "" },
    date:       { type: Date, default: () => new Date() },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Auto-restock: if true, adds qty to product stock on save
    restockProducts: { type: Boolean, default: true },
  },
  { timestamps: true }
);

purchaseLogSchema.index({ date: -1 });
purchaseLogSchema.index({ supplier: 1 });

module.exports = mongoose.model("PurchaseLog", purchaseLogSchema);