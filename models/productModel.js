const moongooese = require("mongoose");

const productModelSchema = new moongooese.Schema({
     name: {
        type: String,
        required: true,
        trim: true
    },

    category: {
        type: String,
        required: true
    },

    price: {
        type: Number,
        required: true
    },

    stock: {
        type: Number,
        required: true,
        default: 0
    },

    description: {
        type: String,
        required: true
    },

    image: {
        type: String
    },

    status: {
        type: String,
        default: "active"
    },

    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

const Product = moongooese.model("Product", productModelSchema);
module.exports = Product;