const Order = require("../models/Order");
const Product = require("../models/Product");

/**
 * Strictly validates cash value.
 * Rejects: null, undefined, "", NaN, Infinity, negative.
 */
const validateCash = (rawCash) => {
  if (rawCash === null || rawCash === undefined || rawCash === "") {
    return { valid: false, value: null, reason: "Cash received is required" };
  }
  const parsed = Number(rawCash);
  if (!Number.isFinite(parsed)) {
    return { valid: false, value: null, reason: `Invalid cash value: "${rawCash}" is not a valid number` };
  }
  if (parsed < 0) {
    return { valid: false, value: null, reason: "Cash received cannot be negative" };
  }
  return { valid: true, value: parsed, reason: null };
};

const validateOrderItem = (item, index) => {
  if (!item || typeof item !== "object") return `Item at index ${index} is malformed`;
  if (!item.productId || typeof item.productId !== "string") return `Item ${index + 1}: missing productId`;
  if (item.quantity === undefined || item.quantity === null) return `Item ${index + 1}: missing quantity`;
  if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) return `Item ${index + 1}: quantity must be a positive integer`;
  if (item.price !== undefined) {
    const p = Number(item.price);
    if (!Number.isFinite(p) || p < 0) return `Item ${index + 1}: price override must be a non-negative number`;
  }
  return null;
};

// POST /api/orders
const createOrder = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ success: false, message: "Request body is missing or invalid" });
    }

    const { items, cash, note, idempotencyKey, source, soldAt } = req.body;

    // ── Idempotency: if this key already exists, return the existing order ──
    // This makes retries from offline sync safe — no duplicate orders.
    if (idempotencyKey && typeof idempotencyKey === "string") {
      const existing = await Order.findOne({ idempotencyKey }).lean();
      if (existing) {
        return res.status(200).json({
          success: true,
          message: "Order already exists (idempotent)",
          data: existing,
          duplicate: true,
        });
      }
    }

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order must contain at least one item" });
    }
    if (items.length > 100) {
      return res.status(400).json({ success: false, message: "Order cannot exceed 100 line items" });
    }
    for (let i = 0; i < items.length; i++) {
      const err = validateOrderItem(items[i], i);
      if (err) return res.status(400).json({ success: false, message: err });
    }

    // Validate cash BEFORE any DB work
    const cashValidation = validateCash(cash);
    if (!cashValidation.valid) {
      return res.status(400).json({ success: false, message: cashValidation.reason, field: "cash" });
    }
    const cashGiven = cashValidation.value;

    // Build order items & calculate total
    const orderItems = [];
    let total = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const product = await Product.findById(item.productId).select("name price stock isActive");

      if (!product || !product.isActive) {
        return res.status(404).json({ success: false, message: `Product not found: "${item.productId}"` });
      }
      const requestedQty = Number(item.quantity);
      if (product.stock < requestedQty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${requestedQty}`,
          productId: product._id,
        });
      }

      let finalPrice = product.price;
      if (item.price !== undefined) {
        const override = Number(item.price);
        if (!Number.isFinite(override) || override < 0) {
          return res.status(400).json({ success: false, message: `Invalid price override for "${product.name}"` });
        }
        finalPrice = override;
      }

      const subtotal = parseFloat((finalPrice * requestedQty).toFixed(2));
      total += subtotal;
      orderItems.push({ productId: product._id, name: product.name, price: finalPrice, quantity: requestedQty, subtotal });
    }

    total = parseFloat(total.toFixed(2));

    // Final cash sufficiency check after real total is known
    if (cashGiven < total) {
      return res.status(400).json({
        success: false,
        message: `Insufficient cash. Total is ₱${total.toFixed(2)} but ₱${cashGiven.toFixed(2)} was received`,
        field: "cash",
        required: total,
        received: cashGiven,
      });
    }

    const change = parseFloat((cashGiven - total).toFixed(2));

    const order = await Order.create({
      items: orderItems,
      total,
      cash: cashGiven,
      change,
      note: typeof note === "string" ? note.trim().slice(0, 200) : "",
      idempotencyKey: idempotencyKey || null,
      source: source === "offline-sync" ? "offline-sync" : "online",
      soldAt: soldAt ? new Date(soldAt) : new Date(),
    });

    // Atomically deduct stock
    await Promise.all(
      items.map((item) => Product.findByIdAndUpdate(item.productId, { $inc: { stock: -Number(item.quantity) } }))
    );

    return res.status(201).json({ success: true, message: "Order completed", data: order });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "One or more product IDs are invalid" });
    }
    console.error("[createOrder]", error.message);
    return res.status(500).json({ success: false, message: "Internal server error during checkout" });
  }
};

// GET /api/orders
const getOrders = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ status: "completed" }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments({ status: "completed" }),
    ]);

    res.status(200).json({ success: true, count: orders.length, total, page, pages: Math.ceil(total / limit), data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid order ID" });
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createOrder, getOrders, getOrderById };
