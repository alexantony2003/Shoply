const mongoose = require("mongoose");

const productReviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        userName: {
            type: String,
            default: "Verified Customer"
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comment: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

const productCouponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },
        discountType: {
            type: String,
            enum: ["percentage", "fixed"],
            required: true
        },
        discountValue: {
            type: Number,
            required: true,
            min: 0.01,
            validate: {
                validator(value) {
                    return this.discountType !== "percentage" || value <= 100;
                },
                message: "Percentage coupons cannot exceed 100%."
            }
        },
        active: {
            type: Boolean,
            default: true
        }
    },
    { _id: false }
);

const productVariantOptionSchema = new mongoose.Schema(
    {
        label: {
            type: String,
            required: true,
            trim: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        stock: {
            type: Number,
            required: true,
            min: 0
        }
    },
    { _id: false }
);

const productColorVariantSchema = new mongoose.Schema(
    {
        color: {
            type: String,
            required: true,
            trim: true
        },
        colorCode: {
            type: String,
            default: "#64748b",
            match: /^#[0-9a-fA-F]{6}$/
        },
        images: {
            type: [String],
            validate: {
                validator(images) {
                    return images.length === 0 || images.length === 3;
                },
                message: "Each color variant must have either no images or exactly 3 images."
            },
            default: []
        },
        options: {
            type: [productVariantOptionSchema],
            validate: {
                validator(options) {
                    return options.length > 0;
                },
                message: "Each color must have at least one variant option."
            },
            default: []
        }
    },
    { _id: false }
);

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        productCode: {
            type: String
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true
        },

        brand: {
            type: String,
            required: true,
            trim: true
        },

        price: {
            type: Number,
            required: true
        },

        originalPrice: {
            type: Number
        },

        discountPercentage: {
            type: Number,
            default: 0
        },

        couponCode: {
            type: String,
            default: null
        },

        coupons: {
            type: [productCouponSchema],
            default: []
        },

        stock: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },

        maxPerCustomer: {
            type: Number,
            default: 5,
            min: 1,
            max: 100
        },

        soldCount: {
            type: Number,
            default: 0,
            min: 0
        },

        featured: {
            type: Boolean,
            default: false
        },

        description: {
            type: String,
            required: true
        },

        systemMemory: {
            type: String,
            trim: true,
            default: ""
        },

        highlights: {
            type: [String],
            default: []
        },

        specifications: {
            type: Map,
            of: String,
            default: {}
        },

        image: {
            type: String
        },

        images: {
            type: [String],
            default: []
        },

        variants: {
            type: [productColorVariantSchema],
            default: []
        },

        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },

        showNewTag: {
            type: Boolean,
            default: false
        },

        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },

        reviews: {
            type: [productReviewSchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);



const Product = mongoose.model("Product", productSchema);


module.exports = Product;