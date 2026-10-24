'use strict';
const mongoose = require('mongoose');

const { Schema } = mongoose;

const hoursSchema = new Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
    open: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, default: '10:00' },
    close: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, default: '23:00' },
    closed: { type: Boolean, default: false },
  },
  { _id: false }
);

const restaurantSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 600, default: '' },
    logo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    cuisines: { type: [String], default: [], index: true },
    address: {
      line: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      postalCode: { type: String, trim: true, default: '' },
    },
    location: {
      lat: { type: Number, default: 12.9716 },
      lng: { type: Number, default: 77.5946 },
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    prepTime: { type: Number, default: 25, min: 5, max: 120 }, // minutes
    deliveryFee: { type: Number, default: 30, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },
    priceForTwo: { type: Number, default: 400, min: 0 },
    openingHours: { type: [hoursSchema], default: [] },
    isOpen: { type: Boolean, default: true }, // manual switch by owner
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    rejectionReason: { type: String, default: '' },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

restaurantSchema.index({ name: 'text', cuisines: 'text', description: 'text' });

module.exports = mongoose.models.Restaurant || mongoose.model('Restaurant', restaurantSchema);
