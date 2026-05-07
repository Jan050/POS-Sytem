const HoldOrder = require("../models/HoldOrder");

// GET /api/hold-orders — list held orders for this cashier
const getHeldOrders = async (req, res) => {
  try {
    const orders = await HoldOrder.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.status(200).json({ success: true, data: orders });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load held orders" });
  }
};

// POST /api/hold-orders — save current cart
const holdOrder = async (req, res) => {
  try {
    const { label, items, discountType, discountValue, subtotal } = req.body;

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ success: false, message: "Cart is empty" });

    const held = await HoldOrder.create({
      label:         label?.trim().slice(0, 60) || "",
      items,
      discountType:  discountType  || "none",
      discountValue: discountValue || 0,
      subtotal:      subtotal      || 0,
      createdBy:     req.user.id,
    });

    res.status(201).json({ success: true, data: held });
  } catch {
    res.status(500).json({ success: false, message: "Failed to hold order" });
  }
};

// DELETE /api/hold-orders/:id — remove held order (after resume or manual delete)
const deleteHeldOrder = async (req, res) => {
  try {
    const order = await HoldOrder.findOneAndDelete({
      _id:       req.params.id,
      createdBy: req.user.id,
    });
    if (!order)
      return res.status(404).json({ success: false, message: "Held order not found" });
    res.status(200).json({ success: true, message: "Held order removed" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to delete held order" });
  }
};

module.exports = { getHeldOrders, holdOrder, deleteHeldOrder };