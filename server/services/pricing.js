'use strict';
/**
 * Pure pricing + coupon rules. No database or framework imports so it is unit-testable
 * and shared by the cart preview AND order creation (single source of truth).
 * All arithmetic is done in integer paise to avoid floating point drift.
 */
const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const fromPaise = (paise) => Math.round(paise) / 100;

/** Price actually charged for one unit of a food document/plain object. */
const effectivePrice = (food) =>
  food.discountedPrice != null && food.discountedPrice > 0 && food.discountedPrice < food.price
    ? food.discountedPrice
    : food.price;

/**
 * Decide whether a coupon applies.
 * @param coupon   coupon doc/plain object or null
 * @param ctx      { subtotalPaise, deliveryFeePaise, userUses, now }
 * @returns {{ ok: boolean, code?: string, message: string, discountPaise: number, freeShipping: boolean }}
 */
function evaluateCoupon(coupon, ctx) {
  const fail = (code, message) => ({ ok: false, code, message, discountPaise: 0, freeShipping: false });
  const now = ctx.now || new Date();

  if (!coupon) return fail('NOT_FOUND', 'That coupon code is not valid');
  if (!coupon.isActive) return fail('INACTIVE', 'This coupon is no longer active');
  if (coupon.startsAt && now < new Date(coupon.startsAt)) return fail('NOT_STARTED', 'This coupon is not active yet');
  if (coupon.expiresAt && now > new Date(coupon.expiresAt)) return fail('EXPIRED', 'This coupon has expired');
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return fail('LIMIT_REACHED', 'This coupon has reached its usage limit');
  }
  if (coupon.perUserLimit > 0 && (ctx.userUses || 0) >= coupon.perUserLimit) {
    return fail('USER_LIMIT', 'You have already used this coupon the maximum number of times');
  }
  const minPaise = toPaise(coupon.minOrder || 0);
  if (ctx.subtotalPaise < minPaise) {
    return fail('MIN_ORDER', `Add items worth ₹${fromPaise(minPaise - ctx.subtotalPaise).toFixed(0)} more to use ${coupon.code} (minimum order ₹${coupon.minOrder})`);
  }

  if (coupon.type === 'FREESHIP') {
    if (ctx.deliveryFeePaise <= 0) return fail('NOT_APPLICABLE', 'Delivery is already free on this order');
    return { ok: true, message: `${coupon.code} applied: free delivery`, discountPaise: 0, freeShipping: true };
  }

  let discountPaise;
  if (coupon.type === 'PERCENT') {
    discountPaise = Math.floor((ctx.subtotalPaise * coupon.value) / 100);
    if (coupon.maxDiscount > 0) discountPaise = Math.min(discountPaise, toPaise(coupon.maxDiscount));
  } else {
    discountPaise = toPaise(coupon.value);
    if (coupon.maxDiscount > 0) discountPaise = Math.min(discountPaise, toPaise(coupon.maxDiscount));
  }
  // A coupon can never reduce the food subtotal below zero.
  discountPaise = Math.max(0, Math.min(discountPaise, ctx.subtotalPaise));
  if (discountPaise === 0) return fail('NOT_APPLICABLE', 'This coupon does not reduce the price of this order');
  return {
    ok: true,
    message: `${coupon.code} applied: you save ₹${fromPaise(discountPaise).toFixed(2).replace(/\.00$/, '')}`,
    discountPaise,
    freeShipping: false,
  };
}

/**
 * @param opts.lines          [{ unitPrice (rupees), quantity }]
 * @param opts.restaurant     { deliveryFee, minOrder }
 * @param opts.coupon         optional coupon doc
 * @param opts.userUses       how many times this user already used the coupon
 * @param opts.taxRate        e.g. 0.05
 * @param opts.freeDeliveryThreshold  subtotal at/above which delivery is free (0 disables)
 */
function computePricing(opts) {
  const { lines, restaurant, coupon = null, userUses = 0, taxRate = 0, freeDeliveryThreshold = 0, now } = opts;

  const subtotalPaise = lines.reduce((sum, l) => sum + toPaise(l.unitPrice) * l.quantity, 0);
  const feePaise = toPaise(restaurant ? restaurant.deliveryFee || 0 : 0);
  const thresholdPaise = toPaise(freeDeliveryThreshold || 0);
  const baseDeliveryPaise = thresholdPaise > 0 && subtotalPaise >= thresholdPaise ? 0 : feePaise;

  let couponResult = null;
  let discountPaise = 0;
  let freeShipping = false;
  if (coupon) {
    couponResult = evaluateCoupon(coupon, { subtotalPaise, deliveryFeePaise: baseDeliveryPaise, userUses, now });
    if (couponResult.ok) {
      discountPaise = couponResult.discountPaise;
      freeShipping = couponResult.freeShipping;
    }
  }

  const deliveryPaise = freeShipping ? 0 : baseDeliveryPaise;
  const taxPaise = Math.round(Math.max(0, subtotalPaise - discountPaise) * taxRate);
  const totalPaise = Math.max(0, subtotalPaise - discountPaise + deliveryPaise + taxPaise);
  const minPaise = toPaise(restaurant ? restaurant.minOrder || 0 : 0);

  return {
    subtotalPaise,
    discountPaise,
    deliveryPaise,
    taxPaise,
    totalPaise,
    subtotal: fromPaise(subtotalPaise),
    discount: fromPaise(discountPaise),
    deliveryFee: fromPaise(deliveryPaise),
    tax: fromPaise(taxPaise),
    total: fromPaise(totalPaise),
    freeShipping,
    deliveryWaivedByThreshold: baseDeliveryPaise === 0 && feePaise > 0,
    minOrder: fromPaise(minPaise),
    minOrderShortfall: fromPaise(Math.max(0, minPaise - subtotalPaise)),
    meetsMinOrder: subtotalPaise >= minPaise,
    coupon: couponResult
      ? { code: coupon.code, applied: couponResult.ok, message: couponResult.message, reason: couponResult.code }
      : null,
  };
}

module.exports = { effectivePrice, evaluateCoupon, computePricing };
