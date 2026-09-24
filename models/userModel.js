const mongoose = require('mongoose');

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
        required: true
    },

    phone: {
        type: String,
        required: true
    },

    address: {
        type: String,
        required: true
    },

    role: {
        type: String,
        enum: ['customer', 'admin'],
        default: 'customer'
    },

    status: {
        type: String,
        default: 'active'
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

const User = mongoose.model('User', userModelSchema);

module.exports = User;