const Product = require("../models/productModel");


// Show all active products
const getProducts = async (req, res) => {
    try {
        const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
        const filter = { status: "active" };

        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = [
                { name: { $regex: escapedSearch, $options: "i" } },
                { category: { $regex: escapedSearch, $options: "i" } },
                { description: { $regex: escapedSearch, $options: "i" } }
            ];
        }

        const products = await Product.find(filter).sort({ createdAt: -1 });

        res.render("products", {
            products,
            search
        });

    } catch (error) {
        res.status(500).send(error.message);
    }
};


// Show one product
const getProduct = async (req, res) => {
    try {

        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).send("Product not found");
        }

        res.render("product-details", {
            product
        });

    } catch (error) {
        res.status(500).send(error.message);
    }
};


module.exports = {
    getProducts,
    getProduct
};
