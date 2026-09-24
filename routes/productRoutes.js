const express = require('express');

const productRouter = express.Router();

const {
    getProducts,
    getProduct
} = require("../controllers/productController");

productRouter.get("/", getProducts);


productRouter.get("/:id", getProduct);


module.exports = productRouter;