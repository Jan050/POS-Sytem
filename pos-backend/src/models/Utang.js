const mongoose = require("mongoose");

/**
 * Utang — customer credit tracker.
 *
 * Records when a customer takes goods on credit ("utang").
 * Each record stores a snapshot of what was taken and tracks repayment.
 */
const utangItemSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    price:    { type: Number, required: true },
    quantity: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const utangSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      maxlength: [100, "Customer name too long"],
    },
    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: [20, "Phone number too long"],
    },
    // Total amount owed
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than zero"],
    },
    // How much has been paid back so far
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Snapshot of items taken on credit
    items: {
      type: [utangItemSchema],
      default: [],
    },
    // Optional link to a POS order (if utang was created from a sale)
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Remaining balance
utangSchema.virtual("balance").get(function () {
  return Math.max(0, this.amount - this.paidAmount);
});

utangSchema.index({ isPaid: 1, createdAt: -1 });
utangSchema.index({ customerName: "text" });

module.exports = mongoose.model("Utang", utangSchema);
