'use strict';
const env = require('./env');

let instance = null;

/** Returns a Razorpay SDK instance, or null when keys are not configured. */
function getRazorpay() {
  if (!env.razorpayConfigured) return null;
  if (!instance) {
    const Razorpay = require('razorpay');
    instance = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return instance;
}

module.exports = { getRazorpay };
