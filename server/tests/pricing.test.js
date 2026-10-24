'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { computePricing, evaluateCoupon, effectivePrice } = require('../services/pricing');
const { canTransition, roleCanTransition, isTerminal } = require('../services/orderState');
const { verifyCheckoutSignature, verifyWebhookSignature } = require('../services/signature');

const rest = { deliveryFee: 40, minOrder: 150 };
const welcome = { code: 'WELCOME50', type: 'FLAT', value: 50, minOrder: 199, isActive: true, usedCount: 0, usageLimit: 0, perUserLimit: 1 };
const food10 = { code: 'FOOD10', type: 'PERCENT', value: 10, maxDiscount: 100, minOrder: 299, isActive: true, usedCount: 0 };
const freeship = { code: 'FREESHIP', type: 'FREESHIP', minOrder: 249, isActive: true, usedCount: 0 };

test('effectivePrice uses a valid discounted price only', () => {
  assert.equal(effectivePrice({ price: 200, discountedPrice: 150 }), 150);
  assert.equal(effectivePrice({ price: 200, discountedPrice: null }), 200);
  assert.equal(effectivePrice({ price: 200, discountedPrice: 250 }), 200);
});

test('basic totals: subtotal + delivery + 5% tax', () => {
  const p = computePricing({ lines: [{ unitPrice: 199, quantity: 1 }], restaurant: rest, taxRate: 0.05 });
  assert.equal(p.subtotal, 199);
  assert.equal(p.deliveryFee, 40);
  assert.equal(p.tax, 9.95);
  assert.equal(p.total, 248.95);
  assert.equal(p.totalPaise, 24895);
});

test('free delivery at threshold', () => {
  const p = computePricing({ lines: [{ unitPrice: 250, quantity: 2 }], restaurant: rest, taxRate: 0, freeDeliveryThreshold: 499 });
  assert.equal(p.deliveryFee, 0);
  assert.equal(p.deliveryWaivedByThreshold, true);
});

test('min order shortfall is reported', () => {
  const p = computePricing({ lines: [{ unitPrice: 99, quantity: 1 }], restaurant: rest });
  assert.equal(p.meetsMinOrder, false);
  assert.equal(p.minOrderShortfall, 51);
});

test('flat coupon applies, tax is on discounted amount', () => {
  const p = computePricing({ lines: [{ unitPrice: 299, quantity: 1 }], restaurant: rest, coupon: welcome, taxRate: 0.05 });
  assert.equal(p.discount, 50);
  assert.equal(p.tax, 12.45); // 5% of 249
  assert.equal(p.total, 299 - 50 + 40 + 12.45);
  assert.equal(p.coupon.applied, true);
});

test('percent coupon is capped by maxDiscount', () => {
  const p = computePricing({ lines: [{ unitPrice: 500, quantity: 4 }], restaurant: rest, coupon: food10 });
  assert.equal(p.discount, 100);
});

test('freeship waives delivery; refuses when already free', () => {
  const p = computePricing({ lines: [{ unitPrice: 300, quantity: 1 }], restaurant: rest, coupon: freeship });
  assert.equal(p.deliveryFee, 0);
  assert.equal(p.freeShipping, true);
  const q = computePricing({ lines: [{ unitPrice: 300, quantity: 2 }], restaurant: rest, coupon: freeship, freeDeliveryThreshold: 499 });
  assert.equal(q.coupon.applied, false);
  assert.match(q.coupon.message, /already free/);
});

test('coupon never makes the total negative', () => {
  const huge = { code: 'BIG', type: 'FLAT', value: 5000, isActive: true, usedCount: 0 };
  const p = computePricing({ lines: [{ unitPrice: 100, quantity: 1 }], restaurant: { deliveryFee: 0, minOrder: 0 }, coupon: huge, taxRate: 0.05 });
  assert.equal(p.discount, 100);
  assert.equal(p.total, 0);
});

test('coupon rejections: expired, inactive, min order, limits', () => {
  const ctx = { subtotalPaise: 30000, deliveryFeePaise: 4000, userUses: 0, now: new Date('2026-01-10') };
  assert.equal(evaluateCoupon(null, ctx).code, 'NOT_FOUND');
  assert.equal(evaluateCoupon({ ...welcome, isActive: false }, ctx).code, 'INACTIVE');
  assert.equal(evaluateCoupon({ ...welcome, expiresAt: new Date('2026-01-01') }, ctx).code, 'EXPIRED');
  assert.equal(evaluateCoupon({ ...welcome, startsAt: new Date('2026-02-01') }, ctx).code, 'NOT_STARTED');
  assert.equal(evaluateCoupon({ ...welcome, usageLimit: 5, usedCount: 5 }, ctx).code, 'LIMIT_REACHED');
  assert.equal(evaluateCoupon(welcome, { ...ctx, userUses: 1 }).code, 'USER_LIMIT');
  assert.equal(evaluateCoupon(welcome, { ...ctx, subtotalPaise: 10000 }).code, 'MIN_ORDER');
  assert.equal(evaluateCoupon(welcome, ctx).ok, true);
});

test('invalid coupon leaves pricing unchanged', () => {
  const p = computePricing({ lines: [{ unitPrice: 299, quantity: 1 }], restaurant: rest, coupon: { ...welcome, isActive: false } });
  assert.equal(p.discount, 0);
  assert.equal(p.coupon.applied, false);
});

test('order state machine: valid and invalid transitions', () => {
  assert.equal(canTransition('PENDING', 'CONFIRMED'), true);
  assert.equal(canTransition('PENDING', 'DELIVERED'), false);
  assert.equal(canTransition('DELIVERED', 'CANCELLED'), false);
  assert.equal(isTerminal('REJECTED'), true);
});

test('role permissions on transitions', () => {
  assert.equal(roleCanTransition('customer', 'PENDING', 'CANCELLED'), true);
  assert.equal(roleCanTransition('customer', 'PREPARING', 'CANCELLED'), false);
  assert.equal(roleCanTransition('customer', 'PENDING', 'CONFIRMED'), false);
  assert.equal(roleCanTransition('owner', 'PENDING', 'CONFIRMED'), true);
  assert.equal(roleCanTransition('owner', 'READY_FOR_PICKUP', 'PICKED_UP'), false);
  assert.equal(roleCanTransition('delivery', 'READY_FOR_PICKUP', 'PICKED_UP'), true);
  assert.equal(roleCanTransition('delivery', 'PENDING', 'CONFIRMED'), false);
  assert.equal(roleCanTransition('admin', 'PREPARING', 'CANCELLED'), true);
  assert.equal(roleCanTransition('admin', 'DELIVERED', 'PENDING'), false);
});

test('razorpay checkout signature verification', () => {
  const secret = 'test_secret';
  const sig = crypto.createHmac('sha256', secret).update('order_1|pay_1').digest('hex');
  assert.equal(verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: sig, secret }), true);
  assert.equal(verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_2', signature: sig, secret }), false);
  assert.equal(verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: sig, secret: 'other' }), false);
  assert.equal(verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: '', secret }), false);
});

test('razorpay webhook signature verification', () => {
  const secret = 'whsec';
  const raw = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(verifyWebhookSignature({ rawBody: raw, signature: sig, secret }), true);
  assert.equal(verifyWebhookSignature({ rawBody: Buffer.from('tampered'), signature: sig, secret }), false);
});
