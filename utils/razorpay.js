const crypto = require("crypto");
const Razorpay = require("razorpay");

const getCredentials = () => {
    const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
    const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
    if (!keyId || !keySecret || /your_|replace|placeholder/i.test(`${keyId} ${keySecret}`)) {
        return null;
    }
    return { keyId, keySecret };
};

const getClient = () => {
    const credentials = getCredentials();
    if (!credentials) throw new Error("Razorpay credentials are not configured.");
    return new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret });
};

const createRazorpayOrder = (amount, receipt) => getClient().orders.create({
    amount: Math.round(Number(amount) * 100),
    currency: "INR",
    receipt
});

const fetchRazorpayPayment = paymentId =>
    getClient().payments.fetch(paymentId);

const captureRazorpayPayment = (paymentId, amount) =>
    getClient().payments.capture(paymentId, Math.round(Number(amount) * 100), "INR");

const refundRazorpayPayment = (paymentId, amount) =>
    getClient().payments.refund(paymentId, { amount: Math.round(Number(amount) * 100) });

const verifyPaymentSignature = (orderId, paymentId, signature) => {
    const credentials = getCredentials();
    if (!credentials) return false;
    const expected = crypto
        .createHmac("sha256", credentials.keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest();
    let received;
    try {
        received = Buffer.from(signature, "hex");
    } catch (_) {
        return false;
    }
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
};

const getRazorpayKeyId = () => {
    const credentials = getCredentials();
    return credentials ? credentials.keyId : null;
};

module.exports = {
    createRazorpayOrder,
    captureRazorpayPayment,
    fetchRazorpayPayment,
    refundRazorpayPayment,
    getRazorpayKeyId,
    isRazorpayConfigured: () => Boolean(getCredentials()),
    verifyPaymentSignature
};
