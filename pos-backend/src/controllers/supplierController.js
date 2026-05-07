const Supplier    = require("../models/Supplier");
const PurchaseLog = require("../models/PurchaseLog");
const Product     = require("../models/Product");

// ── SUPPLIERS ─────────────────────────────────────────────────────────────

const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ isActive: true })
      .sort({ name: 1 }).lean();
    res.status(200).json({ success: true, data: suppliers });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load suppliers" });
  }
};

const createSupplier = async (req, res) => {
  try {
    const { name, contact, address, notes } = req.body;
    if (!name?.trim())
      return res.status(400).json({ success: false, message: "Supplier name is required" });

    const supplier = await Supplier.create({
      name: name.trim(),
      contact: contact?.trim() || "",
      address: address?.trim() || "",
      notes:   notes?.trim().slice(0, 300) || "",
    });
    res.status(201).json({ success: true, data: supplier });
  } catch {
    res.status(500).json({ success: false, message: "Failed to create supplier" });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { name, contact, address, notes } = req.body;
    const update = {};
    if (name    !== undefined) update.name    = name.trim();
    if (contact !== undefined) update.contact = contact.trim();
    if (address !== undefined) update.address = address.trim();
    if (notes   !== undefined) update.notes   = notes.trim().slice(0, 300);

    const supplier = await Supplier.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!supplier)
      return res.status(404).json({ success: false, message: "Supplier not found" });
    res.status(200).json({ success: true, data: supplier });
  } catch {
    res.status(500).json({ success: false, message: "Failed to update supplier" });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    await Supplier.findByIdAndUpdate(req.params.id, { isActive: false });
    res.status(200).json({ success: true, message: "Supplier removed" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to delete supplier" });
  }
};

// ── PURCHASE LOGS ──────────────────────────────────────────────────────────

const getPurchaseLogs = async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const logs  = await PurchaseLog.find()
      .sort({ date: -1 })
      .limit(limit)
      .populate("supplier", "name")
      .populate("recordedBy", "displayName username")
      .lean();
    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load purchase logs" });
  }
};

const createPurchaseLog = async (req, res) => {
  try {
    const { supplierId, items, notes, date, restockProducts = true } = req.body;

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ success: false, message: "Must have at least one item" });

    let supplierName = "";
    if (supplierId) {
      const s = await Supplier.findById(supplierId).select("name").lean();
      if (s) supplierName = s.name;
    }

    // Build items + total
    const parsedItems = [];
    let totalCost = 0;
    for (const item of items) {
      const qty      = parseInt(item.qty);
      const unitCost = parseFloat(item.unitCost);
      if (!item.name?.trim() || !Number.isInteger(qty) || qty < 1 || !Number.isFinite(unitCost) || unitCost < 0)
        return res.status(400).json({ success: false, message: `Invalid item: ${item.name}` });

      const subtotal = parseFloat((qty * unitCost).toFixed(2));
      totalCost += subtotal;
      parsedItems.push({
        product:  item.productId || null,
        name:     item.name.trim(),
        qty,
        unitCost,
        subtotal,
      });
    }

    const log = await PurchaseLog.create({
      supplier:     supplierId || null,
      supplierName,
      items:        parsedItems,
      totalCost:    parseFloat(totalCost.toFixed(2)),
      notes:        notes?.trim().slice(0, 300) || "",
      date:         date ? new Date(date) : new Date(),
      recordedBy:   req.user.id,
      restockProducts,
    });

    // Auto-restock product stock
    if (restockProducts) {
      const stockUpdates = parsedItems
        .filter(i => i.product)
        .map(i => Product.findByIdAndUpdate(i.product, { $inc: { stock: i.qty } }));
      await Promise.all(stockUpdates);
    }

    res.status(201).json({ success: true, data: log });
  } catch {
    res.status(500).json({ success: false, message: "Failed to record purchase" });
  }
};

module.exports = {
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
  getPurchaseLogs, createPurchaseLog,
};