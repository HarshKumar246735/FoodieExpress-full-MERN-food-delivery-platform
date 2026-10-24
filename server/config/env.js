'use strict';
const path = require('path');
const dotenv = require('dotenv');

// server/.env first, then repo-root .env as a fallback.
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

const bool = (v, d = false) => (v === undefined || v === '' ? d : String(v).toLowerCase() === 'true');
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) {
    throw new Error('JWT_SECRET must be set in production');
  }
  // Development-only fallback so the app boots; never used in production.
  jwtSecret = 'dev-only-insecure-secret-change-me-please-0123456789';
}

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';

const env = {
  NODE_ENV,
  isProd,
  PORT: num(process.env.PORT, 5000),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/foodieexpress',
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  COOKIE_NAME: 'fx_token',
  CLIENT_URLS: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  RAZORPAY_KEY_ID: razorpayKeyId,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  // Demo payments: always on outside production; in production only when explicitly enabled.
  DEMO_PAYMENTS_ENABLED: isProd ? bool(process.env.DEMO_PAYMENTS_ENABLED, false) : true,
  TAX_RATE: num(process.env.TAX_RATE, 0.05),
  FREE_DELIVERY_THRESHOLD: num(process.env.FREE_DELIVERY_THRESHOLD, 499),
  DELIVERY_EARNING_PER_ORDER: num(process.env.DELIVERY_EARNING_PER_ORDER, 40),
  PEXELS_API_KEY: process.env.PEXELS_API_KEY || '',
  UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY || '',
  SEED_DEMO_PASSWORD: process.env.SEED_DEMO_PASSWORD || 'Demo@1234',
};

env.razorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
env.razorpayIsTestKey = env.RAZORPAY_KEY_ID.startsWith('rzp_test_');
env.cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

module.exports = env;
