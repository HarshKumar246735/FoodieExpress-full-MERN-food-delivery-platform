'use strict';
/* Smaller models grouped in one file: Review, Coupon, DeliveryAssignment, Notification, AuditLog, Complaint, Subscriber */
const mongoose = require('mongoose');

const { Schema } = mongoose;
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 600, default: '' },
    foodRatings: [
      {
        food: { type: Schema.Types.ObjectId, ref: 'Food' },
        rating: { type: Number, min: 1, max: 5 },
        _id: false,
      },
    ],
    status: { type: String, enum: ['visible', 'hidden'], default: 'visible', index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
// One review per user per order.
reviewSchema.index({ user: 1, order: 1 }, { unique: true, partialFilterExpression: { order: { $type: 'objectId' } } });

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 24 },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    type: { type: String, enum: ['FLAT', 'PERCENT', 'FREESHIP'], required: true },
    value: { type: Number, default: 0, min: 0 }, // rupees for FLAT, percent for PERCENT
    minOrder: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: 0, min: 0 }, // 0 = no cap
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    perUserLimit: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const assignmentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    partner: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // AVAILABLE (open pool) -> ACCEPTED -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED | CANCELLED
    status: {
      type: String,
      enum: ['AVAILABLE', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      default: 'AVAILABLE',
      index: true,
    },
    rejectedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    earning: { type: Number, default: 0 },
    acceptedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
  },
  { timestamps: true }
);

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, default: '', maxlength: 400 },
    type: { type: String, default: 'info' },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, createdAt: -1 });

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String, default: '' },
    action: { type: String, required: true, index: true },
    entity: { type: String, default: '' },
    entityId: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditSchema.index({ createdAt: -1 });

const complaintSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['open', 'in_review', 'resolved'], default: 'open', index: true },
    adminResponse: { type: String, default: '', maxlength: 1000 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const subscriberSchema = new Schema(
  { email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^\S+@\S+\.\S+$/ } },
  { timestamps: true }
);

module.exports = {
  Review: model('Review', reviewSchema),
  Coupon: model('Coupon', couponSchema),
  DeliveryAssignment: model('DeliveryAssignment', assignmentSchema),
  Notification: model('Notification', notificationSchema),
  AuditLog: model('AuditLog', auditSchema),
  Complaint: model('Complaint', complaintSchema),
  Subscriber: model('Subscriber', subscriberSchema),
};
