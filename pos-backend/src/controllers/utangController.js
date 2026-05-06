const Utang = require("../models/Utang");

// GET /api/utang
const getUtang = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status === "paid")   filter.isPaid = true;
    if (status === "unpaid") filter.isPaid = false;

    if (search?.trim()) {
      filter.customerName = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    const records = await Utang.find(filter)
      .sort({ isPaid: 1, createdAt: -1 }) // unpaid first
      .populate("createdBy", "displayName username")
      .lean();

    // Compute balance virtual since .lean() skips virtuals
    const data = records.map((r) => ({
      ...r,
      balance: Math.max(0, r.amount - r.paidAmount),
    }));

    // Summary stats
    const totalUnpaid = data
      .filter((r) => !r.isPaid)
      .reduce((s, r) => s + r.balance, 0);

    res.status(200).json({
      success: true,
      count: data.length,
      totalUnpaid: parseFloat(totalUnpaid.toFixed(2)),
      data,
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load utang records" });
  }
};

// POST /api/utang — create a new utang record
const createUtang = async (req, res) => {
  try {
    const { customerName, phone, amount, items, note, dueDate } = req.body;

    if (!customerName?.trim())
      return res.status(400).json({ success: false, message: "Customer name is required" });

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
      return res.status(400).json({ success: false, message: "Amount must be a positive number" });

    const utang = await Utang.create({
      customerName: customerName.trim(),
      phone:        phone?.trim() || "",
      amount:       parsedAmount,
      paidAmount:   0,
      items:        items || [],
      note:         note?.trim().slice(0, 300) || "",
      dueDate:      dueDate ? new Date(dueDate) : null,
      createdBy:    req.user.id,
    });

    res.status(201).json({ success: true, data: { ...utang.toObject(), balance: utang.amount } });
  } catch {
    res.status(500).json({ success: false, message: "Failed to create utang record" });
  }
};

// PUT /api/utang/:id/pay — record a payment (partial or full)
const recordPayment = async (req, res) => {
  try {
    const { payment } = req.body;
    const parsedPayment = parseFloat(payment);

    if (!Number.isFinite(parsedPayment) || parsedPayment <= 0)
      return res.status(400).json({ success: false, message: "Payment must be a positive number" });

    const utang = await Utang.findById(req.params.id);
    if (!utang)  return res.status(404).json({ success: false, message: "Record not found" });
    if (utang.isPaid) return res.status(400).json({ success: false, message: "This debt is already fully paid" });

    const remaining = utang.amount - utang.paidAmount;
    const applied   = Math.min(parsedPayment, remaining);

    utang.paidAmount += applied;

    if (utang.paidAmount >= utang.amount) {
      utang.isPaid  = true;
      utang.paidAt  = new Date();
    }

    await utang.save();

    res.status(200).json({
      success: true,
      message: utang.isPaid ? "Debt fully paid!" : `Payment of ₱${applied.toFixed(2)} recorded`,
      data: { ...utang.toObject(), balance: Math.max(0, utang.amount - utang.paidAmount) },
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to record payment" });
  }
};

// DELETE /api/utang/:id
const deleteUtang = async (req, res) => {
  try {
    const utang = await Utang.findByIdAndDelete(req.params.id);
    if (!utang) return res.status(404).json({ success: false, message: "Record not found" });
    res.status(200).json({ success: true, message: "Record deleted" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to delete record" });
  }
};

module.exports = { getUtang, createUtang, recordPayment, deleteUtang };
