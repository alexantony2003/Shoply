const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        slug: {
            type: String,
            trim: true
        },

        // Lucide icon key shown in the storefront category rail.
        // Stored on the document so the admin panel can manage it later.
        icon: {
            type: String,
            trim: true,
            default: ""
        },

        status: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;