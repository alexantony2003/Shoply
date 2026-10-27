const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    image: { type: String, default: "" },
    color: { type: String, default: "" },
    variant: { type: String, default: "" },
    colorIndex: { type: Number, default: -1 },
    optionIndex: { type: Number, default: -1 },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const orderAddressSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [orderItemSchema], required: true, validate: items => items.length > 0 },
    shippingAddress: { type: orderAddressSchema, required: true },
    paymentMethod: {
        type: String,
        enum: ["Cash on delivery", "Wallet", "Razorpay"],
        default: "Cash on delivery"
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Refunded", "Failed"],
        default: "Pending"
    },
    razorpayOrderId: { type: String, default: null, index: true },
    razorpayPaymentId: { type: String, default: null },
    razorpayRefundId: { type: String, default: null },
    subtotal: { type: Number, required: true, min: 0 },
    couponCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0, min: 0 },
    deliveryCharge: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return requested", "Returned"],
        default: "Pending",
        index: true
    },
    cancelledAt: { type: Date, default: null },
    returnRequestedAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
    walletCredited: { type: Boolean, default: false }
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
