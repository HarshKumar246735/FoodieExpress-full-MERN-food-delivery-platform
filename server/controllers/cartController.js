'use strict';
const User = require('../models/User');
const Food = require('../models/Food');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('../utils/helpers');
const { buildCartView, priceLines, stripInternal } = require('../services/cartService');

const respond = async (res, user) => {
  const fresh = await User.findById(user._id);
  res.json({ success: true, cart: await buildCartView(fresh) });
};

exports.getCart = asyncHandler(async (req, res) => {
  const cart = await buildCartView(req.user);
  res.json({ success: true, cart });
});

/** Guests keep their cart in the browser; this prices it using the same server rules. */
exports.preview = asyncHandler(async (req, res) => {
  const lines = (req.body.items || []).map((i) => ({ foodId: i.foodId, quantity: Number(i.quantity) }));
  if (!lines.length) return res.json({ success: true, cart: await buildCartView({ cart: { items: [], couponCode: '' } }) });
  const view = await priceLines({ lines, couponCode: req.body.couponCode, userId: req.user ? req.user._id : null });
  res.json({ success: true, cart: { ...stripInternal(view), couponCode: req.body.couponCode || '' } });
});

exports.addItem = asyncHandler(async (req, res) => {
  const { foodId, replace } = req.body;
  const quantity = Number(req.body.quantity || 1);
  const food = await Food.findById(foodId).populate('restaurant', 'name approvalStatus');
  if (!food || !food.restaurant || food.restaurant.approvalStatus !== 'approved') throw ApiError.notFound('Food item not found');
  if (!food.isAvailable) throw ApiError.conflict(`${food.name} is currently unavailable`, { code: 'UNAVAILABLE' });

  const user = req.user;
  const cartRestaurant = user.cart.restaurant ? String(user.cart.restaurant) : null;
  if (cartRestaurant && cartRestaurant !== String(food.restaurant._id) && user.cart.items.length > 0) {
    if (!(replace === true || replace === 'true')) {
      const current = await require('../models/Restaurant').findById(cartRestaurant).select('name');
      throw ApiError.conflict('Your cart has items from another restaurant', {
        code: 'CART_RESTAURANT_CONFLICT',
        data: { currentRestaurant: current ? current.name : 'another restaurant', newRestaurant: food.restaurant.name },
      });
    }
    user.cart.items = [];
    user.cart.couponCode = '';
  }
  user.cart.restaurant = food.restaurant._id;
  const existing = user.cart.items.find((i) => String(i.food) === String(food._id));
  if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
  else user.cart.items.push({ food: food._id, quantity: Math.min(20, quantity) });
  await user.save();
  await respond(res, user);
});

exports.updateItem = asyncHandler(async (req, res) => {
  const user = req.user;
  const qty = Number(req.body.quantity);
  const item = user.cart.items.find((i) => String(i.food) === String(req.params.foodId));
  if (!item) throw ApiError.notFound('Item is not in your cart');
  if (qty === 0) user.cart.items = user.cart.items.filter((i) => String(i.food) !== String(req.params.foodId));
  else item.quantity = qty;
  if (user.cart.items.length === 0) {
    user.cart.restaurant = null;
    user.cart.couponCode = '';
  }
  await user.save();
  await respond(res, user);
});

exports.removeItem = asyncHandler(async (req, res) => {
  const user = req.user;
  user.cart.items = user.cart.items.filter((i) => String(i.food) !== String(req.params.foodId));
  if (user.cart.items.length === 0) {
    user.cart.restaurant = null;
    user.cart.couponCode = '';
  }
  await user.save();
  await respond(res, user);
});

exports.clear = asyncHandler(async (req, res) => {
  req.user.cart = { restaurant: null, items: [], couponCode: '' };
  await req.user.save();
  await respond(res, req.user);
});

exports.applyCoupon = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user.cart.items.length) throw ApiError.badRequest('Add items to your cart before applying a coupon');
  const code = String(req.body.code).trim().toUpperCase();
  const previous = user.cart.couponCode;
  user.cart.couponCode = code;
  const view = await buildCartView(user);
  // Reject invalid coupons with a helpful message and keep the previous state.
  if (view.pricing.coupon && !view.pricing.coupon.applied) {
    user.cart.couponCode = previous;
    throw ApiError.badRequest(view.pricing.coupon.message, { code: 'COUPON_INVALID' });
  }
  await user.save();
  res.json({ success: true, message: view.pricing.coupon.message, cart: view });
});

exports.removeCoupon = asyncHandler(async (req, res) => {
  req.user.cart.couponCode = '';
  await req.user.save();
  await respond(res, req.user);
});

/** After login: merge the guest (browser) cart into the server cart. */
exports.merge = asyncHandler(async (req, res) => {
  const user = req.user;
  const incoming = (req.body.items || []).slice(0, 40);
  if (incoming.length && user.cart.items.length === 0) {
    const foods = await Food.find({ _id: { $in: incoming.map((i) => i.foodId) }, isAvailable: true });
    const restaurantId = foods.length ? String(foods[0].restaurant) : null;
    const usable = foods.filter((f) => String(f.restaurant) === restaurantId);
    const qtyById = new Map(incoming.map((i) => [String(i.foodId), Math.min(20, Math.max(1, Number(i.quantity) || 1))]));
    user.cart.items = usable.map((f) => ({ food: f._id, quantity: qtyById.get(String(f._id)) }));
    user.cart.restaurant = usable.length ? usable[0].restaurant : null;
    if (req.body.couponCode && usable.length) user.cart.couponCode = String(req.body.couponCode).toUpperCase().slice(0, 24);
    await user.save();
  }
  await respond(res, user);
});
