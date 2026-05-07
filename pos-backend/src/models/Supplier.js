const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
      maxlength: 100,
    },
    contact: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    notes:   { type: String, trim: true, maxlength: 300, default: "" },
    isActive:{ type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Supplier", supplierSchema);