'use strict';
const mongoose = require('mongoose');

const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // 'razorpay' = real gateway (test keys); 'demo' = simulated; 'cod' = cash on delivery.
    gateway: { type: String, enum: ['razorpay', 'demo', 'cod'], required: true },
    gatewayOrderId: { type: String, index: true, sparse: true }, // razorpay order_xxx
    gatewayPaymentId: { type: String }, // razorpay pay_xxx (unique sparse index below)
    signature: { type: String, select: false },
    transactionRef: { type: String, unique: true, sparse: true }, // our reference, shown to the customer
    amount: { type: Number, required: true, min: 0 }, // integer paise
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    failureReason: { type: String, default: '' },
    attempt: { type: Number, default: 1 },
    paidAt: Date,
    failedAt: Date,
    refundedAt: Date,
    refundId: { type: String, default: '' },
    // Webhook idempotency: event ids we already processed.
    processedEvents: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

// A gateway payment id can only ever belong to one payment record (prevents replaying a payment on two orders).
paymentSchema.index({ gatewayPaymentId: 1 }, { unique: true, sparse: true, name: 'uniq_gateway_payment_id' });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
