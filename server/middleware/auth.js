'use strict';
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/token');
const env = require('../config/env');

async function loadUserFromRequest(req) {
  const token = req.cookies && req.cookies[env.COOKIE_NAME];
  if (!token) return null;
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (e) {
    return null;
  }
  const user = await User.findById(decoded.id).select('+passwordChangedAt');
  if (!user) return null;
  if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime() - 1000) return null;
  return user;
}

/** Requires a valid session. Suspended accounts are rejected. */
const protect = async (req, res, next) => {
  try {
    const user = await loadUserFromRequest(req);
    if (!user) throw ApiError.unauthorized();
    if (user.status === 'suspended') throw ApiError.forbidden('Your account has been suspended. Please contact support.');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/** Attaches req.user when logged in, but never fails. */
const optionalAuth = async (req, res, next) => {
  try {
    const user = await loadUserFromRequest(req);
    if (user && user.status !== 'suspended') req.user = user;
  } catch (e) {
    /* ignore */
  }
  next();
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  return next();
};

module.exports = { protect, optionalAuth, authorize, loadUserFromRequest };
