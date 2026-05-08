// productcontrollers.js

const Product = require("../models/Product");

// GET /api/products
const getProducts = async (req, res) => {
  try {
    const { search, category } = req.query;
    const filter = { isActive: true };
Product.create
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { barcode: search },
      ];
    }

    if (category) filter.category = category;

    const products = await Product.find(filter)
      .sort({ name: 1 })
      .select("-__v")
      .lean();

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to load products",
    });
  }
};

// GET /api/products/low-stock
const getLowStock = async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    })
      .sort({ stock: 1 })
      .select("-__v")
      .lean();

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to load low stock products",
    });
  }
};

// POST /api/products/:id/restock
const restockProduct = async (req, res) => {
  try {
    const qty = parseInt(req.body.quantity);

    if (!Number.isInteger(qty) || qty === 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a non-zero integer",
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const newStock = product.stock + qty;

    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot remove ${Math.abs(qty)} — only ${product.stock} in stock`,
      });
    }

    product.stock = newStock;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Stock ${qty > 0 ? "added" : "removed"}: ${product.name} now has ${newStock} units`,
      data: product,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to update stock",
    });
  }
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .select("-__v")
      .lean();

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to load product",
    });
  }
};

// POST /api/products
const createProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      stock,
      barcode,
      category,
      lowStockThreshold,
      imageUrl,

      // ✅ wholesale fields
      wholesalePrice,
      wholesaleMinQty,
    } = req.body;

    if (barcode) {
      const existing = await Product.findOne({
        barcode,
        isActive: true,
      })
        .select("name")
        .lean();

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Barcode already in use",
        });
      }
    }

    const product = await Product.create({
      name: name.trim(),
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      barcode: barcode?.trim() || null,
      category: category || "Uncategorized",
      costPrice: costPrice != null ? parseFloat(costPrice) : null,
      lowStockThreshold:
        parseInt(lowStockThreshold) >= 0
          ? parseInt(lowStockThreshold)
          : 5,  

      imageUrl: imageUrl?.trim() || null,

      // ✅ wholesale fields
      wholesalePrice: wholesalePrice
        ? parseFloat(wholesalePrice)
        : null,

      wholesaleMinQty:
        parseInt(wholesaleMinQty) || 1,
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const msg = Object.values(error.errors)[0].message;

      return res.status(400).json({
        success: false,
        message: msg,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      stock,
      barcode,
      category,
      lowStockThreshold,
      imageUrl,

      // ✅ wholesale fields
      wholesalePrice,
      wholesaleMinQty,
    } = req.body;

    if (barcode) {
      const existing = await Product.findOne({
        barcode,
        isActive: true,
        _id: { $ne: req.params.id },
      })
        .select("_id")
        .lean();

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Barcode already in use",
        });
      }
    }

    const update = {};

    if (name !== undefined) update.name = name.trim();
    if (price !== undefined) update.price = parseFloat(price);
    if (stock !== undefined) update.stock = parseInt(stock);
    if (barcode !== undefined) update.barcode = barcode?.trim() || null;
    if (category !== undefined) update.category = category;
    if (costPrice !== undefined) update.costPrice = costPrice != null ? parseFloat(costPrice) : null;

    if (lowStockThreshold !== undefined) {
      update.lowStockThreshold = parseInt(lowStockThreshold);
    }

    // ✅ image
    if (imageUrl !== undefined) {
      update.imageUrl = imageUrl?.trim() || null;
    }

    // ✅ wholesale
    if (wholesalePrice !== undefined) {
      update.wholesalePrice = wholesalePrice
        ? parseFloat(wholesalePrice)
        : null;
    }

    if (wholesaleMinQty !== undefined) {
      update.wholesaleMinQty =
        parseInt(wholesaleMinQty) || 1;
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      update,
      {
        new: true,
        runValidators: true,
      }
    ).select("-__v");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const msg = Object.values(error.errors)[0].message;

      return res.status(400).json({
        success: false,
        message: msg,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select("name");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted",
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};

module.exports = {
  getProducts,
  getLowStock,
  restockProduct,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
