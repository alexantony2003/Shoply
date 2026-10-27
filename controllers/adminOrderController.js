const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const User = require("../models/userModel");

const allowedStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return requested", "Returned"];

const getAdminOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user", "name email")
            .sort({ createdAt: -1 });
        return res.render("admin/orders", { orders });
    } catch (error) {
        console.error("Load admin orders error:", error);
        return res.status(500).send("Unable to load orders.");
    }
};

const updateOrderStatus = async (req, res) => {
    const status = String(req.body.status || "");
    if (!allowedStatuses.includes(status)) return res.status(400).send("Choose a valid order status.");
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Order not found.");
    try {
        const order = await Order.findOneAndUpdate(
            { _id: req.params.id, status: { $nin: ["Cancelled", "Returned"] } },
            {
                $set: {
                    status,
                    cancelledAt: status === "Cancelled" ? new Date() : null
                }
            },
            { new: true, runValidators: true }
        );
        if (!order) {
            const existingOrder = await Order.findById(req.params.id);
            if (!existingOrder) return res.status(404).send("Order not found.");
            return res.status(400).send("This order can no longer be changed.");
        }
        if (status === "Cancelled") {
            for (const item of order.items) {
                const stockPath = item.colorIndex >= 0 && item.optionIndex >= 0
                    ? `variants.${item.colorIndex}.options.${item.optionIndex}.stock`
                    : "stock";
                await Product.updateOne(
                    { _id: item.product },
                    { $inc: { [stockPath]: item.quantity, stock: item.quantity } }
                );
            }
        }
        if (status === 'Returned' && order.paymentStatus === 'Paid' && !order.walletCredited) {
            await User.updateOne({ _id: order.user }, { $inc: { walletBalance: order.total } });
            order.walletCredited = true;
            order.paymentStatus = 'Refunded';
            order.returnedAt = new Date();
            await order.save();
        }
        return res.redirect("/admin/orders");
    } catch (error) {
        console.error("Update order status error:", error);
        return res.status(500).send("Unable to update order status.");
    }
};

const getInventory = async (req, res) => {
    try {
        const products = await Product.find().sort({ name: 1 });
        return res.render("admin/inventory", { products });
    } catch (error) {
        console.error("Load inventory error:", error);
        return res.status(500).send("Unable to load inventory.");
    }
};

const updateInventory = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Product not found.");
    const stock = Number(req.body.stock);
    const colorIndex = Number(req.body.colorIndex);
    const optionIndex = Number(req.body.optionIndex);
    if (!Number.isSafeInteger(stock) || stock < 0) {
        return res.status(400).send("Stock must be a non-negative whole number.");
    }
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send("Product not found.");
        if (product.variants.length) {
            const option = product.variants[colorIndex] && product.variants[colorIndex].options[optionIndex];
            if (!option) return res.status(400).send("Choose a valid product option.");
            option.stock = stock;
            product.stock = product.variants.reduce(
                (total, variant) => total + variant.options.reduce((sum, entry) => sum + entry.stock, 0),
                0
            );
        } else {
            product.stock = stock;
        }
        await product.save();
        return res.redirect("/admin/inventory");
    } catch (error) {
        console.error("Update inventory error:", error);
        return res.status(500).send("Unable to update inventory.");
    }
};

module.exports = { getAdminOrders, updateOrderStatus, getInventory, updateInventory };
