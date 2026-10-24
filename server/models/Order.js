'use strict';
const mongoose = require('mongoose');

const { Schema } = mongoose;

const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REJECTED',
];
const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'];
const PAYMENT_METHODS = ['COD', 'RAZORPAY', 'DEMO'];

// Snapshot of the product at purchase time: later menu edits never alter history.
const itemSchema = new Schema(
  {
    food: { type: Schema.Types.ObjectId, ref: 'Food', required: true },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    isVeg: { type: Boolean, default: true },
    unitPrice: { type: Number, required: true, min: 0 }, // INR actually charged per unit
    originalPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const historySchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    byRole: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    restaurantSnapshot: {
      name: String,
      logo: String,
      address: String,
      phone: String,
      location: { lat: Number, lng: Number },
    },
    items: { type: [itemSchema], validate: (v) => Array.isArray(v) && v.length > 0 },
    pricing: {
      subtotal: { type: Number, required: true, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      deliveryFee: { type: Number, default: 0, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 0 },
    },
    coupon: {
      code: { type: String, default: '' },
      discount: { type: Number, default: 0 },
      freeShipping: { type: Boolean, default: false },
      released: { type: Boolean, default: false }, // usage returned after cancel/failure
    },
    address: {
      fullName: String,
      phone: String,
      house: String,
      street: String,
      city: String,
      state: String,
      postalCode: String,
      location: { lat: Number, lng: Number },
    },
    instructions: { type: String, trim: true, maxlength: 300, default: '' },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING', index: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'PENDING', index: true },
    statusHistory: { type: [historySchema], default: [] },
    rejectionReason: { type: String, default: '' },
    cancelReason: { type: String, default: '' },
    estimatedDeliveryAt: Date,
    deliveredAt: Date,
    deliveryPartner: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.index({ restaurant: 1, status: 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ 'coupon.code': 1, customer: 1 });

orderSchema.statics.STATUSES = ORDER_STATUSES;
orderSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
