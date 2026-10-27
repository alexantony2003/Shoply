const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shoply');
        console.log('db connected');
    } catch (error) {
        console.error('db not connected:', error.message);
        throw error;
    }
};

module.exports = connectDB;