const Order   = require("../models/Order");
const Product = require("../models/Product");

// ── Helpers ────────────────────────────────────────────────────────────────
const validateCash = (rawCash) => {
  if (rawCash === null || rawCash === undefined || rawCash === "")
    return { valid: false, value: null, reason: "Cash received is required" };
  const parsed = Number(rawCash);
  if (!Number.isFinite(parsed))
    return { valid: false, value: null, reason: `Invalid cash value: "${rawCash}"` };
  if (parsed < 0)
    return { valid: false, value: null, reason: "Cash received cannot be negative" };
  return { valid: true, value: parsed, reason: null };
};

// Apply a discount to a number, return { amount, final }
const applyDiscount = (base, discount) => {
  if (!discount || !discount.type || !discount.value) {
    return { amount: 0, final: base };
  }
  let amount = 0;
  if (discount.type === "percent") {
    amount = parseFloat(((discount.value / 100) * base).toFixed(2));
  } else {
    amount = parseFloat(Math.min(discount.value, base).toFixed(2));
  }
  return { amount, final: parseFloat((base - amount).toFixed(2)) };
};

// ── POST /api/orders ────────────────────────────────────────────────────────
const createOrder = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object")
      return res.status(400).json({ success: false, message: "Request body missing" });

    const { items, cash, note, idempotencyKey, source, soldAt, discount } = req.body;

    // Idempotency check
    if (idempotencyKey && typeof idempotencyKey === "string") {
      const existing = await Order.findOne({ idempotencyKey }).lean();
      if (existing)
        return res.status(200).json({ success: true, message: "Order already exists (idempotent)", data: existing, duplicate: true });
    }

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ success: false, message: "Order must have at least one item" });
    if (items.length > 100)
      return res.status(400).json({ success: false, message: "Order cannot exceed 100 items" });

    const cashValidation = validateCash(cash);
    if (!cashValidation.valid)
      return res.status(400).json({ success: false, message: cashValidation.reason, field: "cash" });
    const cashGiven = cashValidation.value;

    // ── Build order items ──────────────────────────────────────────────────
    const orderItems = [];
    let subtotal = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // ── Custom Item: no product lookup, no stock check ─────────────────
      if (item.isCustom) {
        if (!item.name || !item.name.trim())
          return res.status(400).json({ success: false, message: `Custom item ${i + 1}: name is required` });
        const price = Number(item.price);
        if (!Number.isFinite(price) || price < 0)
          return res.status(400).json({ success: false, message: `Custom item ${i + 1}: invalid price` });
        const qty = Number(item.quantity);
        if (!Number.isInteger(qty) || qty < 1)
          return res.status(400).json({ success: false, message: `Custom item ${i + 1}: invalid quantity` });

        const itemSubtotal = parseFloat((price * qty).toFixed(2));
        subtotal += itemSubtotal;
        orderItems.push({
          productId: null,
          name:      item.name.trim(),
          price,
          quantity:  qty,
          subtotal:  itemSubtotal,
          isCustom:  true,
        });
        continue;
      }

      // ── Regular product ────────────────────────────────────────────────
      if (!item.productId)
        return res.status(400).json({ success: false, message: `Item ${i + 1}: productId required for non-custom items` });

      const product = await Product.findById(item.productId).select("name price stock isActive");
      if (!product || !product.isActive)
        return res.status(404).json({ success: false, message: `Product not found: "${item.productId}"` });

      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1)
        return res.status(400).json({ success: false, message: `Item ${i + 1}: quantity must be a positive integer` });
      if (product.stock < qty)
        return res.status(400).json({
          success: false,
          message: `Not enough stock for "${product.name}". Available: ${product.stock}, Requested: ${qty}`,
          productId: product._id,
        });

      let finalPrice = product.price;
      if (item.price !== undefined) {
        const override = Number(item.price);
        if (!Number.isFinite(override) || override < 0)
          return res.status(400).json({ success: false, message: `Invalid price override for "${product.name}"` });
        finalPrice = override;
      }

      const itemSubtotal = parseFloat((finalPrice * qty).toFixed(2));
      subtotal += itemSubtotal;
      orderItems.push({
        productId: product._id,
        name:      product.name,
        price:     finalPrice,
        quantity:  qty,
        subtotal:  itemSubtotal,
        isCustom:  false,
      });
    }

    subtotal = parseFloat(subtotal.toFixed(2));

    // ── Apply order-level discount ─────────────────────────────────────────
    const { amount: discountAmount, final: total } = applyDiscount(subtotal, discount);

    if (cashGiven < total)
      return res.status(400).json({
        success: false,
        message: `Insufficient cash. Total ₱${total.toFixed(2)}, received ₱${cashGiven.toFixed(2)}`,
        field: "cash",
        required: total,
        received: cashGiven,
      });

    const change = parseFloat((cashGiven - total).toFixed(2));

    const order = await Order.create({
      items: orderItems,
      subtotal,
      discount: {
        type:   discount?.type   || null,
        value:  discount?.value  || 0,
        amount: discountAmount,
      },
      total,
      cash:   cashGiven,
      change,
      note:   typeof note === "string" ? note.trim().slice(0, 200) : "",
      idempotencyKey: idempotencyKey || null,
      source: source === "offline-sync" ? "offline-sync" : "online",
      soldAt: soldAt ? new Date(soldAt) : new Date(),
    });

    // Deduct stock only for real products
    const stockUpdates = items
      .filter((item) => !item.isCustom && item.productId)
      .map((item) => Product.findByIdAndUpdate(item.productId, { $inc: { stock: -Number(item.quantity) } }));
    await Promise.all(stockUpdates);

    return res.status(201).json({ success: true, message: "Order completed", data: order });
  } catch (error) {
    if (error.name === "CastError")
      return res.status(400).json({ success: false, message: "One or more product IDs are invalid" });
    console.error("[createOrder]", error.message);
    return res.status(500).json({ success: false, message: "Internal server error during checkout" });
  }
};

// ── PUT /api/orders/:id/void ────────────────────────────────────────────────
const voidOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim())
      return res.status(400).json({ success: false, message: "A reason is required to void an order" });

    const order = await Order.findById(req.params.id);
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });
    if (order.status === "voided")
      return res.status(400).json({ success: false, message: "Order is already voided" });

    // Restore stock for real products only
    const restoreUpdates = order.items
      .filter((item) => !item.isCustom && item.productId)
      .map((item) => Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } }));
    await Promise.all(restoreUpdates);

    order.status     = "voided";
    order.voidReason = reason.trim().slice(0, 300);
    order.voidedAt   = new Date();
    order.voidedBy   = req.user?.id || null;
    await order.save();

    return res.status(200).json({ success: true, message: "Order voided and stock restored", data: order });
  } catch (error) {
    if (error.name === "CastError")
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    console.error("[voidOrder]", error.message);
    return res.status(500).json({ success: false, message: "Failed to void order" });
  }
};

// ── GET /api/orders ─────────────────────────────────────────────────────────
const getOrders = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;
    // Allow fetching voided orders too (for admin review)
    const statusFilter = req.query.status === "voided" ? "voided" : "completed";

    const [orders, total] = await Promise.all([
      Order.find({ status: statusFilter }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments({ status: statusFilter }),
    ]);

    res.status(200).json({ success: true, count: orders.length, total, page, pages: Math.ceil(total / limit), data: orders });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load orders" });
  }
};

// ── GET /api/orders/:id ─────────────────────────────────────────────────────
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid order ID" });
    res.status(500).json({ success: false, message: "Failed to load order" });
  }
};

module.exports = { createOrder, voidOrder, getOrders, getOrderById };
