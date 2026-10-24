'use strict';
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { asyncHandler } = require('../utils/helpers');
const payments = require('../services/paymentService');

const serializePayment = (p) => ({
  id: String(p._id),
  order: String(p.order),
  gateway: p.gateway,
  status: p.status,
  amount: p.amount / 100,
  amountPaise: p.amount,
  currency: p.currency,
  transactionRef: p.transactionRef || p.gatewayPaymentId || '',
  gatewayOrderId: p.gatewayOrderId || '',
  failureReason: p.failureReason,
  attempt: p.attempt,
  paidAt: p.paidAt,
  isDemo: p.gateway === 'demo',
  createdAt: p.createdAt,
});

/** Tells the client which payment options this server can actually offer. */
exports.config = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    razorpay: { enabled: env.razorpayConfigured && env.razorpayIsTestKey, keyId: env.razorpayConfigured && env.razorpayIsTestKey ? env.RAZORPAY_KEY_ID : '' },
    demo: { enabled: env.DEMO_PAYMENTS_ENABLED },
    cod: { enabled: true },
  });
});

exports.createOrder = asyncHandler(async (req, res) => {
  const data = await payments.createRazorpayOrder(req.body.orderId, req.user._id);
  res.json({ success: true, ...data });
});

exports.verify = asyncHandler(async (req, res) => {
  const { payment, alreadyProcessed } = await payments.verifyRazorpay(req.user._id, req.body);
  const order = await Order.findById(payment.order).select('orderNumber status paymentStatus');
  res.json({ success: true, alreadyProcessed, payment: serializePayment(payment), order: { id: String(order._id), orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus } });
});

/** Customer reports that the Razorpay window was closed (cancelled) or the payment failed. */
exports.report = asyncHandler(async (req, res) => {
  const payment = await payments.reportRazorpayFailure(req.user._id, {
    razorpayOrderId: req.body.razorpayOrderId,
    reason: String(req.body.reason || '').slice(0, 200),
    cancelled: req.body.cancelled === true || req.body.cancelled === 'true',
  });
  res.json({ success: true, payment: serializePayment(payment) });
});

exports.status = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id };
  if (req.user.role !== 'admin') filter.user = req.user._id;
  const payment = await Payment.findOne(filter);
  if (!payment) throw ApiError.notFound('Payment not found');
  res.json({ success: true, payment: serializePayment(payment) });
});

/** All payment attempts for one of the customer's orders (used by the success/failure pages). */
exports.forOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, customer: req.user._id }).select('_id');
  if (!order) throw ApiError.notFound('Order not found');
  const list = await Payment.find({ order: order._id }).sort({ createdAt: -1 });
  res.json({ success: true, payments: list.map(serializePayment) });
});

exports.retry = asyncHandler(async (req, res) => {
  const order = await payments.switchPaymentMethod(req.body.orderId, req.user._id, req.body.method);
  res.json({ success: true, orderId: String(order._id), paymentMethod: order.paymentMethod });
});

/** Razorpay -> server. Mounted with express.raw() so the signature can be verified over the exact bytes. */
exports.webhook = asyncHandler(async (req, res) => {
  const result = await payments.handleWebhook({
    rawBody: req.body,
    signature: req.get('x-razorpay-signature'),
    eventId: req.get('x-razorpay-event-id'),
  });
  res.json({ success: true, ...result });
});

exports.demoSimulate = asyncHandler(async (req, res) => {
  const outcome = String(req.body.outcome || '');
  if (!['success', 'failure', 'cancel'].includes(outcome)) throw ApiError.badRequest('outcome must be success, failure or cancel');
  const { payment, alreadyProcessed } = await payments.simulateDemoPayment(req.user._id, { orderId: req.body.orderId, outcome });
  const order = await Order.findById(payment.order).select('orderNumber status paymentStatus');
  res.json({
    success: true,
    demo: true,
    label: 'DEMO PAYMENT - no real money was charged',
    alreadyProcessed,
    payment: serializePayment(payment),
    order: { id: String(order._id), orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus },
  });
});

exports.serializePayment = serializePayment;
