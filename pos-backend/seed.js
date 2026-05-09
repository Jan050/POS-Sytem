const mongoose = require("mongoose");
const dotenv   = require("dotenv");
const Product  = require("./src/models/Product");
const Order    = require("./src/models/Order");
const User     = require("./src/models/User");

dotenv.config();

const sampleProducts = [
  { name: "Coke 250ml",          price: 20,  stock: 50,  category: "Beverages",    barcode: "4800008309032" },
  { name: "Coke 1.5L",           price: 70,  stock: 20,  category: "Beverages",    barcode: "4800008300039" },
  { name: "Royal 250ml",         price: 18,  stock: 40,  category: "Beverages" },
  { name: "Sprite 250ml",        price: 20,  stock: 35,  category: "Beverages" },
  { name: "Mineral Water 500ml", price: 15,  stock: 60,  category: "Beverages" },
  { name: "C2 Green Tea",        price: 22,  stock: 30,  category: "Beverages" },
  { name: "Nova 22g",            price: 10,  stock: 80,  category: "Snacks" },
  { name: "Piattos 40g",         price: 20,  stock: 50,  category: "Snacks" },
  { name: "Chippy 110g",         price: 30,  stock: 30,  category: "Snacks" },
  { name: "Rebisco Crackers",    price: 12,  stock: 60,  category: "Snacks" },
  { name: "Skyflakes 33g",       price: 8,   stock: 100, category: "Snacks" },
  { name: "Sardines 155g",       price: 25,  stock: 40,  category: "Canned Goods" },
  { name: "Corned Beef 150g",    price: 45,  stock: 25,  category: "Canned Goods" },
  { name: "Spam Lite 340g",      price: 120, stock: 10,  category: "Canned Goods" },
  { name: "Century Tuna 180g",   price: 35,  stock: 30,  category: "Canned Goods" },
  { name: "Lucky Me Pancit",     price: 13,  stock: 100, category: "Noodles" },
  { name: "Lucky Me Chicken",    price: 13,  stock: 80,  category: "Noodles" },
  { name: "Payless Sotanghon",   price: 10,  stock: 60,  category: "Noodles" },
  { name: "Silver Swan Soy Sauce 1L", price: 55, stock: 15, category: "Condiments" },
  { name: "Datu Puti Vinegar 1L",    price: 40, stock: 15, category: "Condiments" },
  { name: "Safeguard Soap 60g",  price: 22, stock: 40, category: "Personal Care" },
  { name: "Palmolive Shampoo 12ml", price: 8, stock: 100, category: "Personal Care" },
  { name: "Colgate 50g",         price: 35, stock: 30, category: "Personal Care" },
  { name: "Marlboro Red (stick)", price: 8,  stock: 200, category: "Cigarettes" },
  { name: "Fortune (stick)",      price: 5,  stock: 200, category: "Cigarettes" },
  { name: "Tasty Bread",         price: 45, stock: 20, category: "Bread" },
  { name: "Pandesal (1 pc)",     price: 3,  stock: 50, category: "Bread" },
  { name: "Bear Brand 33g",      price: 12, stock: 80, category: "Dairy" },
  { name: "Alaska Evap 377ml",   price: 45, stock: 20, category: "Dairy" },
];

const seedDB = async () => {
  try {
    const adminUsername = process.env.SEED_ADMIN_USERNAME?.toLowerCase().trim();
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const skipUsers = String(process.env.SEED_SKIP_USERS || "").toLowerCase() === "true";

    if (!skipUsers && (!adminUsername || !adminPassword || adminPassword.length < 12)) {
      throw new Error("Secure seed admin credentials are required. Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD (min 12 chars), or set SEED_SKIP_USERS=true.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    await Product.deleteMany({});
    await Order.deleteMany({});
    await User.deleteMany({});
    console.log("🗑️  Cleared existing data");

    const products = await Product.insertMany(sampleProducts);
    console.log(`🌱 Seeded ${products.length} products`);

    if (!skipUsers) {
      await User.create({
        username: adminUsername,
        password: adminPassword,
        role: "admin",
        displayName: "Store Admin",
        requirePasswordChange: true,
      });
      console.log(`👤 Created secure admin user: ${adminUsername} (must change password on first login)`);
    } else {
      console.log("👤 Skipped user seeding (SEED_SKIP_USERS=true)");
    }

    // Sample orders
    const p1 = products[0]; const p2 = products[6]; const p3 = products[11];
    await Order.create([
      {
        items: [
          { productId: p1._id, name: p1.name, price: p1.price, quantity: 3, subtotal: 60 },
          { productId: p2._id, name: p2.name, price: p2.price, quantity: 2, subtotal: 20 },
        ],
        total: 80, cash: 100, change: 20,
      },
      {
        items: [{ productId: p3._id, name: p3.name, price: p3.price, quantity: 1, subtotal: 25 }],
        total: 25, cash: 50, change: 25,
      },
    ]);
    console.log("🧾 Created 2 sample orders");
    console.log("\n✅ Seed complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error.message);
    process.exit(1);
  }
};

seedDB();
