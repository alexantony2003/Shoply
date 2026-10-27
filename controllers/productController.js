const mongoose = require("mongoose");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const { normalizeName, createSlug } = require("../utils/categoryIcons");

const getProductCoupons = product => {
    const coupons = (product.coupons || [])
        .filter(coupon => coupon.active !== false)
        .map(coupon => ({
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: Number(coupon.discountValue)
        }));

    if (!coupons.length && product.couponCode && Number(product.discountPercentage) > 0) {
        coupons.push({
            code: product.couponCode,
            discountType: "percentage",
            discountValue: Number(product.discountPercentage)
        });
    }

    return coupons;
};

const getCouponSavings = (coupon, price) => {
    const amount = coupon.discountType === "percentage"
        ? price * coupon.discountValue / 100
        : coupon.discountValue;

    return Math.round(Math.min(price, amount) * 100) / 100;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Resolve the `?category=` filter, which may be a Mongo id, a slug, or a
 * category name (names such as "Beauty & Personal Care" contain spaces and
 * ampersands). Only listed categories are considered.
 */
const resolveCategoryFilter = async (value) => {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return null;

    if (mongoose.Types.ObjectId.isValid(raw)) {
        const byId = await Category.findOne({ _id: raw })
            .select("_id name slug");
        if (byId) return byId;
    }

    const slug = createSlug(raw);
    const namePattern = new RegExp(`^${escapeRegex(normalizeName(raw))}$`, "i");
    const slugClauses = slug
        ? [{ slug }, { slug: raw.toLowerCase() }]
        : [];

    return Category.findOne({ $or: [...slugClauses, { name: namePattern }] }).select("_id name slug");
};

// Show all active products with search, category filtering & sorting
const getProducts = async (req, res) => {
    try {
        const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
        let selectedCategory = typeof req.query.category === "string" ? req.query.category.trim() : "";
        let selectedCategoryName = "";
        let categoryNotFound = false;
        const requestedSort = typeof req.query.sort === "string" ? req.query.sort.trim() : "newest";
        const sortOptions = {
            popular: { soldCount: -1, createdAt: -1 },
            "price-low": { price: 1 },
            "price-high": { price: -1 },
            rating: { rating: -1, createdAt: -1 },
            featured: { featured: -1, createdAt: -1 },
            newest: { createdAt: -1 },
            "name-asc": { name: 1 },
            "name-desc": { name: -1 }
        };
        const sortOption = Object.prototype.hasOwnProperty.call(sortOptions, requestedSort)
            ? requestedSort
            : "newest";
        const availability = ["all", "in-stock", "out-of-stock"].includes(req.query.availability)
            ? req.query.availability
            : "all";

        const filter = {};

        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const matchingCategories = await Category.find({ name: { $regex: escapedSearch, $options: "i" } }).select("_id");

            filter.$or = [
                { name: { $regex: escapedSearch, $options: "i" } },
                { brand: { $regex: escapedSearch, $options: "i" } },
                { category: { $in: matchingCategories.map((c) => c._id) } },
                { description: { $regex: escapedSearch, $options: "i" } }
            ];
        }

        if (selectedCategory) {
            const category = await resolveCategoryFilter(selectedCategory);
            if (category) {
                filter.category = category._id;
                selectedCategoryName = category.name;
                selectedCategory = String(category._id);
            } else {
                categoryNotFound = true;
            }
        }

        if (availability === "in-stock") filter.stock = { $gt: 0 };
        else if (availability === "out-of-stock") filter.stock = 0;

        let productQuery = Product.find(filter)
                .populate("category")
                .sort(sortOptions[sortOption]);
        if (sortOption === "name-asc" || sortOption === "name-desc") {
            productQuery = productQuery.collation({ locale: "en", strength: 2 });
        }

        const [products, categories] = await Promise.all([
            productQuery,
            Category.find({ status: true }).sort({ name: 1 })
        ]);

        const visibleProducts = products;

        if (categoryNotFound) {
            return res.status(404).render("products", {
                products: [],
                categories,
                selectedCategory: "",
                selectedCategoryName: "",
                categoryNotFound: true,
                search,
                sort: sortOption,
                availability
            });
        }

        res.render("products", {
            products: visibleProducts,
            categories,
            selectedCategory,
            selectedCategoryName,
            categoryNotFound,
            search,
            sort: sortOption,
            availability
        });

    } catch (error) {
        console.error("getProducts error:", error);
        res.status(500).send(error.message);
    }
};

// Show one product with full details, specs, reviews, coupons & recommendations
const getProduct = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).render("product-details", {
                product: null,
                error: "Invalid product identifier.",
                user: req.session.user || null,
                relatedProducts: []
            });
        }

        const product = await Product.findById(req.params.id)
            .populate("category")
            .populate({
                path: "reviews.user",
                select: "name avatar"
            });

        if (!product) {
            return res.status(404).render("product-details", {
                product: null,
                error: "The requested product does not exist or has been removed.",
                user: req.session.user || null,
                relatedProducts: []
            });
        }

        const isUnavailable = product.status !== "active" || !product.category || product.category.status === false;

        // Fetch related products from the same category
        let relatedProducts = [];
        if (!isUnavailable && product.category && product.category._id) {
            relatedProducts = await Product.find({
                category: product.category._id,
                _id: { $ne: product._id },
                status: "active",
                stock: { $gt: 0 }
            })
                .populate("category")
                .limit(4);
        }

        // Fallback recommendations if fewer than 4 items in same category
        if (relatedProducts.length < 4) {
            const fallbackProducts = await Product.find({
                _id: { $nin: [product._id, ...relatedProducts.map(p => p._id)] },
                status: "active",
                stock: { $gt: 0 }
            })
                .populate({
                    path: "category",
                    match: { status: true }
                })
                .limit(4 - relatedProducts.length);
            relatedProducts = [...relatedProducts, ...fallbackProducts.filter(candidate => candidate.category)];
        }

        // Reviews stats & distribution
        const totalReviews = product.reviews ? product.reviews.length : 0;
        const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        if (totalReviews > 0) {
            product.reviews.forEach(r => {
                const rounded = Math.min(5, Math.max(1, Math.round(r.rating)));
                ratingCounts[rounded] = (ratingCounts[rounded] || 0) + 1;
            });
        }

        const userReview = req.session.user && product.reviews
            ? product.reviews.find((review) => {
                const revUserId = review.user && review.user._id
                    ? review.user._id.toString()
                    : (review.user ? review.user.toString() : "");
                return revUserId === req.session.user.id;
            })
            : null;

        // Pricing & Discounts calculation
        const selectedPrice = product.variants && product.variants.length &&
            product.variants[0].options && product.variants[0].options.length
            ? Number(product.variants[0].options[0].price ?? product.price)
            : Number(product.price);
        const configuredDiscount = Number(product.discountPercentage);
        const savedOriginalPrice = Number(product.originalPrice);
        const originalPrice = Number.isFinite(savedOriginalPrice) && savedOriginalPrice > selectedPrice
            ? savedOriginalPrice
            : (Number.isFinite(configuredDiscount) && configuredDiscount > 0 && configuredDiscount < 100
                ? selectedPrice / (1 - configuredDiscount / 100)
                : null);
        const discountPercentage = originalPrice && Number.isFinite(originalPrice) && originalPrice > selectedPrice
            ? Math.min(99, Math.max(0, Math.round((originalPrice - selectedPrice) / originalPrice * 100)))
            : 0;
        const couponCode = product.couponCode || null;
        const coupons = getProductCoupons(product);
        const appliedCouponCode = req.session.appliedProductCoupons
            ? req.session.appliedProductCoupons[product._id.toString()]
            : null;
        const appliedCoupon = coupons.find(coupon => coupon.code === appliedCouponCode) || null;
        const couponSavings = appliedCoupon ? getCouponSavings(appliedCoupon, selectedPrice) : 0;

        // Highlights default fallback
        const highlights = product.highlights && product.highlights.length > 0
            ? product.highlights
            : [];

        res.render("product-details", {
            product,
            isUnavailable,
            relatedProducts,
            user: req.session.user || null,
            userRating: userReview ? userReview.rating : null,
            userComment: userReview ? userReview.comment : "",
            ratingMessage: req.query.rating,
            ratingCounts,
            totalReviews,
            originalPrice,
            selectedPrice,
            discountPercentage,
            couponCode,
            coupons,
            appliedCoupon,
            couponSavings,
            couponError: req.query.couponError,
            couponMessage: req.query.coupon,
            highlights
        });

    } catch (error) {
        console.error("getProduct error:", error);
        res.status(500).send(error.message);
    }
};

const applyProductCoupon = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).send("Product not found.");
    }

    const code = typeof req.body.couponCode === "string"
        ? req.body.couponCode.trim().toUpperCase()
        : "";
    const productId = req.params.id;

    if (!code) {
        if (req.session.appliedProductCoupons) {
            delete req.session.appliedProductCoupons[productId];
        }
        return res.redirect(`/products/${productId}?coupon=cleared#coupon`);
    }

    try {
        const product = await Product.findById(productId).populate("category");
        if (!product || product.status !== "active" || !product.category || product.category.status === false) {
            return res.status(404).send("This product is unavailable.");
        }

        const coupon = getProductCoupons(product).find(
            availableCoupon => availableCoupon.code.toUpperCase() === code
        );
        if (!coupon || !Number.isFinite(coupon.discountValue) || coupon.discountValue <= 0) {
            return res.redirect(`/products/${productId}?couponError=invalid#coupon`);
        }
        if (coupon.discountType === "percentage" && coupon.discountValue > 100) {
            console.error(`Invalid percentage coupon configuration for product ${productId}`);
            return res.status(500).send("This coupon is not configured correctly.");
        }

        req.session.appliedProductCoupons = req.session.appliedProductCoupons || {};
        req.session.appliedProductCoupons[productId] = coupon.code;
        return res.redirect(`/products/${productId}?coupon=applied#coupon`);
    } catch (error) {
        console.error("Apply product coupon error:", error);
        return res.status(500).send("Unable to apply this coupon. Please try again.");
    }
};

const rateProduct = async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).send("Choose a rating from 1 to 5 stars.");
    }

    try {
        const product = await Product.findOne({
            _id: req.params.id,
            status: "active"
        }).populate("category");

        if (!product || !product.category || product.category.status === false) {
            return res.status(404).send("Product not found");
        }

        if (comment.length > 2000) {
            return res.status(400).send("Review text must be 2000 characters or fewer.");
        }

        const existingReview = product.reviews.find((review) => {
            const revUserId = review.user && review.user._id
                ? review.user._id.toString()
                : (review.user ? review.user.toString() : "");
            return revUserId === req.session.user.id;
        });

        if (existingReview) {
            existingReview.rating = rating;
            existingReview.comment = comment;
            existingReview.userName = req.session.user.name || "Customer";
        } else {
            product.reviews.push({
                user: req.session.user.id,
                userName: req.session.user.name || "Customer",
                rating,
                comment
            });
        }

        product.rating = product.reviews.reduce(
            (total, review) => total + review.rating,
            0
        ) / product.reviews.length;

        await product.save();
        return res.redirect(`/products/${product._id}?rating=saved#reviews`);
    } catch (error) {
        console.error("Product rating error:", error);
        return res.status(500).send("Unable to save your rating.");
    }
};

module.exports = {    
    getProducts,
    getProduct,
    applyProductCoupon,
    rateProduct
};
