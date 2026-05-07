const mongoose = require("mongoose");

/**
 * HoldOrder — parked cart sessions.
 * Cashier can hold the current cart, serve another customer,
 * then resume the held order without losing items.
 */
const holdOrderSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      maxlength: [60, "Label too long"],
      default: "",
    },
    items: {
      type: [
        {
          _id:      { type: mongoose.Schema.Types.ObjectId, default: null },
          name:     { type: String, required: true },
          price:    { type: Number, required: true },
          quantity: { type: Number, required: true },
          stock:    { type: Number, default: 9999 },
          category: { type: String, default: "" },
          isCustom: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    discountType:  { type: String, enum: ["none", "percent", "amount"], default: "none" },
    discountValue: { type: Number, default: 0 },
    subtotal:      { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
      required: true,
    },
  },
  { timestamps: true }
);

holdOrderSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("HoldOrder", holdOrderSchema);