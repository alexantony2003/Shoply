const express = require('express');

const productRouter = express.Router();

const {
    getProducts,
    getProduct,
    applyProductCoupon,
    rateProduct
} = require("../controllers/productController");
const { requireLogin } = require('../middlewares/authMiddleware');

productRouter.get("/", getProducts);

productRouter.post("/:id/rating", requireLogin, rateProduct);
productRouter.post("/:id/coupon", requireLogin, applyProductCoupon);

productRouter.get("/:id", getProduct);


module.exports = productRouter;