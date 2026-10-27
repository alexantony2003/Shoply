const express = require('express');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/userModel');
const Order = require('../models/orderModel');

const router = express.Router();

const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Offer = require('../models/offerModel');
const {
    getAllUsers,
    blockUser,
    unblockUser
} = require('../controllers/userController');
const {
    getAdminOrders,
    updateOrderStatus,
    getInventory,
    updateInventory
} = require('../controllers/adminOrderController');

const { adminAuth } = require('../middlewares/authMiddleware');
router.use(adminAuth);

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
    fileSize: 10 * 1024 * 1024
},

fileFilter: (req, file, callback) => {

    const extension = path
        .extname(file.originalname)
        .toLowerCase();

    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];

    if (allowed.includes(extension)) {
        callback(null, true);
    } else {
        callback(
            new Error('Only JPG, JPEG, PNG, and WebP images are allowed')
        );
    }
}

});

const repeatedValues = value => value === undefined
    ? []
    : (Array.isArray(value) ? value : [value]);

const getProductCategoryType = category => {
    const normalized = `${category.name || ''} ${category.slug || ''}`.trim().toLowerCase();
    if (/\b(phone|phones|iphone|iphones|smartphone|smartphones|mobile|mobiles)\b/.test(normalized)) return 'phone';
    if (/\b(bud|buds|earbud|earbuds)\b/.test(normalized)) return 'buds';
    if (/\b(laptop|laptops|notebook|notebooks)\b/.test(normalized)) return 'laptop';
    return 'general';
};

const getActiveProductCategory = async categoryId => {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw Object.assign(new Error('Choose a valid product category.'), { statusCode: 400 });
    }
    const category = await Category.findOne({ _id: categoryId, status: true });
    if (!category) {
        throw Object.assign(new Error('Choose an active product category.'), { statusCode: 400 });
    }
    return category;
};

const parseProductVariants = (body, files, existingVariants = []) => {
    let submittedVariants;
    try {
        submittedVariants = JSON.parse(body.variantsData || '[]');
    } catch (error) {
        throw Object.assign(new Error('Product color and variant data is invalid.'), { statusCode: 400 });
    }
    if (!Array.isArray(submittedVariants) || submittedVariants.length > 20) {
        throw Object.assign(new Error('Add no more than 20 product colors.'), { statusCode: 400 });
    }
    if (submittedVariants.length === 0) {
        throw Object.assign(new Error('Add at least one color variant with its product images.'), { statusCode: 400 });
    }

    const variants = [];
    const usedKeys = new Set();
    const usedColors = new Set();
    submittedVariants.forEach(variant => {
        if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
            throw Object.assign(new Error('Product color data is invalid.'), { statusCode: 400 });
        }
        const key = String(variant.key || '');
        if (!/^\d+$/.test(key) || usedKeys.has(key)) {
            throw Object.assign(new Error('Product color data contains an invalid image group.'), { statusCode: 400 });
        }
        usedKeys.add(key);

        const color = String(variant.color || '').trim();
        const normalizedColor = color.toLocaleLowerCase();
        if (!color || color.length > 60 || usedColors.has(normalizedColor)) {
            throw Object.assign(new Error('Enter a unique color name of up to 60 characters for each color.'), { statusCode: 400 });
        }
        usedColors.add(normalizedColor);

        if (!Array.isArray(variant.options) || variant.options.length === 0 || variant.options.length > 20) {
            throw Object.assign(new Error(`${color} must have between 1 and 20 variant options.`), { statusCode: 400 });
        }
        const usedOptions = new Set();
        const options = variant.options.map(option => {
            if (!option || typeof option !== 'object' || Array.isArray(option)) {
                throw Object.assign(new Error(`A variant option for ${color} is invalid.`), { statusCode: 400 });
            }
            const label = String(option.label || '').trim();
            const priceValue = String(option.price ?? '').trim();
            const price = Number(priceValue);
            const stockValue = String(option.stock ?? '').trim();
            const stock = Number(stockValue);
            const normalizedLabel = label.toLocaleLowerCase();
            if (!label || label.length > 60 || usedOptions.has(normalizedLabel)) {
                throw Object.assign(new Error(`Enter unique variant labels of up to 60 characters for ${color}.`), { statusCode: 400 });
            }
            if (!priceValue || !Number.isFinite(price) || price < 0) {
                throw Object.assign(new Error(`Enter a valid price for ${color} - ${label}.`), { statusCode: 400 });
            }
            if (!stockValue || !Number.isSafeInteger(stock) || stock < 0) {
                throw Object.assign(new Error(`Enter a valid whole-number stock quantity for ${color} - ${label}.`), { statusCode: 400 });
            }
            usedOptions.add(normalizedLabel);
            return { label, price, stock };
        });

        const submittedImages = Array.isArray(variant.images)
            ? variant.images.filter(image => typeof image === 'string' && image.startsWith('/uploads/products/')).slice(0, 3)
            : [];
        const existingVariant = Array.from(existingVariants || []).find(previousVariant =>
            JSON.stringify(Array.from(previousVariant.images || [])) === JSON.stringify(submittedImages)
        );
        const images = [0, 1, 2].map(index => {
            const matchingFiles = files.filter(file => file.fieldname === `variantImages_${key}_${index}`);
            if (matchingFiles.length > 1) {
                throw Object.assign(new Error(`Choose only one image for ${color}, image ${index + 1}.`), { statusCode: 400 });
            }
            const imageFile = matchingFiles[0];
            return imageFile
                ? `/uploads/products/${imageFile.filename}`
                : (existingVariant ? submittedImages[index] : undefined);
        }).filter(Boolean);
        if (images.length !== 3) {
            throw Object.assign(new Error(`Upload all 3 product images for ${color}.`), { statusCode: 400 });
        }

        variants.push({ color, options, images });
    });

    const acceptedFileNames = new Set(submittedVariants.flatMap(variant =>
        [0, 1, 2].map(index => `variantImages_${variant.key}_${index}`)
    ));
    const unexpectedVariantFile = files.find(file =>
        file.fieldname.startsWith('variantImages_') && !acceptedFileNames.has(file.fieldname)
    );
    if (unexpectedVariantFile) {
        throw Object.assign(new Error('An uploaded color image does not match a product color.'), { statusCode: 400 });
    }

    if (!variants.length) return { variants, stock: undefined };
    const stock = variants.reduce(
        (total, variant) => total + variant.options.reduce((sum, option) => sum + option.stock, 0),
        0
    );
    if (!Number.isSafeInteger(stock)) {
        throw Object.assign(new Error('The total stock across product variants is too large.'), { statusCode: 400 });
    }
    return { variants, stock };
};

const getProductAdminFields = (body, productType, sellingPrice) => {
    const couponCodes = repeatedValues(body.couponCode);
    const couponTypes = repeatedValues(body.couponType);
    const couponValues = repeatedValues(body.couponValue);
    const coupons = [];

    for (let index = 0; index < Math.max(couponCodes.length, couponTypes.length, couponValues.length); index++) {
        const code = String(couponCodes[index] || '').trim().toUpperCase();
        const discountType = String(couponTypes[index] || '');
        const discountValue = Number(couponValues[index]);
        if (!code && !String(couponValues[index] || '').trim()) continue;
        if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
            throw Object.assign(new Error('Coupon codes must be 3–32 letters, numbers, hyphens, or underscores.'), { statusCode: 400 });
        }
        if (!['percentage', 'fixed'].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0) {
            throw Object.assign(new Error(`Enter a valid discount for coupon ${code}.`), { statusCode: 400 });
        }
        if (discountType === 'percentage' && discountValue > 100) {
            throw Object.assign(new Error(`The percentage discount for ${code} cannot exceed 100%.`), { statusCode: 400 });
        }
        if (coupons.some(coupon => coupon.code === code)) {
            throw Object.assign(new Error(`Coupon code ${code} is duplicated.`), { statusCode: 400 });
        }
        coupons.push({ code, discountType, discountValue, active: true });
    }

    const highlights = String(body.highlights || '')
        .split(/\r?\n/)
        .map(highlight => highlight.trim())
        .filter(Boolean);
    if (highlights.length > 30 || highlights.some(highlight => highlight.length > 250)) {
        throw Object.assign(new Error('Enter up to 30 highlights, with no more than 250 characters each.'), { statusCode: 400 });
    }

    let submittedSpecifications;
    try {
        submittedSpecifications = JSON.parse(body.specificationsData || '[]');
    } catch (error) {
        throw Object.assign(new Error('Product specifications are invalid.'), { statusCode: 400 });
    }
    if (!Array.isArray(submittedSpecifications) || submittedSpecifications.length > 50) {
        throw Object.assign(new Error('Add no more than 50 product specifications.'), { statusCode: 400 });
    }
    const specifications = new Map();
    const usedSpecificationNames = new Set();
    submittedSpecifications.forEach(entry => {
        if (!Array.isArray(entry) || entry.length !== 2) {
            throw Object.assign(new Error('A product specification is invalid.'), { statusCode: 400 });
        }
        const name = String(entry[0] || '').trim();
        const value = String(entry[1] || '').trim();
        const normalizedName = name.toLocaleLowerCase();
        if (!name || !value || name.length > 100 || value.length > 500 || usedSpecificationNames.has(normalizedName)) {
            throw Object.assign(new Error('Enter unique specification names (up to 100 characters) and values (up to 500 characters).'), { statusCode: 400 });
        }
        usedSpecificationNames.add(normalizedName);
        specifications.set(name, value);
    });

    const systemMemory = String(body.systemMemory || '').trim();
    if (systemMemory.length > 100) {
        throw Object.assign(new Error('System memory must be 100 characters or fewer.'), { statusCode: 400 });
    }
    if (productType === 'laptop' && !systemMemory) {
        throw Object.assign(new Error('Enter the laptop system memory.'), { statusCode: 400 });
    }

    const originalPriceValue = String(body.originalPrice || '').trim();
    const originalPrice = originalPriceValue ? Number(originalPriceValue) : null;
    if (originalPriceValue && (!Number.isFinite(originalPrice) || originalPrice <= sellingPrice)) {
        throw Object.assign(new Error('Original price must be greater than the product selling price.'), { statusCode: 400 });
    }
    const discountPercentage = originalPrice
        ? Math.round((originalPrice - sellingPrice) / originalPrice * 100)
        : 0;
    const maxPerCustomer = Number(body.maxPerCustomer || 5);
    if (!Number.isSafeInteger(maxPerCustomer) || maxPerCustomer < 1 || maxPerCustomer > 100) {
        throw Object.assign(new Error('Maximum quantity per customer must be a whole number from 1 to 100.'), { statusCode: 400 });
    }

    return {
        coupons,
        couponCode: coupons[0] ? coupons[0].code : null,
        originalPrice,
        discountPercentage,
        maxPerCustomer,
        featured: body.featured === 'true',
        highlights,
        specifications,
        systemMemory: productType === 'laptop' ? systemMemory : ''
    };
};

const reportRange = query => {
    const now = new Date();
    const end = query.to ? new Date(`${query.to}T23:59:59.999`) : now;
    let start;
    if (query.from) start = new Date(`${query.from}T00:00:00.000`);
    else if (query.range === 'year') start = new Date(now.getFullYear(), 0, 1);
    else if (query.range === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (query.range === 'week') start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    else if (query.range === 'day' || query.range === 'today' || query.range === '1day') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (start > end) start = end;
    return { start, end };
};

const buildSalesReport = async query => {
    const { start, end } = reportRange(query);
    const match = { createdAt: { $gte: start, $lte: end }, status: { $nin: ['Cancelled', 'Returned'] } };
    const [summary] = await Order.aggregate([
        { $match: match },
        { $group: { _id: null, salesCount: { $sum: 1 }, orderAmount: { $sum: '$total' }, discount: { $sum: '$discountAmount' } } }
    ]);
    const orders = await Order.find(match).populate('user', 'name email').sort({ createdAt: -1 });
    return { start, end, summary: summary || { salesCount: 0, orderAmount: 0, discount: 0 }, orders };
};

// ===============================
// ADMIN DASHBOARD
// ===============================

router.get('/', async (req, res) => {
    try {
        const [productCount, userCount, orderCount, revenue, orders] = await Promise.all([
            Product.countDocuments(),
            User.countDocuments({ role: 'customer' }),
            Order.countDocuments(),
            Order.aggregate([
                { $match: { status: { $ne: 'Cancelled' } } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]),
            Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(10)
        ]);
        const totalRevenue = revenue[0] ? revenue[0].total : 0;

        const metrics = [
            {
                label: 'Total Revenue',
                value: `₹${Number(totalRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                change: 'Excluding cancelled orders',
                type: 'revenue'
            },
            {
                label: 'Total Orders',
                value: String(orderCount),
                change: 'All lifetime orders placed',
                type: 'orders'
            },
            {
                label: 'Active Customers',
                value: String(userCount),
                change: 'Registered customer accounts',
                type: 'customers'
            },
            {
                label: 'Total Products',
                value: String(productCount),
                change: 'Items cataloged in store',
                type: 'products'
            }
        ];

        // 2. Chart Analytics: Monthly (current year), Yearly (5 years), Weekly (last 7 days)
        const currentYear = new Date().getFullYear();
        const [monthlyRaw, yearlyRaw, weeklyRaw] = await Promise.all([
            Order.aggregate([
                {
                    $match: {
                        status: { $ne: 'Cancelled' },
                        createdAt: {
                            $gte: new Date(currentYear, 0, 1),
                            $lte: new Date(currentYear, 11, 31, 23, 59, 59)
                        }
                    }
                },
                {
                    $group: {
                        _id: { $month: '$createdAt' },
                        revenue: { $sum: '$total' },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Order.aggregate([
                {
                    $match: {
                        status: { $ne: 'Cancelled' },
                        createdAt: { $gte: new Date(currentYear - 4, 0, 1) }
                    }
                },
                {
                    $group: {
                        _id: { $year: '$createdAt' },
                        revenue: { $sum: '$total' },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Order.aggregate([
                {
                    $match: {
                        status: { $ne: 'Cancelled' },
                        createdAt: {
                            $gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                        },
                        revenue: { $sum: '$total' },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyChart = {
            labels: monthNames,
            revenue: Array(12).fill(0),
            orders: Array(12).fill(0)
        };
        monthlyRaw.forEach(item => {
            const m = item._id - 1;
            if (m >= 0 && m < 12) {
                monthlyChart.revenue[m] = Math.round(item.revenue || 0);
                monthlyChart.orders[m] = item.orders || 0;
            }
        });

        const yearLabels = [];
        for (let y = currentYear - 4; y <= currentYear; y++) yearLabels.push(String(y));
        const yearlyChart = {
            labels: yearLabels,
            revenue: Array(5).fill(0),
            orders: Array(5).fill(0)
        };
        yearlyRaw.forEach(item => {
            const idx = yearLabels.indexOf(String(item._id));
            if (idx !== -1) {
                yearlyChart.revenue[idx] = Math.round(item.revenue || 0);
                yearlyChart.orders[idx] = item.orders || 0;
            }
        });

        const weeklyChart = { labels: [], revenue: [], orders: [] };
        for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            weeklyChart.labels.push(label);
            const found = weeklyRaw.find(w => w._id === key);
            weeklyChart.revenue.push(found ? Math.round(found.revenue || 0) : 0);
            weeklyChart.orders.push(found ? (found.orders || 0) : 0);
        }

        const chartData = {
            monthly: monthlyChart,
            yearly: yearlyChart,
            weekly: weeklyChart
        };

        // 3. Top 10 Best Selling Products
        const topProductsRaw = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    name: { $first: '$items.name' },
                    image: { $first: '$items.image' },
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'prod'
                }
            },
            { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'prod.category',
                    foreignField: '_id',
                    as: 'cat'
                }
            },
            { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } }
        ]);

        const topProducts = topProductsRaw.map((item, idx) => ({
            rank: idx + 1,
            id: item._id,
            name: item.name || (item.prod ? item.prod.name : 'Product'),
            category: item.cat ? item.cat.name : 'General',
            brand: item.prod ? (item.prod.brand || 'General') : 'General',
            image: item.image || (item.prod ? item.prod.image : null),
            sold: item.totalQuantity || 0,
            revenue: Number(item.totalRevenue || 0)
        }));

        // 4. Top 10 Best Selling Categories
        const topCategoriesRaw = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'product.category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: { $ifNull: ['$category._id', '$product.category'] },
                    name: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } }
                }
            },
            { $match: { name: { $ne: null } } },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 }
        ]);

        const topCategories = topCategoriesRaw.map((item, idx) => ({
            rank: idx + 1,
            name: item.name,
            sold: item.totalQuantity || 0,
            revenue: Number(item.totalRevenue || 0)
        }));

        // 5. Top 10 Best Selling Brands
        const topBrandsRaw = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $group: {
                    _id: '$product.brand',
                    name: { $first: '$product.brand' },
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } }
                }
            },
            { $match: { _id: { $ne: null, $ne: '' } } },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 }
        ]);

        const topBrands = topBrandsRaw.map((item, idx) => ({
            rank: idx + 1,
            name: item.name,
            sold: item.totalQuantity || 0,
            revenue: Number(item.totalRevenue || 0)
        }));

        // 6. Recent Orders
        const recentOrders = orders.map(order => ({
            id: order._id,
            orderNumber: order.orderNumber,
            customer: order.user ? order.user.name : 'Deleted user',
            createdAt: order.createdAt,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            total: `₹${Number(order.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            status: order.status
        }));

        return res.render('admin/dashboard', {
            metrics,
            chartData,
            topProducts,
            topCategories,
            topBrands,
            recentOrders
        });
    } catch (error) {
        console.error('Load admin dashboard error:', error);
        return res.status(500).send('Unable to load the admin dashboard.');
    }
});

// ===============================
// PRODUCT LIST
// ===============================

router.get('/products', async (req, res) => {

try {

    const products = await Product.find().populate('category').sort({ createdAt: -1 });

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

router.get('/products/new', async (req, res) => {

try {

    const categories = await Category.find({ status: true }).sort({ name: 1 });

    const product = {
        name: '',
        category: '',
        brand: '',
        price: '',
        stock: '',
        description: '',
        image: '',
        coupons: [],
        highlights: [],
        status: 'active',
        rating: 0
    };

    res.render('admin/product-form', {
        product: product,
        categories: categories,
        isEdit: false
    });

} catch (error) {

    console.error(error);

    res.status(500).send(error.message);
}


});

// ===============================
// ADD PRODUCT
// ===============================

router.post(
'/products',
uploadProductImage.any(),
async (req, res) => {

    try {
        const uploadedFiles = req.files || [];

        const {
            name,
            category,
            brand,
            description,
            status
        } = req.body;
        const productCategory = await getActiveProductCategory(category);
        const productVariants = parseProductVariants(req.body, uploadedFiles);
        const highestVariantPrice = Math.max(...productVariants.variants.flatMap(variant =>
            variant.options.map(option => option.price)
        ));
        const productFields = getProductAdminFields(
            req.body,
            getProductCategoryType(productCategory),
            highestVariantPrice
        );
        const images = productVariants.variants[0].images;

        const product = await Product.create({
            name: name,
            category: category,
            brand: brand,
            price: productVariants.variants[0].options[0].price,
            stock: productVariants.stock,
            description: description,
            images: images,
            image: images[0],
            variants: productVariants.variants,
            status: status || 'active',
            showNewTag: true,
            ...productFields
        });

        console.log('Product created:', product._id);
        res.redirect('/admin/products');

    } catch (error) {
        console.error(error);
        res.status(error.statusCode || 500).send(error.message);
    }
}
);

// ===============================
// EDIT PRODUCT PAGE
// ===============================

router.get('/products/:id/edit', async (req, res) => {

try {

    const [product, categories] = await Promise.all([
        Product.findById(req.params.id),
        Category.find({ status: true }).sort({ name: 1 })
    ]);

    if (!product) {
        return res.status(404).send('Product not found');
    }

    res.render('admin/product-form', {
        product: product,
        categories: categories,
        isEdit: true
    });

} catch (error) {

    console.error(error);

    res.status(500).send(error.message);
}

});

// ===============================
// EDIT PRODUCT
// ===============================

router.post(
'/products/:id/edit',
uploadProductImage.any(),
async (req, res) => {

try {
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
        return res.status(404).send('Product not found');
    }

    const {
        name,
        category,
        brand,
        description,
        status
    } = req.body;
    const productCategory = await getActiveProductCategory(category);
    const uploadedFiles = req.files || [];
    const productVariants = parseProductVariants(req.body, uploadedFiles, existingProduct.variants);
    const highestVariantPrice = Math.max(...productVariants.variants.flatMap(variant =>
        variant.options.map(option => option.price)
    ));
    const productFields = getProductAdminFields(
        req.body,
        getProductCategoryType(productCategory),
        highestVariantPrice
    );

    const update = {
        name: name,
        category: category,
        brand: brand,
        price: productVariants.variants[0].options[0].price,
        stock: productVariants.stock,
        description: description,
        status: status || 'active',
        showNewTag: req.body.showNewTag === 'true',
        variants: productVariants.variants,
        ...productFields
    };

    const finalImages = productVariants.variants[0].images;
    update.images = finalImages;
    update.image = finalImages[0] || '';

    const product = await Product.findByIdAndUpdate(req.params.id, update, {
        runValidators: true,
        new: true
    });

    res.redirect('/admin/products');

} catch (error) {
    console.error(error);
    res.status(400).send(error.message);
}

}
);

// ===============================
// BLOCK / UNBLOCK PRODUCT
// ===============================

router.post('/products/:id/toggle-status', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).send('Product not found.');
        }
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).send('Product not found.');
        }
        product.status = product.status === 'active' ? 'inactive' : 'active';
        await product.save();
        return res.redirect('/admin/products');
    } catch (error) {
        console.error('Toggle product status error:', error);
        return res.status(500).send('Unable to update product availability.');
    }
});

// ===============================
// ORDERS
// ===============================

router.get('/orders', getAdminOrders);
router.post('/orders/:id/status', updateOrderStatus);
router.get('/inventory', getInventory);
router.post('/inventory/:id', updateInventory);

// ===============================
// USERS
// ===============================

router.get('/users', getAllUsers);
router.post('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);

// ===============================
// SETTINGS
// ===============================

router.get('/settings', (req, res) => {

res.render('admin/settings');


});

router.post('/settings', (req, res) => {
    
res.redirect('/admin/settings');


});

// ===============================
// OFFERS
// ===============================
router.get('/offers', async (req, res) => {
    const [offers, products, categories] = await Promise.all([
        Offer.find().populate('product category').sort({ createdAt: -1 }),
        Product.find({ status: 'active' }).select('name'),
        Category.find({ status: true }).select('name')
    ]);
    return res.render('admin/offers', { offers, products, categories, error: req.query.error || '' });
});

router.post('/offers', async (req, res) => {
    try {
        const type = String(req.body.type || '');
        const discountType = String(req.body.discountType || 'percentage');
        const discountValue = Number(req.body.discountValue);
        const endsAt = new Date(req.body.endsAt);
        if (!['product', 'category', 'referral'].includes(type) || !['percentage', 'fixed'].includes(discountType) ||
            !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percentage' && discountValue > 100) ||
            Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) throw new Error('Enter valid offer details and a future end date.');
        if (type === 'product' && !mongoose.Types.ObjectId.isValid(req.body.product)) throw new Error('Choose a product for this offer.');
        if (type === 'category' && !mongoose.Types.ObjectId.isValid(req.body.category)) throw new Error('Choose a category for this offer.');
        await Offer.create({ name: String(req.body.name || '').trim(), type, product: type === 'product' ? req.body.product : null,
            category: type === 'category' ? req.body.category : null, discountType, discountValue, endsAt });
        return res.redirect('/admin/offers');
    } catch (error) {
        return res.redirect(`/admin/offers?error=${encodeURIComponent(error.message)}`);
    }
});

router.post('/offers/:id/toggle', async (req, res) => {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).send('Offer not found.');
    offer.active = !offer.active;
    await offer.save();
    return res.redirect('/admin/offers');
});

// ===============================
// SALES REPORT
// ===============================
router.get('/sales-report', async (req, res) => {
    try {
        return res.render('admin/sales-report', { report: await buildSalesReport(req.query), query: req.query });
    } catch (error) {
        console.error('Sales report error:', error);
        return res.status(500).send('Unable to generate the sales report.');
    }
});

router.get('/sales-report/export.csv', async (req, res) => {
    try {
        const { report } = { report: await buildSalesReport(req.query) };
        const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = [
            ['Order', 'Date', 'Customer', 'Status', 'Payment', 'Subtotal', 'Discount', 'Total'],
            ...report.orders.map(order => [order.orderNumber, order.createdAt.toISOString(), order.user ? order.user.name : '', order.status,
                order.paymentMethod, order.subtotal, order.discountAmount, order.total])
        ];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="shoply-sales-report.csv"');
        return res.send(`\uFEFF${rows.map(row => row.map(quote).join(',')).join('\n')}`);
    } catch (error) {
        return res.status(500).send('Unable to export the sales report.');
    }
});


// ===============================
// ADMIN PROFILE & CREDENTIALS
// ===============================

router.get('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.redirect('/login');
        }

        let message = null;
        let errorMessage = null;

        if (req.query.success === 'profile_updated') {
            message = 'Admin profile updated successfully.';
        } else if (req.query.success === 'password_updated') {
            message = 'Password changed successfully.';
        }

        if (req.query.error === 'invalid_data') {
            errorMessage = 'Please provide a valid name and email address.';
        } else if (req.query.error === 'email_taken') {
            errorMessage = 'That email address is already in use by another account.';
        } else if (req.query.error === 'current_password_wrong') {
            errorMessage = 'The current password you entered is incorrect.';
        } else if (req.query.error === 'password_mismatch') {
            errorMessage = 'New password and confirm password do not match.';
        } else if (req.query.error === 'password_short') {
            errorMessage = 'New password must be at least 6 characters long.';
        }

        return res.render('admin/profile', {
            user,
            success: message,
            error: errorMessage
        });
    } catch (error) {
        console.error('Load admin profile error:', error);
        return res.status(500).send('Unable to load admin profile.');
    }
});

router.post('/profile', async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const phone = String(req.body.phone || '').trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!name || name.length > 100 || !emailRegex.test(email) || email.length > 254) {
            return res.redirect('/admin/profile?error=invalid_data');
        }

        const existing = await User.findOne({ email, _id: { $ne: req.session.user.id } });
        if (existing) {
            return res.redirect('/admin/profile?error=email_taken');
        }

        const user = await User.findByIdAndUpdate(
            req.session.user.id,
            { $set: { name, email, phone } },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.redirect('/login');
        }

        req.session.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role
        };

        return res.redirect('/admin/profile?success=profile_updated');
    } catch (error) {
        console.error('Update admin profile error:', error);
        return res.redirect('/admin/profile?error=invalid_data');
    }
});

router.post('/profile/password', async (req, res) => {
    try {
        const currentPassword = String(req.body.currentPassword || '');
        const newPassword = String(req.body.newPassword || '');
        const confirmPassword = String(req.body.confirmPassword || '');

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.redirect('/admin/profile?error=invalid_data');
        }

        if (newPassword !== confirmPassword) {
            return res.redirect('/admin/profile?error=password_mismatch');
        }

        if (newPassword.length < 6 || Buffer.byteLength(newPassword, 'utf8') > 72) {
            return res.redirect('/admin/profile?error=password_short');
        }

        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.redirect('/login');
        }

        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            return res.redirect('/admin/profile?error=current_password_wrong');
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        user.passwordHash = newHash;
        await user.save();

        return res.redirect('/admin/profile?success=password_updated');
    } catch (error) {
        console.error('Update admin password error:', error);
        return res.status(500).send('Unable to update admin password.');
    }
});

module.exports = router;
