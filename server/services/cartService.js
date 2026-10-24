'use strict';
const Food = require('../models/Food');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const { Coupon } = require('../models/misc');
const env = require('../config/env');
const { computePricing, effectivePrice } = require('./pricing');
const { isRestaurantOpenNow } = require('../utils/hours');

/** How many times a user has used a coupon on orders that are still "live" (not cancelled/rejected/payment-failed). */
async function countUserCouponUses(userId, code) {
  if (!userId) return 0;
  return Order.countDocuments({
    customer: userId,
    'coupon.code': code,
    status: { $nin: ['CANCELLED', 'REJECTED'] },
    paymentStatus: { $nin: ['FAILED', 'CANCELLED', 'REFUNDED'] },
  });
}

const restaurantBrief = (r) =>
  r
    ? {
        id: String(r._id),
        name: r.name,
        slug: r.slug,
        logo: r.logo,
        deliveryFee: r.deliveryFee,
        minOrder: r.minOrder,
        prepTime: r.prepTime,
        isOpenNow: isRestaurantOpenNow(r),
        approved: r.approvalStatus === 'approved',
      }
    : null;

const foodBrief = (f) => ({
  id: String(f._id),
  name: f.name,
  slug: f.slug,
  image: f.image,
  isVeg: f.isVeg,
  price: f.price,
  discountedPrice: f.discountedPrice,
  unitPrice: effectivePrice(f),
  isAvailable: f.isAvailable,
});

/**
 * Prices a set of [{foodId, quantity}] lines from trusted DB records.
 * Used by: cart preview (guest + logged in) and order creation. Never trusts browser prices.
 */
async function priceLines({ lines, couponCode, userId }) {
  const ids = lines.map((l) => l.foodId);
  const foods = await Food.find({ _id: { $in: ids } });
  const byId = new Map(foods.map((f) => [String(f._id), f]));

  const items = [];
  const issues = [];
  let restaurantId = null;
  for (const line of lines) {
    const f = byId.get(String(line.foodId));
    if (!f) {
      issues.push({ foodId: String(line.foodId), reason: 'REMOVED', message: 'An item is no longer on the menu' });
      continue;
    }
    if (!restaurantId) restaurantId = String(f.restaurant);
    const unavailable = !f.isAvailable;
    if (unavailable) issues.push({ foodId: String(f._id), reason: 'UNAVAILABLE', message: `${f.name} is currently unavailable` });
    items.push({
      food: foodBrief(f),
      quantity: line.quantity,
      lineTotal: Math.round(effectivePrice(f) * line.quantity * 100) / 100,
      unavailable,
      _doc: f,
    });
  }

  const restaurant = restaurantId ? await Restaurant.findById(restaurantId) : null;
  if (restaurant) {
    if (restaurant.approvalStatus !== 'approved') issues.push({ reason: 'RESTAURANT_UNAVAILABLE', message: `${restaurant.name} is not accepting orders` });
    else if (!isRestaurantOpenNow(restaurant)) issues.push({ reason: 'RESTAURANT_CLOSED', message: `${restaurant.name} is currently closed` });
  }
  const mixed = new Set(items.map((i) => String(i._doc.restaurant))).size > 1;
  if (mixed) issues.push({ reason: 'MIXED_RESTAURANTS', message: 'Your cart contains items from different restaurants' });

  let coupon = null;
  let userUses = 0;
  if (couponCode) {
    coupon = await Coupon.findOne({ code: String(couponCode).trim().toUpperCase() });
    if (coupon) userUses = await countUserCouponUses(userId, coupon.code);
    else coupon = { code: String(couponCode).toUpperCase(), isActive: false }; // surfaces "not valid" message
  }

  const priced = computePricing({
    lines: items.filter((i) => !i.unavailable).map((i) => ({ unitPrice: i.food.unitPrice, quantity: i.quantity })),
    restaurant,
    coupon,
    userUses,
    taxRate: env.TAX_RATE,
    freeDeliveryThreshold: env.FREE_DELIVERY_THRESHOLD,
  });
  // Unknown code: computePricing reports INACTIVE; make the message accurate.
  if (couponCode && priced.coupon && !coupon.type) priced.coupon = { code: coupon.code, applied: false, reason: 'NOT_FOUND', message: 'That coupon code is not valid' };

  return {
    restaurant: restaurantBrief(restaurant),
    restaurantDoc: restaurant,
    couponDoc: coupon && coupon.type ? coupon : null,
    items,
    issues,
    pricing: priced,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
  };
}

const stripInternal = (view) => ({
  restaurant: view.restaurant,
  items: view.items.map(({ _doc, ...rest }) => rest),
  issues: view.issues,
  pricing: view.pricing,
  itemCount: view.itemCount,
});

async function buildCartView(user) {
  const lines = (user.cart.items || []).map((i) => ({ foodId: i.food, quantity: i.quantity }));
  if (lines.length === 0) {
    return {
      restaurant: null,
      items: [],
      issues: [],
      itemCount: 0,
      couponCode: '',
      pricing: computePricing({ lines: [], restaurant: null, taxRate: env.TAX_RATE }),
    };
  }
  const view = await priceLines({ lines, couponCode: user.cart.couponCode, userId: user._id });
  return { ...stripInternal(view), couponCode: user.cart.couponCode || '' };
}

module.exports = { priceLines, buildCartView, stripInternal, countUserCouponUses, restaurantBrief, foodBrief };
