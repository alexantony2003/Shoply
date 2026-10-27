require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/userModel');

const email = String(process.argv[2] || '').trim().toLowerCase();

const run = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Usage: npm run admin:promote -- existing-user@example.com');
    }

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shoply');
    const user = await User.findOne({ email });
    if (!user) {
        throw new Error(`No account was found for ${email}. Register this account and verify it before promoting it.`);
    }
    if (user.status !== 'active') {
        throw new Error('This account is blocked. Unblock it before granting admin access.');
    }

    if (user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
    }
    console.log(`Admin access is enabled for ${user.email}. Sign out and sign in again.`);
};

run()
    .catch(error => {
        console.error(`Admin promotion failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
