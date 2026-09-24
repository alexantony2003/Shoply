const express = require('express');
const path = require('path');
const multer = require('multer');

const router = express.Router();

const Product = require('../models/productModel');

// ===============================
// MULTER IMAGE STORAGE
// ===============================

const imageStorage = multer.diskStorage({

destination: path.join(
    __dirname,
    '..',
    'public',
    'uploads',
    'products'
),

filename: (req, file, callback) => {

    const extension = path
        .extname(file.originalname)
        .toLowerCase();

    callback(
        null,
        `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`
    );
}


});

// ===============================
// MULTER UPLOAD
// ===============================

const uploadProductImage = multer({

storage: imageStorage,

limits: {
    fileSize: 5 * 1024 * 1024
},

fileFilter: (req, file, callback) => {

    const extension = path
        .extname(file.originalname)
        .toLowerCase();

    const isJpg =
        extension === '.jpg' ||
        extension === '.jpeg';

    if (isJpg) {
        callback(null, true);
    } else {
        callback(
            new Error('Only JPG and JPEG images are allowed')
        );
    }
}

});

// ===============================
// ADMIN DASHBOARD
// ===============================

router.get('/', (req, res) => {


res.render('admin/dashboard');


});

// ===============================
// PRODUCT LIST
// ===============================

router.get('/products', async (req, res) => {

try {

    const products = await Product.find();

    res.render('admin/products', {
        products: products
    });

} catch (error) {

    console.error(error);

    res.status(500).send(error.message);
}


});

// ===============================
// ADD PRODUCT PAGE
// ===============================

router.get('/products/new', (req, res) => {


const product = {
    name: '',
    category: 'Bags',
    price: '',
    stock: '',
    description: '',
    image: '',
    status: 'active',
    rating: 0
};

res.render('admin/product-form', {
    product: product,
    isEdit: false
});


});

// ===============================
// ADD PRODUCT
// ===============================

router.post(
'/products',
uploadProductImage.single('image'),
async (req, res) => {


    try {

        const {
            name,
            category,
            price,
            stock,
            description,
            status,
            rating
        } = req.body;


        const product = await Product.create({

            name: name,

            category: category,

            price: price,

            stock: stock,

            description: description,

            image: req.file
                ? `/uploads/products/${req.file.filename}`
                : '',

            status: status || 'active',

            rating: rating || 0

        });


        console.log('Product created:', product);

        res.redirect('/admin/products');

    } catch (error) {

        console.error(error);

        res.status(500).send(error.message);
    }

}

);

// ===============================
// DELETE PRODUCT
// ===============================

router.get('/products/:id/delete', async (req, res) => {


try {

    await Product.findByIdAndDelete(req.params.id);

    res.redirect('/admin/products');

} catch (error) {

    console.error(error);

    res.status(500).send(error.message);
}


});

// ===============================
// ORDERS
// ===============================

router.get('/orders', (req, res) => {

res.render('admin/orders');


});

router.get('/orders/:id', (req, res) => {

res.render('admin/orders');

});

// ===============================
// USERS
// ===============================

router.get('/users', (req, res) => {

res.render('admin/users');


});

router.get('/users/:id', (req, res) => {

res.render('admin/users');


});

// ===============================
// SETTINGS
// ===============================

router.get('/settings', (req, res) => {

res.render('admin/settings');


});

router.post('/settings', (req, res) => {
    
res.redirect('/admin/settings');


});

module.exports = router;
