'use strict';
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    label: { type: String, trim: true, maxlength: 30, default: 'Home' },
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true },
    house: { type: String, required: true, trim: true, maxlength: 120 },
    street: { type: String, required: true, trim: true, maxlength: 160 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, trim: true, maxlength: 60 },
    postalCode: { type: String, required: true, trim: true, match: /^[1-9][0-9]{5}$/ },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: false }
);

const cartItemSchema = new Schema(
  {
    food: { type: Schema.Types.ObjectId, ref: 'Food', required: true },
    quantity: { type: Number, required: true, min: 1, max: 20 },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^\S+@\S+\.\S+$/ },
    phone: { type: String, trim: true, match: /^[6-9][0-9]{9}$/ },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['customer', 'owner', 'delivery', 'admin'], default: 'customer', index: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    avatar: { type: String, default: '' },
    addresses: [addressSchema],
    cart: {
      restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', default: null },
      items: { type: [cartItemSchema], default: [] },
      couponCode: { type: String, default: '' },
    },
    // Delivery partner state
    isOnline: { type: Boolean, default: false },
    vehicle: { type: String, trim: true, maxlength: 40, default: '' },
    lastLocation: {
      lat: Number,
      lng: Number,
      at: Date,
    },
    // Security
    passwordChangedAt: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    isDemo: { type: Boolean, default: false },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
  return next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

/** Public-safe representation (never includes password/reset fields). */
userSchema.methods.toSafe = function toSafe() {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    phone: this.phone || '',
    role: this.role,
    status: this.status,
    avatar: this.avatar,
    addresses: (this.addresses || []).map((a) => ({
      id: String(a._id),
      label: a.label,
      fullName: a.fullName,
      phone: a.phone,
      house: a.house,
      street: a.street,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      isDefault: a.isDefault,
    })),
    isOnline: this.isOnline,
    vehicle: this.vehicle,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
