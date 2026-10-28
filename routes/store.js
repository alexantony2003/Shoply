const express = require('express');
const Product = require('../models/productModel');
const {
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
} = require('../controllers/storeController');
const { loginUser } = require('../controllers/userController');
const {
	requestPasswordReset,
	getPasswordReset,
	resetPassword
} = require('../controllers/passwordController');

const router = express.Router();

router.get(['/', '/home'], async (req, res) => {
	try {
		const products = await Product.find()
			.populate("category")
			.sort({ createdAt: -1 });
		res.render('home', { user: req.session.user || null, products });
	} catch (error) {
		res.status(500).send(error.message);
	}
});
const { redirectIfLoggedIn } = require('../middlewares/authMiddleware');
router.get('/login', redirectIfLoggedIn, (req, res) => {
	res.render('login', { error: req.query.error || null, success: req.query.success || null });
});
router.post('/login', loginUser);
router.get('/register', redirectIfLoggedIn, (req, res) => res.render('register', { error: req.query.error || null, formData: {} }));
router.post('/register', require('../controllers/userController').createUser);
router.get('/verify-otp', (req, res) => res.redirect(`/users/verify-otp?${new URLSearchParams(req.query).toString()}`));
router.post('/verify-otp', require('../controllers/userController').verifyOTP);
router.post('/resend-otp', require('../controllers/userController').resendOTP);
router.get('/forgot-password', (req, res) => res.render('forgot-password', {
	error: req.query.error || "",
	success: ""
}));
router.post('/forgot-password', requestPasswordReset);
router.get('/reset-password', getPasswordReset);
router.post('/reset-password', resetPassword);

const { requireLogin } = require('../middlewares/authMiddleware');
router.get('/cart', getCart);
router.post('/cart/add/:id', addToCart);
router.post('/cart/update', updateCart);
router.post('/cart/remove', removeFromCart);
router.post('/cart/coupon', applyCoupon);
router.post('/cart/coupon/remove', removeCoupon);
router.get('/checkout', requireLogin, getCheckout);
router.post('/checkout', requireLogin, placeOrder);
router.get('/order-success/:id', requireLogin, getOrderSuccess);
router.get('/orders/:id/pay', requireLogin, getPaymentPage);
router.post('/orders/:id/pay/verify', requireLogin, verifyRazorpayPayment);

router.get('/wishlist', requireLogin, getWishlist);
router.post('/wishlist/:id', requireLogin, addWishlist);
router.post('/wishlist/:id/remove', requireLogin, removeWishlist);

router.get('/profile', requireLogin, getProfile);

const logout = (req, res) => {
	req.session.destroy((error) => {
		if (error) {
			return res.status(500).send('Unable to log out');
		}

		res.clearCookie('connect.sid');
		res.redirect('/login');
	});
};

router.get('/logout', logout);
router.post('/logout', logout);

router.get('/orders', requireLogin, getOrders);
router.get('/orders/:id', requireLogin, getOrder);
router.get('/orders/:id/invoice', requireLogin, downloadInvoice);
router.post('/orders/:id/pay', requireLogin, continuePayment);
router.post('/orders/:id/cancel', requireLogin, cancelOrder);
router.post('/orders/:id/return', requireLogin, requestReturn);

module.exports = router;
