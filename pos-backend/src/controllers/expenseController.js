const Expense = require("../models/Expense");
const { EXPENSE_CATEGORIES } = require("../models/Expense");

// GET /api/expenses
const getExpenses = async (req, res) => {
  try {
    const { period = "today", category } = req.query;

    const now = new Date();
    let start, end;

    switch (period) {
      case "today":
        start = new Date(now); start.setHours(0, 0, 0, 0);
        end   = new Date(now); end.setHours(23, 59, 59, 999);
        break;
      case "7days":
        start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
        end   = new Date(now); end.setHours(23, 59, 59, 999);
        break;
      case "30days":
        start = new Date(now); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0);
        end   = new Date(now); end.setHours(23, 59, 59, 999);
        break;
      default:
        start = new Date(now); start.setHours(0, 0, 0, 0);
        end   = new Date(now); end.setHours(23, 59, 59, 999);
    }

    const filter = { date: { $gte: start, $lte: end } };
    if (category && EXPENSE_CATEGORIES.includes(category)) filter.category = category;

    const [expenses, totalAgg] = await Promise.all([
      Expense.find(filter).sort({ date: -1 }).populate("recordedBy", "displayName username").lean(),
      Expense.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);

    const summary = totalAgg[0] || { total: 0, count: 0 };

    res.status(200).json({
      success: true,
      count: expenses.length,
      totalAmount: parseFloat(summary.total.toFixed(2)),
      data: expenses,
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load expenses" });
  }
};

// POST /api/expenses
const createExpense = async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
      return res.status(400).json({ success: false, message: "Amount must be a positive number" });
    if (!category || !EXPENSE_CATEGORIES.includes(category))
      return res.status(400).json({ success: false, message: `Category must be one of: ${EXPENSE_CATEGORIES.join(", ")}` });

    const expense = await Expense.create({
      amount: parsedAmount,
      category,
      description: description?.trim().slice(0, 200) || "",
      date: date ? new Date(date) : new Date(),
      recordedBy: req.user.id,
    });

    res.status(201).json({ success: true, data: expense });
  } catch {
    res.status(500).json({ success: false, message: "Failed to create expense" });
  }
};

// DELETE /api/expenses/:id
const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });
    res.status(200).json({ success: true, message: "Expense deleted" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to delete expense" });
  }
};

// GET /api/expenses/categories
const getCategories = async (req, res) => {
  res.status(200).json({ success: true, data: EXPENSE_CATEGORIES });
};

module.exports = { getExpenses, createExpense, deleteExpense, getCategories };
