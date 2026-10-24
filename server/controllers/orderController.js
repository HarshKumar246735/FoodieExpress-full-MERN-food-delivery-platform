'use strict';
const Order = require('../models/Order');
const Food = require('../models/Food');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Payment = require('../models/Payment');
const { Review, Notification, Complaint, DeliveryAssignment } = require('../models/misc');
const ApiError = require('../utils/ApiError');
const { asyncHandler, parsePagination, paginationMeta } = require('../utils/helpers');
const orderService = require('../services/orderService');
const { TIMELINE } = require('../services/orderState');
const { buildCartView } = require('../services/cartService');
const { emitTo } = require('../sockets');

exports.create = asyncHandler(async (req, res) => {
  const { addressId, address, saveAddress, instructions, paymentMethod } = req.body;
  const env = require('../config/env');
  if (paymentMethod === 'DEMO' && !env.DEMO_PAYMENTS_ENABLED) throw ApiError.forbidden('Demo payments are disabled on this server');
  const order = await orderService.createOrderFromCart(req.user._id, {
    addressId,
    address: address && !addressId ? address : undefined,
    saveAddress: saveAddress === true || saveAddress === 'true',
    instructions,
    paymentMethod,
  });
  const populated = await Order.findById(order._id).populate('restaurant', 'name slug logo');
  res.status(201).json({
    success: true,
    order: orderService.serializeOrder(populated, req.user),
    // The client uses this to decide what to do next (open Razorpay, show demo payment page, or confirmation).
    next: paymentMethod === 'COD' ? 'CONFIRMATION' : paymentMethod === 'DEMO' ? 'DEMO_PAYMENT' : 'RAZORPAY',
  });
});

exports.myOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
  const filter = { customer: req.user._id };
  if (req.query.status === 'active') filter.status = { $nin: ['DELIVERED', 'CANCELLED', 'REJECTED'] };
  else if (req.query.status === 'past') filter.status = { $in: ['DELIVERED', 'CANCELLED', 'REJECTED'] };
  else if (req.query.status && Order.STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('restaurant', 'name slug logo'),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, orders: orders.map((o) => orderService.serializeOrder(o, req.user)), pagination: paginationMeta(page, limit, total) });
});

exports.getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.loadOrderForUser(req.params.id, req.user);
  const out = orderService.serializeOrder(order, req.user);
  const payment = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });
  out.payment = payment
    ? { id: String(payment._id), gateway: payment.gateway, status: payment.status, transactionRef: payment.transactionRef || payment.gatewayPaymentId || '', amount: payment.amount / 100, failureReason: payment.failureReason, paidAt: payment.paidAt, attempt: payment.attempt }
    : null;
  const restaurantObj = order.restaurant && order.restaurant.location ? order.restaurant : null;
  const partner = order.deliveryPartner && order.deliveryPartner._id ? await User.findById(order.deliveryPartner._id).select('lastLocation') : null;
  res.json({
    success: true,
    order: out,
    timeline: TIMELINE,
    tracking: {
      restaurantLocation: (restaurantObj && restaurantObj.location) || (order.restaurantSnapshot && order.restaurantSnapshot.location) || null,
      // Real coordinates only when the partner's device shared them recently; otherwise the client draws a clearly labelled simulation.
      partnerLocation: partner && partner.lastLocation && partner.lastLocation.at && Date.now() - new Date(partner.lastLocation.at).getTime() < 2 * 60 * 1000 ? { lat: partner.lastLocation.lat, lng: partner.lastLocation.lng, at: partner.lastLocation.at } : null,
    },
  });
});

exports.cancel = asyncHandler(async (req, res) => {
  const order = await orderService.loadOrderForUser(req.params.id, req.user, false);
  if (req.user.role !== 'customer' && req.user.role !== 'admin') throw ApiError.forbidden();
  const updated = await orderService.changeStatus(order._id, 'CANCELLED', { actorUser: req.user, role: req.user.role, reason: String(req.body.reason || 'Cancelled by customer').slice(0, 200) });
  res.json({ success: true, order: orderService.serializeOrder(updated, req.user) });
});

/** Put the items of a previous order back into the cart (current prices and availability are re-checked when pricing). */
exports.reorder = asyncHandler(async (req, res) => {
  const order = await orderService.loadOrderForUser(req.params.id, req.user, false);
  if (String(order.customer) !== String(req.user._id)) throw ApiError.forbidden();
  const foods = await Food.find({ _id: { $in: order.items.map((i) => i.food) }, isAvailable: true });
  if (!foods.length) throw ApiError.conflict('None of the items from this order are available right now');
  const restaurant = await Restaurant.findById(order.restaurant);
  if (!restaurant || restaurant.approvalStatus !== 'approved') throw ApiError.conflict('This restaurant is not available');
  const qty = new Map(order.items.map((i) => [String(i.food), i.quantity]));
  const user = await User.findById(req.user._id);
  user.cart.items = foods.map((f) => ({ food: f._id, quantity: Math.min(20, qty.get(String(f._id)) || 1) }));
  user.cart.restaurant = restaurant._id;
  user.cart.couponCode = '';
  await user.save();
  const skipped = order.items.length - foods.length;
  res.json({ success: true, skipped, message: skipped ? `${skipped} unavailable item(s) were skipped` : 'Items added to your cart', cart: await buildCartView(user) });
});

/** Printable receipt data (the client renders it and calls window.print()). */
exports.receipt = asyncHandler(async (req, res) => {
  const order = await orderService.loadOrderForUser(req.params.id, req.user);
  const payment = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });
  res.json({
    success: true,
    receipt: {
      order: orderService.serializeOrder(order, req.user),
      payment: payment ? { gateway: payment.gateway, status: payment.status, transactionRef: payment.transactionRef || payment.gatewayPaymentId || '', paidAt: payment.paidAt } : null,
      issuedAt: new Date().toISOString(),
      note: payment && payment.gateway !== 'cod' ? 'Payments on this platform are made in TEST/DEMO mode. No real money was charged.' : '',
    },
  });
});

exports.review = asyncHandler(async (req, res) => {
  const order = await orderService.loadOrderForUser(req.params.id, req.user, false);
  if (String(order.customer) !== String(req.user._id)) throw ApiError.forbidden();
  if (order.status !== 'DELIVERED') throw ApiError.conflict('You can review an order after it has been delivered');
  if (order.reviewed) throw ApiError.conflict('You have already reviewed this order');
  const rating = Number(req.body.rating);
  await Review.create({ user: req.user._id, restaurant: order.restaurant, order: order._id, rating, comment: req.body.comment || '' });
  await Order.updateOne({ _id: order._id }, { $set: { reviewed: true } });
  // Recompute the restaurant's rating from visible reviews.
  const agg = await Review.aggregate([{ $match: { restaurant: order.restaurant, status: 'visible' } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  if (agg[0]) await Restaurant.updateOne({ _id: order.restaurant }, { $set: { rating: Math.round(agg[0].avg * 10) / 10, reviewCount: agg[0].n } });
  res.status(201).json({ success: true, message: 'Thanks for your review!' });
});

/* ------------------------- notifications ------------------------- */
exports.listNotifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(40);
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({
    success: true,
    unread,
    notifications: items.map((n) => ({ id: String(n._id), title: n.title, message: n.message, type: n.type, order: n.order ? String(n.order) : null, read: n.read, createdAt: n.createdAt })),
  });
});
exports.markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { read: true } });
  res.json({ success: true });
});
exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.json({ success: true });
});

/* ------------------------- complaints ------------------------- */
exports.createComplaint = asyncHandler(async (req, res) => {
  let orderId;
  if (req.body.order) {
    const o = await Order.findOne({ _id: req.body.order, customer: req.user._id }).select('_id');
    if (!o) throw ApiError.badRequest('That order was not found');
    orderId = o._id;
  }
  const c = await Complaint.create({ user: req.user._id, order: orderId, subject: req.body.subject, message: req.body.message });
  emitTo('admin', 'complaint:new', { id: String(c._id) });
  res.status(201).json({ success: true, message: 'Your complaint has been submitted. Our team will respond soon.', id: String(c._id) });
});
exports.myComplaints = asyncHandler(async (req, res) => {
  const list = await Complaint.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30);
  res.json({ success: true, complaints: list.map((c) => ({ id: String(c._id), subject: c.subject, message: c.message, status: c.status, adminResponse: c.adminResponse, createdAt: c.createdAt })) });
});

void DeliveryAssignment;
