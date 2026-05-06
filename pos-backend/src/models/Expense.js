const mongoose = require("mongoose");

const EXPENSE_CATEGORIES = [
  "Supplies",    // bags, tape, pens
  "Utilities",   // electricity, water, internet
  "Restock",     // buying inventory
  "Transport",   // delivery, tricycle
  "Food",        // food for owner/staff
  "Salary",      // staff pay
  "Rent",        // store rent
  "Other",
];

const expenseSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than zero"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: EXPENSE_CATEGORIES,
      default: "Other",
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
      default: "",
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The actual date of the expense (not necessarily when it was recorded)
    date: {
      type: Date,
      default: () => new Date(),
    },
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });

module.exports = mongoose.model("Expense", expenseSchema);
module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
