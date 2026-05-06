const mongoose = require("mongoose");

/**
 * CashDrawer — tracks each daily cash drawer session.
 *
 * Flow:
 *  1. Admin opens drawer in the morning (records starting cash)
 *  2. Throughout day: sales happen, cash accumulates
 *  3. End of day: admin counts actual cash, closes drawer
 *  4. System shows: expected vs actual, discrepancy
 *
 * Only ONE drawer session can be "open" at a time.
 */
const cashDrawerSchema = new mongoose.Schema(
  {
    openingCash: {
      type: Number,
      required: [true, "Opening cash amount is required"],
      min: [0, "Opening cash cannot be negative"],
    },
    closingCash: {
      type: Number,
      default: null, // null until drawer is closed
      min: [0, "Closing cash cannot be negative"],
    },
    // Expected cash = openingCash + totalSalesCash (computed on close)
    expectedCash: {
      type: Number,
      default: null,
    },
    // Discrepancy = closingCash - expectedCash (negative = short, positive = over)
    discrepancy: {
      type: Number,
      default: null,
    },
    totalSales: {
      type: Number,
      default: 0, // sum of order totals during this session
    },
    orderCount: {
      type: Number,
      default: 0,
    },
    openedAt: {
      type: Date,
      default: () => new Date(),
    },
    closedAt: {
      type: Date,
      default: null,
    },
    openedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
  },
  { timestamps: true }
);

cashDrawerSchema.index({ status: 1 });
cashDrawerSchema.index({ openedAt: -1 });

module.exports = mongoose.model("CashDrawer", cashDrawerSchema);
