const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    label: { type: String, trim: true, default: "Home", maxlength: 40 },
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    street: { type: String, required: true, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    postalCode: { type: String, required: true, trim: true, maxlength: 20 },
    country: { type: String, required: true, trim: true, maxlength: 100, default: "India" },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

const userModelSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    passwordHash: {
        type: String,
        required: function() {
            return !this.googleId;
        }
    },

    phone: {
        type: String,
        required: false,
        default: ''
    },

    addresses: {
        type: [addressSchema],
        default: []
    },

    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

    walletBalance: {
        type: Number,
        default: 0,
        min: 0
    },

    googleId: {
        type: String,
        unique: true,
        sparse: true
    },

    avatar: {
        type: String,
        default: ''
    },

    role: {
        type: String,
        enum: ['customer', 'admin'],
        default: 'customer'
    },

    status: {
        type: String,
        enum: ["active", "blocked"],
        default: "active"
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

const User = mongoose.model('User', userModelSchema);

module.exports = User;
