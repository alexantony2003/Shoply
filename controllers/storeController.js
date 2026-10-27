const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const User = require("../models/userModel");
const {
    createRazorpayOrder,
    captureRazorpayPayment,
    fetchRazorpayPayment,
    getRazorpayKeyId,
    isRazorpayConfigured,
    refundRazorpayPayment,
    verifyPaymentSignature
} = require("../utils/razorpay");

const MAX_PER_CUSTOMER = 5;
const activeCheckouts = new Set();

const calculateCoupon = (items, code) => {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) return { code: null, discount: 0 };
    let discount = 0;
    for (const item of items) {
        const coupon = item.product && Array.from(item.product.coupons || [])
            .find(entry => entry.active && entry.code === normalizedCode);
        if (!coupon || item.unavailable || item.quantityUnavailable) continue;
        const lineTotal = Number(item.lineTotal || 0);
        discount += coupon.discountType === 'percentage'
            ? lineTotal * (Number(coupon.discountValue) / 100)
            : Math.min(lineTotal, Number(coupon.discountValue));
    }
    return { code: discount > 0 ? normalizedCode : null, discount: Math.round(discount * 100) / 100 };
};

const getDeliveryCharge = address => {
    const freeOver = Number(process.env.FREE_DELIVERY_OVER || 0);
    const fixed = Number(process.env.DELIVERY_CHARGE || 0);
    let stateRates = {};
    try { stateRates = JSON.parse(process.env.DELIVERY_CHARGES_BY_STATE || '{}'); } catch (_) { stateRates = {}; }
    const stateRate = Number(stateRates[String(address && address.state || '').trim().toLowerCase()]);
    return Number.isFinite(stateRate) && stateRate >= 0 ? stateRate : (Number.isFinite(fixed) && fixed >= 0 ? fixed : 0);
};

const pdfText = value => String(value ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const createInvoicePdf = order => {
    const rows = [
        'SHOPLY - TAX INVOICE', `Invoice: ${order.orderNumber}`, `Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`,
        `Customer: ${order.shippingAddress.fullName}`, `Delivery: ${order.shippingAddress.city}, ${order.shippingAddress.state}`,
        '', 'ITEMS'
    ];
    for (const item of order.items) rows.push(`${item.name} x ${item.quantity} - INR ${(item.unitPrice * item.quantity).toFixed(2)}`);
    rows.push('', `Subtotal: INR ${Number(order.subtotal).toFixed(2)}`);
    if (order.discountAmount) rows.push(`Discount (${order.couponCode || 'Offer'}): -INR ${Number(order.discountAmount).toFixed(2)}`);
    if (order.deliveryCharge) rows.push(`Delivery: INR ${Number(order.deliveryCharge).toFixed(2)}`);
    rows.push(`TOTAL: INR ${Number(order.total).toFixed(2)}`, `Payment: ${order.paymentMethod} (${order.paymentStatus})`);
    const content = ['BT', '/F1 18 Tf', '50 790 Td', `(${pdfText(rows[0])}) Tj`, '/F1 10 Tf'];
    let y = 758;
    rows.slice(1, 42).forEach(line => { content.push(`50 ${y} Td (${pdfText(line)}) Tj`); y -= 17; });
    content.push('ET');
    const stream = content.join('\n');
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`
    ];
    let pdf = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'utf8')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
};

const getSessionCart = req => {
    if (!Array.isArray(req.session.cart)) req.session.cart = [];
    return req.session.cart;
};

const getSelection = (product, colorIndex, optionIndex) => {
    if (product.variants && product.variants.length) {
        const color = product.variants[colorIndex];
        const option = color && color.options[optionIndex];
        if (!color || !option) return null;
        return {
            colorIndex,
            optionIndex,
            color: color.color,
            variant: option.label,
            price: Number(option.price),
            stock: Number(option.stock),
            stockPath: `variants.${colorIndex}.options.${optionIndex}.stock`,
            image: color.images && color.images[0] ? color.images[0] : product.image
        };
    }
    if (colorIndex !== -1 || optionIndex !== -1) return null;
    return {
        colorIndex: -1,
        optionIndex: -1,
        color: "",
        variant: "",
        price: Number(product.price),
        stock: Number(product.stock),
        stockPath: "stock",
        image: product.image
    };
};

const getCartItems = async req => {
    const cart = getSessionCart(req);
    const productIds = [...new Set(cart.map(line => line.productId).filter(mongoose.Types.ObjectId.isValid))];
    const products = await Product.find({ _id: { $in: productIds } }).populate("category");
    const byId = new Map(products.map(product => [product._id.toString(), product]));
    const items = [];

    for (const line of cart) {
        const product = byId.get(String(line.productId));
        const selection = product && getSelection(product, line.colorIndex, line.optionIndex);
        if (!product || !selection) {
            items.push({ ...line, product: null, unavailable: true });
            continue;
        }
        items.push({
            ...line,
            product,
            selection,
            unavailable: product.status !== "active" || !product.category ||
                product.category.status === false || selection.stock < 1,
            quantityUnavailable: selection.stock < line.quantity,
            lineTotal: selection.price * line.quantity
        });
    }
    return items;
};

const getCart = async (req, res) => {
    try {
        const items = await getCartItems(req);
        const subtotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
        const coupon = calculateCoupon(items, req.session.couponCode);
        return res.render("cart", { items, subtotal, coupon, total: subtotal - coupon.discount, message: req.query.message || "", user: req.session.user || null });
    } catch (error) {
        console.error("Load cart error:", error);
        return res.status(500).send("Unable to load your cart.");
    }
};

const applyCoupon = async (req, res) => {
    try {
        const coupon = calculateCoupon(await getCartItems(req), req.body.couponCode);
        if (!coupon.code) return res.redirect('/cart?message=invalid-coupon');
        req.session.couponCode = coupon.code;
        return res.redirect('/cart?message=coupon-applied');
    } catch (error) {
        console.error('Apply coupon error:', error);
        return res.status(500).send('Unable to apply this coupon.');
    }
};

const removeCoupon = (req, res) => {
    delete req.session.couponCode;
    return res.redirect('/cart?message=coupon-removed');
};

const addToCart = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).send("Product not found.");
    }
    try {
        const product = await Product.findById(req.params.id).populate("category");
        if (!product || product.status !== "active" || !product.category || product.category.status === false) {
            return res.status(404).send("This product is unavailable.");
        }
        const colorIndex = product.variants.length ? Number(req.body.colorIndex) : -1;
        const optionIndex = product.variants.length ? Number(req.body.optionIndex) : -1;
        const selection = getSelection(product, colorIndex, optionIndex);
        const quantity = Number(req.body.quantity || 1);
        const maxPerCustomer = Number(product.maxPerCustomer) || MAX_PER_CUSTOMER;
        if (!selection || !Number.isSafeInteger(quantity) || quantity < 1) {
            return res.status(400).send("Choose a valid product option and quantity.");
        }
        if (selection.stock < 1) {
            return res.status(409).send("This option is out of stock.");
        }
        const cart = getSessionCart(req);
        const productQuantity = cart
            .filter(line => String(line.productId) === product._id.toString())
            .reduce((sum, line) => sum + line.quantity, 0);
        const existing = cart.find(line => String(line.productId) === product._id.toString() &&
            line.colorIndex === colorIndex && line.optionIndex === optionIndex);
        const selectedQuantity = existing ? existing.quantity : 0;
        if (productQuantity + quantity > maxPerCustomer) {
            return res.status(400).send(`You can add up to ${maxPerCustomer} of this product per order.`);
        }
        if (selectedQuantity + quantity > selection.stock) {
            return res.status(409).send(`Only ${Math.max(0, selection.stock - selectedQuantity)} of this option are currently available.`);
        }
        if (existing) existing.quantity += quantity;
        else cart.push({ productId: product._id.toString(), colorIndex, optionIndex, quantity });
        req.session.cart = cart;
        return res.redirect("/cart?message=added");
    } catch (error) {
        console.error("Add to cart error:", error);
        return res.status(500).send("Unable to add this product to your cart.");
    }
};

const updateCart = async (req, res) => {
    const { productId, colorIndex, optionIndex } = req.body;
    const quantity = Number(req.body.quantity);
    if (!mongoose.Types.ObjectId.isValid(productId) || !Number.isSafeInteger(quantity) || quantity < 1) {
        return res.status(400).send("Enter a valid cart quantity.");
    }
    try {
        const product = await Product.findById(productId);
        const cart = getSessionCart(req);
        const line = cart.find(item => String(item.productId) === productId &&
            item.colorIndex === Number(colorIndex) && item.optionIndex === Number(optionIndex));
        if (!product || !line) return res.status(404).send("Cart item not found.");
        const selection = getSelection(product, line.colorIndex, line.optionIndex);
        const otherQuantity = cart
            .filter(item => String(item.productId) === productId && item !== line)
            .reduce((sum, item) => sum + item.quantity, 0);
        const maximum = Number(product.maxPerCustomer) || MAX_PER_CUSTOMER;
        if (!selection) return res.status(400).send("This product option is no longer available.");
        if (quantity > selection.stock) return res.status(409).send(`Only ${selection.stock} of this option are in stock.`);
        if (quantity + otherQuantity > maximum) {
            return res.status(400).send(`The total quantity of this product cannot exceed ${maximum} per order.`);
        }
        line.quantity = quantity;
        req.session.cart = cart;
        return res.redirect("/cart");
    } catch (error) {
        console.error("Update cart error:", error);
        return res.status(500).send("Unable to update your cart.");
    }
};

const removeFromCart = (req, res) => {
    const { productId, colorIndex, optionIndex } = req.body;
    const cart = getSessionCart(req);
    req.session.cart = cart.filter(line => !(String(line.productId) === String(productId) &&
        line.colorIndex === Number(colorIndex) && line.optionIndex === Number(optionIndex)));
    return res.redirect("/cart");
};

const requireLogin = (req, res) => {
    if (req.session && req.session.user && req.session.user.id) return true;
    res.redirect("/login");
    return false;
};

const getCheckout = async (req, res) => {
    if (!requireLogin(req, res)) return;
    try {
        const [items, user] = await Promise.all([
            getCartItems(req),
            User.findById(req.session.user.id)
        ]);
        if (!items.length) return res.redirect("/cart");
        if (!user) return res.redirect("/login");
        const subtotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
        const coupon = calculateCoupon(items, req.session.couponCode);
        const deliveryCharge = user.addresses.length
            ? getDeliveryCharge(user.addresses.find(address => address.isDefault) || user.addresses[0])
            : 0;
        return res.render("checkout", {
            items,
            subtotal,
            coupon,
            total: subtotal - coupon.discount + deliveryCharge,
            walletBalance: Number(user.walletBalance || 0),
            deliveryCharge,
            addresses: user.addresses,
            razorpayConfigured: isRazorpayConfigured(),
            error: req.query.error || (items.some(item => item.unavailable || item.quantityUnavailable) ? "stock" : "")
        });
    } catch (error) {
        console.error("Load checkout error:", error);
        return res.status(500).send("Unable to load checkout.");
    }
};

const reserveStock = async (productId, selection, quantity) => {
    const result = await Product.updateOne(
        { _id: productId, [selection.stockPath]: { $gte: quantity } },
        { $inc: { [selection.stockPath]: -quantity, stock: -quantity } }
    );
    return result.modifiedCount === 1;
};

const restoreStock = async (productId, selection, quantity) => {
    await Product.updateOne(
        { _id: productId },
        { $inc: { [selection.stockPath]: quantity, stock: quantity } }
    );
};

const placeOrder = async (req, res) => {
    if (!requireLogin(req, res)) return;
    const cart = getSessionCart(req);
    if (!cart.length) return res.redirect("/cart");
    const checkoutKey = req.session.user.id;
    if (activeCheckouts.has(checkoutKey)) {
        return res.status(409).send("An order is already being placed for this account.");
    }
    activeCheckouts.add(checkoutKey);

    const reserved = [];
    const popularityUpdates = [];
    let order;
    let walletDebited = false;
    let walletDebitAmount = 0;
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) return res.redirect("/login");
        const address = user.addresses.id(req.body.addressId);
        if (!address) return res.redirect("/checkout?error=address");
        const paymentMethod = String(req.body.paymentMethod || 'Cash on delivery');
        if (!['Cash on delivery', 'Wallet', 'Razorpay'].includes(paymentMethod)) {
            return res.status(400).send('Choose a valid payment method.');
        }
        if (paymentMethod === 'Razorpay' && !isRazorpayConfigured()) {
            return res.redirect('/checkout?error=razorpay-config');
        }
        const checkoutItems = await getCartItems(req);
        const validatedCoupon = calculateCoupon(checkoutItems, req.session.couponCode);

        const items = [];
        let subtotal = 0;
        const quantitiesByProduct = new Map();
        for (const line of cart) {
            quantitiesByProduct.set(line.productId,
                (quantitiesByProduct.get(line.productId) || 0) + line.quantity);
        }

        for (const line of cart) {
            const product = await Product.findById(line.productId).populate("category");
            const selection = product && getSelection(product, line.colorIndex, line.optionIndex);
            const maximum = product
                ? Number(product.maxPerCustomer) || MAX_PER_CUSTOMER
                : 0;
            if (!product || product.status !== "active" || !product.category ||
                product.category.status === false || !selection ||
                quantitiesByProduct.get(line.productId) > maximum ||
                !(await reserveStock(product._id, selection, line.quantity))) {
                for (const item of reserved) {
                    try {
                        await restoreStock(item.productId, item.selection, item.quantity);
                    } catch (restoreError) {
                        console.error("Stock rollback after unavailable item:", restoreError);
                    }
                }
                return res.redirect("/checkout?error=stock");
            }
            reserved.push({ productId: product._id, selection, quantity: line.quantity });
            const lineTotal = selection.price * line.quantity;
            subtotal += lineTotal;
            items.push({
                product: product._id,
                name: product.name,
                image: selection.image || "",
                color: selection.color,
                variant: selection.variant,
                colorIndex: selection.colorIndex,
                optionIndex: selection.optionIndex,
                unitPrice: selection.price,
                quantity: line.quantity
            });
        }

        const deliveryCharge = getDeliveryCharge(address);
        const total = Math.max(0, subtotal - validatedCoupon.discount) + deliveryCharge;
        if (paymentMethod === 'Cash on delivery' && total > 1000) {
            for (const item of reserved) await restoreStock(item.productId, item.selection, item.quantity);
            return res.redirect('/checkout?error=cod-limit');
        }
        if (paymentMethod === 'Wallet') {
            const debit = await User.findOneAndUpdate(
                { _id: user._id, walletBalance: { $gte: total } },
                { $inc: { walletBalance: -total } },
                { new: true }
            );
            if (!debit) {
                for (const item of reserved) await restoreStock(item.productId, item.selection, item.quantity);
                return res.redirect('/checkout?error=wallet');
            }
            walletDebited = true;
            walletDebitAmount = total;
        }

        order = await Order.create({
            orderNumber: `SHP-${Date.now()}-${crypto.randomInt(1000, 10000)}`,
            user: user._id,
            items,
            shippingAddress: {
                fullName: address.fullName,
                phone: address.phone,
                street: address.street,
                city: address.city,
                state: address.state,
                postalCode: address.postalCode,
                country: address.country
            },
            paymentMethod,
            paymentStatus: paymentMethod === 'Wallet' ? 'Paid' : 'Pending',
            subtotal,
            couponCode: validatedCoupon.code,
            discountAmount: validatedCoupon.discount,
            deliveryCharge,
            total
        });
        if (paymentMethod === 'Razorpay') {
            const razorpayOrder = await createRazorpayOrder(total, order.orderNumber);
            if (!razorpayOrder.id) throw new Error("Razorpay did not return an order ID.");
            order.razorpayOrderId = razorpayOrder.id;
            await order.save();
        }
        for (const item of items) {
            const result = await Product.updateOne(
                { _id: item.product },
                { $inc: { soldCount: item.quantity } }
            );
            if (result.modifiedCount === 1) popularityUpdates.push(item);
        }
        req.session.cart = [];
        delete req.session.couponCode;
        return res.redirect(paymentMethod === 'Razorpay'
            ? `/orders/${order._id}/pay`
            : `/order-success/${order._id}`);
    } catch (error) {
        if (walletDebited) {
            try {
                await User.updateOne({ _id: req.session.user.id }, { $inc: { walletBalance: walletDebitAmount } });
            } catch (walletRollbackError) {
                console.error('Wallet rollback after checkout failure:', walletRollbackError);
            }
        }
        if (order) {
            try {
                const deletion = await Order.deleteOne({ _id: order._id });
                if (deletion.deletedCount !== 1) {
                    console.error("Could not remove incomplete order; keeping its stock reservation.", order._id);
                    return res.redirect(`/order-success/${order._id}`);
                }
            } catch (deleteError) {
                console.error("Remove incomplete order after failure:", deleteError);
                return res.redirect(`/order-success/${order._id}`);
            }
        }
        for (const item of popularityUpdates) {
            try {
                await Product.updateOne(
                    { _id: item.product },
                    { $inc: { soldCount: -item.quantity } }
                );
            } catch (countError) {
                console.error("Popularity counter rollback after order failure:", countError);
            }
        }
        for (const item of reserved) {
            try {
                await restoreStock(item.productId, item.selection, item.quantity);
            } catch (restoreError) {
                console.error("Stock rollback after order failure:", restoreError);
            }
        }
        console.error("Place order error:", error);
        return res.status(500).send("Unable to place your order. Please try again.");
    } finally {
        activeCheckouts.delete(checkoutKey);
    }
};

const getOrderSuccess = async (req, res) => {
    if (!requireLogin(req, res)) return;
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.session.user.id });
        if (!order) return res.status(404).send("Order not found.");
        return res.render("order-success", { order, user: req.session.user });
    } catch (error) {
        console.error("Load order confirmation error:", error);
        return res.status(500).send("Unable to load order confirmation.");
    }
};

const getProfile = async (req, res) => {
    if (!requireLogin(req, res)) return;
    try {
        const [user, orders] = await Promise.all([
            User.findById(req.session.user.id),
            Order.countDocuments({ user: req.session.user.id })
        ]);
        if (!user) return res.redirect("/login");
        return res.render("profile", {
            user,
            orderCount: orders,
            addresses: user.addresses,
            updated: req.query.updated === "1"
        });
    } catch (error) {
        console.error("Load profile error:", error);
        return res.status(500).send("Unable to load your profile.");
    }
};

const getOrders = async (req, res) => {
    if (!requireLogin(req, res)) return;
    try {
        const orders = await Order.find({ user: req.session.user.id }).sort({ createdAt: -1 });
        return res.render("orders", { orders });
    } catch (error) {
        console.error("Load orders error:", error);
        return res.status(500).send("Unable to load your orders.");
    }
};

const getOrder = async (req, res) => {
    if (!requireLogin(req, res)) return;
    try {
        const query = mongoose.Types.ObjectId.isValid(req.params.id)
            ? { _id: req.params.id, user: req.session.user.id }
            : { orderNumber: req.params.id, user: req.session.user.id };
        const order = await Order.findOne(query);
        if (!order) return res.status(404).send("Order not found.");
        return res.render("order-details", { order, paymentError: req.query.payment === 'failed' });
    } catch (error) {
        console.error("Load order details error:", error);
        return res.status(500).send("Unable to load order details.");
    }
};

const downloadInvoice = async (req, res) => {
    if (!requireLogin(req, res)) return;
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.session.user.id });
        if (!order) return res.status(404).send('Order not found.');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-invoice.pdf"`);
        return res.send(createInvoicePdf(order));
    } catch (error) {
        console.error('Invoice download error:', error);
        return res.status(500).send('Unable to generate the invoice.');
    }
};

const continuePayment = async (req, res) => {
    if (!requireLogin(req, res)) return;
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.session.user.id,
            paymentMethod: 'Razorpay'
        });
        if (!order || order.paymentStatus === 'Paid') {
            return res.status(404).send('Pending online payment not found.');
        }
        if (!isRazorpayConfigured()) {
            return res.status(503).send('Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.');
        }
        if (!order.razorpayOrderId) {
            const razorpayOrder = await createRazorpayOrder(order.total, order.orderNumber);
            if (!razorpayOrder.id) throw new Error("Razorpay did not return an order ID.");
            order.razorpayOrderId = razorpayOrder.id;
            await order.save();
        }
        return res.redirect(`/orders/${order._id}/pay`);
    } catch (error) {
        console.error("Start Razorpay payment error:", error);
        return res.status(502).send('Unable to start the Razorpay payment. Check the configured key pair and try again.');
    }
};

const getPaymentPage = async (req, res) => {
    if (!requireLogin(req, res)) return;
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.session.user.id,
            paymentMethod: 'Razorpay'
        });
        if (!order) return res.status(404).send('Online payment order not found.');
        if (order.paymentStatus === 'Paid') return res.redirect(`/order-success/${order._id}`);
        if (!order.razorpayOrderId || !isRazorpayConfigured()) {
            return res.status(503).send('Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.');
        }
        return res.render('razorpay-payment', {
            order,
            keyId: getRazorpayKeyId(),
            amountInPaise: Math.round(Number(order.total) * 100)
        });
    } catch (error) {
        console.error("Load Razorpay payment page error:", error);
        return res.status(500).send('Unable to load the Razorpay payment.');
    }
};

const verifyRazorpayPayment = async (req, res) => {
    if (!requireLogin(req, res)) return;
    const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (![razorpayOrderId, paymentId, signature].every(value => typeof value === 'string' && value.length > 0)) {
        return res.status(400).json({ error: 'Missing Razorpay payment details.' });
    }
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.session.user.id,
            paymentMethod: 'Razorpay'
        });
        if (!order) return res.status(404).json({ error: 'Online payment order not found.' });
        if (order.paymentStatus === 'Paid' && order.razorpayPaymentId === paymentId) {
            return res.json({ redirect: `/order-success/${order._id}` });
        }
        if (order.paymentStatus === 'Refunded' && order.razorpayPaymentId === paymentId) {
            return res.json({ redirect: `/orders/${order._id}` });
        }
        if (order.paymentStatus !== 'Pending' || order.razorpayOrderId !== razorpayOrderId) {
            return res.status(400).json({ error: 'This payment does not match a pending order.' });
        }
        if (!verifyPaymentSignature(razorpayOrderId, paymentId, signature)) {
            return res.status(400).json({ error: 'Razorpay payment signature could not be verified.' });
        }

        let payment = await fetchRazorpayPayment(paymentId);
        if (payment.order_id !== order.razorpayOrderId ||
            payment.amount !== Math.round(Number(order.total) * 100) ||
            payment.currency !== 'INR') {
            return res.status(400).json({ error: 'Razorpay has not confirmed a captured payment for this order.' });
        }
        if (payment.status === 'authorized' && order.status === 'Cancelled') {
            return res.status(409).json({ error: 'This order was cancelled before payment capture.' });
        }
        if (payment.status === 'authorized') {
            payment = await captureRazorpayPayment(paymentId, order.total);
        }
        if (payment.status !== 'captured') {
            return res.status(400).json({ error: 'Razorpay has not confirmed a captured payment for this order.' });
        }

        const updatedOrder = await Order.findOneAndUpdate(
            {
                _id: order._id,
                user: req.session.user.id,
                paymentStatus: 'Pending',
                razorpayOrderId,
                status: { $ne: 'Cancelled' }
            },
            { $set: { paymentStatus: 'Paid', razorpayPaymentId: paymentId } },
            { new: true }
        );
        if (!updatedOrder) {
            const latestOrder = await Order.findOne({ _id: order._id, user: req.session.user.id });
            if (latestOrder && latestOrder.paymentStatus === 'Paid' && latestOrder.razorpayPaymentId === paymentId) {
                return res.json({ redirect: `/order-success/${order._id}` });
            }
            if (latestOrder && latestOrder.status === 'Cancelled' && latestOrder.paymentStatus === 'Pending') {
                const refund = await refundRazorpayPayment(paymentId, order.total);
                if (!refund.id) throw new Error("Razorpay did not return a refund ID.");
                await Order.updateOne(
                    { _id: order._id, user: req.session.user.id, status: 'Cancelled', paymentStatus: 'Pending' },
                    { $set: { paymentStatus: 'Refunded', razorpayPaymentId: paymentId, razorpayRefundId: refund.id } }
                );
                return res.json({ redirect: `/orders/${order._id}` });
            }
            return res.status(409).json({ error: 'The order changed while payment was being confirmed. Please contact the store.' });
        }
        return res.json({ redirect: `/order-success/${updatedOrder._id}` });
    } catch (error) {
        console.error("Verify Razorpay payment error:", error);
        return res.status(502).json({ error: 'Unable to verify the Razorpay payment. Please try again.' });
    }
};

const cancelOrder = async (req, res) => {
    if (!requireLogin(req, res)) return;
    try {
        const order = await Order.findOneAndUpdate(
            { _id: req.params.id, user: req.session.user.id, status: "Pending" },
            { $set: { status: "Cancelled", cancelledAt: new Date() } },
            { new: true }
        );
        if (!order) return res.status(400).send("Only pending orders can be cancelled.");
        if (order.paymentStatus === 'Paid' && !order.walletCredited) {
            await User.updateOne({ _id: order.user }, { $inc: { walletBalance: order.total } });
            order.walletCredited = true;
            order.paymentStatus = 'Refunded';
            await order.save();
        }
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (!product) continue;
            const path = item.colorIndex >= 0 && item.optionIndex >= 0 &&
                product.variants[item.colorIndex] && product.variants[item.colorIndex].options[item.optionIndex]
                ? `variants.${item.colorIndex}.options.${item.optionIndex}.stock`
                : "stock";
            await Product.updateOne({ _id: product._id }, { $inc: { [path]: item.quantity, stock: item.quantity } });
        }
        return res.redirect(`/orders/${order._id}`);
    } catch (error) {
        console.error("Cancel order error:", error);
        return res.status(500).send("Unable to cancel this order.");
    }
};

const requestReturn = async (req, res) => {
    if (!requireLogin(req, res)) return;
    try {
        const order = await Order.findOneAndUpdate(
            { _id: req.params.id, user: req.session.user.id, status: 'Delivered' },
            { $set: { status: 'Return requested', returnRequestedAt: new Date() } },
            { new: true }
        );
        if (!order) return res.status(400).send('Only delivered orders can be returned.');
        return res.redirect(`/orders/${order._id}`);
    } catch (error) {
        console.error('Request return error:', error);
        return res.status(500).send('Unable to request a return.');
    }
};

const getWishlist = async (req, res) => {
    if (!requireLogin(req, res)) return;
    const user = await User.findById(req.session.user.id).populate({ path: 'wishlist', populate: 'category' });
    return res.render('wishlist', { products: Array.from(user ? user.wishlist : []) });
};

const addWishlist = async (req, res) => {
    if (!requireLogin(req, res)) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send('Product not found.');
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send('Product not found.');
    await User.updateOne({ _id: req.session.user.id }, { $addToSet: { wishlist: product._id } });
    return res.redirect(req.get('referer') || '/wishlist');
};

const removeWishlist = async (req, res) => {
    if (!requireLogin(req, res)) return;
    await User.updateOne({ _id: req.session.user.id }, { $pull: { wishlist: req.params.id } });
    return res.redirect('/wishlist');
};

module.exports = {
    getCart,
    applyCoupon,
    removeCoupon,
    addToCart,
    updateCart,
    removeFromCart,
    getCheckout,
    placeOrder,
    getOrderSuccess,
    getProfile,
    getOrders,
    getOrder,
    downloadInvoice,
    continuePayment,
    getPaymentPage,
    verifyRazorpayPayment,
    cancelOrder,
    requestReturn,
    getWishlist,
    addWishlist,
    removeWishlist
};
