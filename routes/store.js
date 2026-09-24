const express = require('express');
const Product = require('../models/productModel');

const router = express.Router();

router.get('/', async (req, res) => {
	if (!req.session.user) {
		return res.redirect('/login');
	}

	try {
		const products = await Product.find({ status: 'active' }).sort({ createdAt: -1 });
		res.render('home', { user: req.session.user, products });
	} catch (error) {
		res.status(500).send(error.message);
	}
});
router.get('/login', (req, res) => {
	if (req.session.user) {
		return res.redirect('/');
	}

	res.render('login');
});
router.post('/login', (req, res) => res.redirect('/'));
router.get('/register', (req, res) => res.render('register'));
router.post('/register', (req, res) => res.redirect('/login'));
router.get('/forgot-password', (req, res) => res.render('forgot-password'));
router.post('/forgot-password', (req, res) => res.redirect('/login'));

router.get('/cart', (req, res) => res.render('cart'));
router.post('/cart', (req, res) => res.redirect('/cart'));
router.get('/cart/remove/:id', (req, res) => res.redirect('/cart'));
router.get('/checkout', (req, res) => res.render('checkout'));
router.post('/checkout', (req, res) => res.render('order-success'));
router.get('/order-success', (req, res) => res.render('order-success'));

router.get('/wishlist', (req, res) => res.render('wishlist'));
router.get('/wishlist/add/:id', (req, res) => res.redirect('/wishlist'));
router.get('/wishlist/remove/:id', (req, res) => res.redirect('/wishlist'));

router.get('/profile', (req, res) => {
	if (!req.session.user) {
		return res.redirect('/login');
	}

	res.render('profile', { user: req.session.user });
});
router.post('/logout', (req, res) => {
	req.session.destroy((error) => {
		if (error) {
			return res.status(500).send('Unable to log out');
		}

		res.clearCookie('connect.sid');
		res.redirect('/login');
	});
});
router.get('/profile/edit', (req, res) => res.render('edit-profile'));
router.post('/profile/edit', (req, res) => res.redirect('/profile'));
router.get('/orders', (req, res) => res.render('orders'));
router.get('/orders/:id', (req, res) => res.render('order-details'));

module.exports = router;
