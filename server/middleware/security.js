'use strict';
const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

/**
 * NoSQL-injection guard: removes any key that starts with "$" or contains "." from
 * body, query and params (these are how operators like {"$gt": ""} sneak in).
 * Works in-place so it is safe on Express 4.
 */
function stripOperators(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    obj.forEach(stripOperators);
    return obj;
  }
  Object.keys(obj).forEach((key) => {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      stripOperators(obj[key]);
    }
  });
  return obj;
}

const sanitize = (req, res, next) => {
  stripOperators(req.body);
  stripOperators(req.query);
  stripOperators(req.params);
  next();
};

/**
 * CSRF mitigation for cookie auth. Cross-site <form> posts cannot set custom headers, and
 * cross-origin XHR with a custom header triggers a CORS preflight that we only allow for our origins.
 * The client (axios) always sends X-Requested-With: FoodieExpress.
 */
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const csrfGuard = (req, res, next) => {
  if (SAFE.has(req.method)) return next();
  if (req.originalUrl.startsWith('/api/payments/webhook')) return next(); // signed by Razorpay instead
  if (req.get('X-Requested-With') === 'FoodieExpress') return next();
  return next(ApiError.forbidden('Missing or invalid request header'));
};

const limiterBase = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => next(new ApiError(429, 'Too many requests. Please slow down and try again shortly.')),
};

const apiLimiter = rateLimit({ ...limiterBase, windowMs: 15 * 60 * 1000, limit: 1000 });
const authLimiter = rateLimit({ ...limiterBase, windowMs: 15 * 60 * 1000, limit: 40 });
const paymentLimiter = rateLimit({ ...limiterBase, windowMs: 15 * 60 * 1000, limit: 120 });

module.exports = { sanitize, stripOperators, csrfGuard, apiLimiter, authLimiter, paymentLimiter };
