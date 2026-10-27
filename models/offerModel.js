const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, enum: ['product', 'category', 'referral'], required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    discountValue: { type: Number, required: true, min: 0.01 },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    active: { type: Boolean, default: true }
}, { timestamps: true });

offerSchema.index({ active: 1, startsAt: 1, endsAt: 1 });

module.exports = mongoose.model('Offer', offerSchema);
