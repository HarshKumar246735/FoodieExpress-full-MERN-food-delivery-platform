'use strict';
const crypto = require('crypto');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { getRazorpay } = require('../config/razorpay');
const { toPaise } = require('../utils/helpers');
const { verifyCheckoutSignature, verifyWebhookSignature } = require('./signature');
const { notify } = require('./notificationService');
const { emitOrderUpdate } = require('../sockets');
const orderService = require('./orderService');

const txnRef = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/** The user's order must exist, belong to them, and still be awaiting payment. */
async function loadPayableOrder(orderId, userId) {
  const order = await Order.findOne({ _id: orderId, customer: userId });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.paymentMethod === 'COD') throw ApiError.badRequest('This order is Cash on Delivery; no online payment is needed');
  if (order.paymentStatus === 'SUCCESS') throw ApiError.conflict('This order has already been paid', { code: 'ALREADY_PAID' });
  if (order.status !== 'PENDING') throw ApiError.conflict(`This order is ${order.status.toLowerCase()} and can no longer be paid`, { code: 'NOT_PAYABLE' });
  return order;
}

async function newAttempt(order, gateway) {
  const count = await Payment.countDocuments({ order: order._id });
  return Payment.create({
    order: order._id,
    user: order.customer,
    gateway,
    amount: toPaise(order.pricing.total),
    status: 'PENDING',
    attempt: count + 1,
  });
}

/** Sets the order's paymentStatus (never downgrades an already successful payment). */
async function syncOrderPaymentStatus(orderId, status) {
  const filter = { _id: orderId };
  if (status !== 'SUCCESS') filter.paymentStatus = { $nin: ['SUCCESS', 'REFUNDED'] };
  return Order.findOneAndUpdate(filter, { $set: { paymentStatus: status } }, { new: true });
}

/**
 * The ONE place a payment becomes SUCCESS. Atomic + idempotent:
 * the update only matches while the payment is not already SUCCESS, so a replayed verify call
 * or a duplicate webhook cannot process the order twice.
 */
async function markPaymentSuccess(paymentId, { gatewayPaymentId, signature, transactionRef }) {
  let payment;
  try {
    payment = await Payment.findOneAndUpdate(
      { _id: paymentId, status: { $in: ['PENDING', 'FAILED', 'CANCELLED'] } },
      {
        $set: {
          status: 'SUCCESS',
          paidAt: new Date(),
          failureReason: '',
          ...(gatewayPaymentId ? { gatewayPaymentId } : {}),
          ...(signature ? { signature } : {}),
          ...(transactionRef ? { transactionRef } : {}),
        },
      },
      { new: true }
    );
  } catch (e) {
    if (e.code === 11000) throw ApiError.conflict('This payment has already been used for another order', { code: 'DUPLICATE_PAYMENT' });
    throw e;
  }
  if (!payment) return { payment: await Payment.findById(paymentId), firstTime: false };

  const order = await syncOrderPaymentStatus(payment.order, 'SUCCESS');
  if (order) {
    if (['CANCELLED', 'REJECTED'].includes(order.status)) {
      // Paid after the order was cancelled (race): give the money back.
      await orderService.releaseCoupon(order._id);
      await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'SUCCESS' } });
      await orderRefundLate(order);
    } else {
      await orderService.onOrderVisibleToRestaurant(order);
      await notify(order.customer, {
        title: 'Payment received',
        message: `₹${order.pricing.total} paid for order ${order.orderNumber}. Ref: ${payment.transactionRef || payment.gatewayPaymentId}`,
        type: 'payment',
        order: order._id,
      });
    }
  }
  return { payment, firstTime: true };
}

async function orderRefundLate(order) {
  const fresh = await Order.findById(order._id);
  await orderService.refundPaidOrder(fresh, 'Paid after cancellation');
}

async function markPaymentFailed(paymentId, status, reason) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'PENDING' },
    { $set: { status, failureReason: reason || '', failedAt: new Date() } },
    { new: true }
  );
  if (payment) {
    const order = await syncOrderPaymentStatus(payment.order, status);
    if (order) {
      emitOrderUpdate(order);
      await notify(order.customer, {
        title: status === 'CANCELLED' ? 'Payment cancelled' : 'Payment failed',
        message: `Payment for order ${order.orderNumber} ${status === 'CANCELLED' ? 'was cancelled' : 'did not go through'}. You can retry from your orders.`,
        type: 'payment',
        order: order._id,
      });
    }
  }
  return payment;
}

/* ------------------------------ Razorpay (test mode) ------------------------------ */
async function createRazorpayOrder(orderId, userId) {
  const order = await loadPayableOrder(orderId, userId);
  const rz = getRazorpay();
  if (!rz) throw new ApiError(503, 'Razorpay is not configured on this server. Use the demo payment or Cash on Delivery.', { code: 'RAZORPAY_NOT_CONFIGURED' });
  if (!env.razorpayIsTestKey) throw new ApiError(503, 'Only Razorpay TEST keys (rzp_test_…) are supported by this app.', { code: 'RAZORPAY_NOT_TEST_KEY' });

  if (order.paymentMethod !== 'RAZORPAY') {
    order.paymentMethod = 'RAZORPAY';
    await order.save();
  }

  // Idempotent: re-use the open Razorpay order for this attempt instead of creating duplicates.
  let payment = await Payment.findOne({ order: order._id, gateway: 'razorpay', status: 'PENDING', gatewayOrderId: { $exists: true, $ne: null } });
  if (!payment) {
    payment = (await Payment.findOne({ order: order._id, gateway: 'razorpay', status: 'PENDING' })) || (await newAttempt(order, 'razorpay'));
    let rzOrder;
    try {
      rzOrder = await rz.orders.create({
        amount: payment.amount, // integer paise
        currency: 'INR',
        receipt: order.orderNumber,
        notes: { orderId: String(order._id), orderNumber: order.orderNumber },
      });
    } catch (e) {
      const msg = (e && e.error && e.error.description) || e.message || 'gateway error';
      await markPaymentFailed(payment._id, 'FAILED', `Could not create Razorpay order: ${msg}`);
      throw new ApiError(502, `Razorpay rejected the request: ${msg}`);
    }
    payment.gatewayOrderId = rzOrder.id;
    await payment.save();
  }
  await Order.updateOne({ _id: order._id, paymentStatus: { $in: ['FAILED', 'CANCELLED'] } }, { $set: { paymentStatus: 'PENDING' } });

  return {
    keyId: env.RAZORPAY_KEY_ID, // public key id only
    razorpayOrderId: payment.gatewayOrderId,
    amount: payment.amount,
    currency: payment.currency,
    paymentId: String(payment._id),
    orderNumber: order.orderNumber,
  };
}

async function verifyRazorpay(userId, { razorpay_order_id: rzOrderId, razorpay_payment_id: rzPaymentId, razorpay_signature: signature }) {
  const payment = await Payment.findOne({ gateway: 'razorpay', gatewayOrderId: rzOrderId, user: userId });
  if (!payment) throw ApiError.notFound('Payment not found');

  if (payment.status === 'SUCCESS') {
    // Duplicate verification: already processed, return the stored result.
    return { payment, alreadyProcessed: true };
  }
  const ok = verifyCheckoutSignature({ orderId: rzOrderId, paymentId: rzPaymentId, signature, secret: env.RAZORPAY_KEY_SECRET });
  if (!ok) throw ApiError.badRequest('Payment verification failed: invalid signature', { code: 'BAD_SIGNATURE' });

  // Best-effort cross-check with the gateway (amount/order must match what we expect).
  const rz = getRazorpay();
  if (rz) {
    try {
      const remote = await rz.payments.fetch(rzPaymentId);
      if (remote && (remote.order_id !== rzOrderId || Number(remote.amount) !== payment.amount)) {
        throw ApiError.badRequest('Payment details do not match this order', { code: 'MISMATCH' });
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
      /* network hiccup: the HMAC signature already proves authenticity */
    }
  }
  const result = await markPaymentSuccess(payment._id, { gatewayPaymentId: rzPaymentId, signature, transactionRef: payment.transactionRef || txnRef('FXP') });
  return { payment: result.payment, alreadyProcessed: !result.firstTime };
}

/** The customer closed the Razorpay window or the card failed. Only moves PENDING -> FAILED/CANCELLED. */
async function reportRazorpayFailure(userId, { razorpayOrderId, reason, cancelled }) {
  const payment = await Payment.findOne({ gateway: 'razorpay', gatewayOrderId: razorpayOrderId, user: userId });
  if (!payment) throw ApiError.notFound('Payment not found');
  const updated = await markPaymentFailed(payment._id, cancelled ? 'CANCELLED' : 'FAILED', reason || (cancelled ? 'Payment window closed by customer' : 'Payment failed'));
  return updated || (await Payment.findById(payment._id));
}

/* ------------------------------ Webhook ------------------------------ */
async function handleWebhook({ rawBody, signature, eventId }) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw new ApiError(503, 'Webhook secret not configured');
  if (!verifyWebhookSignature({ rawBody, signature, secret: env.RAZORPAY_WEBHOOK_SECRET })) {
    throw ApiError.badRequest('Invalid webhook signature');
  }
  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    throw ApiError.badRequest('Malformed webhook payload');
  }
  const entity = body.payload && body.payload.payment && body.payload.payment.entity;
  const rzOrderId = entity ? entity.order_id : body.payload && body.payload.order && body.payload.order.entity && body.payload.order.entity.id;
  if (!rzOrderId) return { handled: false };

  const payment = await Payment.findOne({ gateway: 'razorpay', gatewayOrderId: rzOrderId }).select('+processedEvents');
  if (!payment) return { handled: false };

  // Idempotency: skip events we already processed.
  if (eventId) {
    const claimed = await Payment.updateOne({ _id: payment._id, processedEvents: { $ne: eventId } }, { $push: { processedEvents: eventId } });
    if (claimed.modifiedCount === 0) return { handled: true, duplicate: true };
  }

  if (['payment.captured', 'order.paid'].includes(body.event) && entity) {
    if (Number(entity.amount) !== payment.amount) return { handled: false, reason: 'amount mismatch' };
    await markPaymentSuccess(payment._id, { gatewayPaymentId: entity.id, transactionRef: payment.transactionRef || txnRef('FXP') });
    return { handled: true };
  }
  if (body.event === 'payment.failed' && entity) {
    await markPaymentFailed(payment._id, 'FAILED', (entity.error_description || 'Payment failed at gateway').slice(0, 200));
    return { handled: true };
  }
  return { handled: false };
}

/* ------------------------------ Demo (simulated) payments ------------------------------ */
async function simulateDemoPayment(userId, { orderId, outcome }) {
  if (!env.DEMO_PAYMENTS_ENABLED) throw ApiError.notFound('Demo payments are disabled on this server');
  const order = await Order.findOne({ _id: orderId, customer: userId });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.paymentMethod !== 'DEMO') throw ApiError.badRequest('Only orders placed with the demo payment method can be simulated');
  if (order.paymentStatus === 'SUCCESS') throw ApiError.conflict('This order has already been paid', { code: 'ALREADY_PAID' });
  if (order.status !== 'PENDING') throw ApiError.conflict(`This order is ${order.status.toLowerCase()} and can no longer be paid`, { code: 'NOT_PAYABLE' });

  let payment = await Payment.findOne({ order: order._id, gateway: 'demo', status: 'PENDING' }).sort({ createdAt: -1 });
  if (!payment) payment = await newAttempt(order, 'demo');

  if (outcome === 'success') {
    const result = await markPaymentSuccess(payment._id, { transactionRef: txnRef('DEMO') });
    return { payment: result.payment, alreadyProcessed: !result.firstTime };
  }
  const cancelled = outcome === 'cancel';
  const updated = await markPaymentFailed(payment._id, cancelled ? 'CANCELLED' : 'FAILED', cancelled ? 'Simulated: payment cancelled by customer' : 'Simulated: payment failed (insufficient funds)');
  return { payment: updated || (await Payment.findById(payment._id)), alreadyProcessed: false };
}

/** Switch an unpaid online order to another online method before retrying. */
async function switchPaymentMethod(orderId, userId, method) {
  const order = await loadPayableOrder(orderId, userId);
  if (!['RAZORPAY', 'DEMO'].includes(method)) throw ApiError.badRequest('Unsupported payment method');
  if (method === 'DEMO' && !env.DEMO_PAYMENTS_ENABLED) throw ApiError.forbidden('Demo payments are disabled on this server');
  order.paymentMethod = method;
  order.paymentStatus = 'PENDING';
  await order.save();
  return order;
}

module.exports = {
  createRazorpayOrder,
  verifyRazorpay,
  reportRazorpayFailure,
  handleWebhook,
  simulateDemoPayment,
  switchPaymentMethod,
  markPaymentSuccess,
  markPaymentFailed,
};
