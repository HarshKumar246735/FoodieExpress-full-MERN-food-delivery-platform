'use strict';
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { asyncHandler, pick } = require('../utils/helpers');
const { setAuthCookie, clearAuthCookie, randomToken, sha256 } = require('../utils/token');
const { buildCartView } = require('../services/cartService');
const { audit } = require('../services/notificationService');

const sendAuth = async (res, user, status = 200) => {
  setAuthCookie(res, user._id);
  const fresh = await User.findById(user._id);
  const cart = await buildCartView(fresh);
  res.status(status).json({ success: true, user: fresh.toSafe(), cart });
};

// Public registration only ever creates customers. Other roles are created by an admin or the seed script.
exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (await User.findOne({ email })) throw ApiError.conflict('An account with this email already exists');
  const user = await User.create({ name, email, phone: phone || undefined, password, role: 'customer' });
  await sendAuth(res, user, 201);
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  // Same message for unknown email and wrong password.
  if (!user || !(await user.comparePassword(password))) throw ApiError.unauthorized('Invalid email or password');
  if (user.status === 'suspended') throw ApiError.forbidden('Your account has been suspended. Please contact support.');
  user.lastLoginAt = new Date();
  await user.save({ validateModifiedOnly: true });
  await sendAuth(res, user);
});

exports.logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafe(), cart: await buildCartView(req.user) });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const data = pick(req.body, ['name', 'phone', 'avatar']);
  if (req.user.role === 'delivery' && req.body.vehicle !== undefined) data.vehicle = String(req.body.vehicle).slice(0, 40);
  if (data.phone === '') data.phone = undefined;
  Object.assign(req.user, data);
  await req.user.save();
  res.json({ success: true, user: req.user.toSafe() });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  if (req.body.currentPassword === req.body.newPassword) throw ApiError.badRequest('New password must be different');
  user.password = req.body.newPassword;
  await user.save();
  setAuthCookie(res, user._id); // old tokens are invalidated by passwordChangedAt
  res.json({ success: true, message: 'Password updated' });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  const generic = { success: true, message: 'If that email is registered, a reset link has been generated.' };
  if (!user || user.status === 'suspended') return res.json(generic);
  const token = randomToken();
  user.resetTokenHash = sha256(token);
  user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save({ validateModifiedOnly: true });
  const url = `${env.CLIENT_URLS[0]}/reset-password?token=${token}`;
  // No SMTP is configured in this project. The link is printed to the server log and, in
  // development only, returned in the response so the flow can be tested end-to-end.
  console.log(`[password reset] link for ${user.email}: ${url}`);
  if (!env.isProd) generic.devResetUrl = url;
  return res.json(generic);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ resetTokenHash: sha256(req.body.token), resetTokenExpires: { $gt: new Date() } }).select('+resetTokenHash +resetTokenExpires');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');
  user.password = req.body.password;
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();
  res.json({ success: true, message: 'Password reset. You can now log in.' });
});

/* ------------------------- saved addresses ------------------------- */
const normalizeDefault = (user, keepId) => {
  user.addresses.forEach((a) => { a.isDefault = String(a._id) === String(keepId); });
};

exports.addAddress = asyncHandler(async (req, res) => {
  if (req.user.addresses.length >= 10) throw ApiError.badRequest('You can save up to 10 addresses');
  req.user.addresses.push(pick(req.body, ['label', 'fullName', 'phone', 'house', 'street', 'city', 'state', 'postalCode']));
  const added = req.user.addresses[req.user.addresses.length - 1];
  if (req.body.isDefault || req.user.addresses.length === 1) normalizeDefault(req.user, added._id);
  await req.user.save();
  res.status(201).json({ success: true, user: req.user.toSafe() });
});

exports.updateAddress = asyncHandler(async (req, res) => {
  const addr = req.user.addresses.id(req.params.id);
  if (!addr) throw ApiError.notFound('Address not found');
  addr.set(pick(req.body, ['label', 'fullName', 'phone', 'house', 'street', 'city', 'state', 'postalCode']));
  if (req.body.isDefault) normalizeDefault(req.user, addr._id);
  await req.user.save();
  res.json({ success: true, user: req.user.toSafe() });
});

exports.deleteAddress = asyncHandler(async (req, res) => {
  const addr = req.user.addresses.id(req.params.id);
  if (!addr) throw ApiError.notFound('Address not found');
  const wasDefault = addr.isDefault;
  addr.deleteOne();
  if (wasDefault && req.user.addresses.length) req.user.addresses[0].isDefault = true;
  await req.user.save();
  res.json({ success: true, user: req.user.toSafe() });
});

/* ------------------------- dev helper ------------------------- */
// Registered only when NODE_ENV !== 'production'. Resets the seeded demo accounts' passwords/status.
exports.resetDemoAccounts = asyncHandler(async (req, res) => {
  const users = await User.find({ isDemo: true }).select('+password');
  for (const u of users) {
    u.password = env.SEED_DEMO_PASSWORD;
    u.status = 'active';
    // eslint-disable-next-line no-await-in-loop
    await u.save();
  }
  await audit(req, 'dev.reset_demo_accounts', 'User', '', { count: users.length });
  res.json({ success: true, message: `Reset ${users.length} demo account(s)` });
});
