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
    barcode: {
      type: String,
      trim: true,
      default: null, // Optional — for future barcode scanner support
    },
    category: {
      type: String,
      trim: true,
      default: "Uncategorized", // e.g. "Beverages", "Snacks", "Canned Goods"
    },
    isActive: {
      type: Boolean,
      default: true, // Soft-delete: hide without removing from DB
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Index barcode for fast lookup during scanning
productSchema.index({ barcode: 1 });
productSchema.index({ name: "text" }); // Enables text search on name

module.exports = mongoose.model("Product", productSchema);
