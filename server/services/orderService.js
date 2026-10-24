'use strict';
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const { Coupon, DeliveryAssignment } = require('../models/misc');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { generateOrderNumber, toPaise } = require('../utils/helpers');
const { roleCanTransition, canTransition, isTerminal } = require('./orderState');
const { priceLines, restaurantBrief } = require('./cartService');
const { notify } = require('./notificationService');
const { emitOrderUpdate, emitTo } = require('../sockets');
const { getRazorpay } = require('../config/razorpay');
const { simulatedDropoff } = require('../utils/geo');

const maskPhone = (p) => (p ? `${'•'.repeat(Math.max(0, p.length - 4))}${p.slice(-4)}` : '');

/* ---------------------------------------------------------------------------------------------
 * Serialization
 * ------------------------------------------------------------------------------------------- */
function serializeOrder(order, viewer) {
  const o = order.toObject ? order.toObject() : order;
  const role = viewer ? viewer.role : 'customer';
  const out = {
    id: String(o._id),
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    restaurant: o.restaurant && o.restaurant._id ? { id: String(o.restaurant._id), name: o.restaurant.name, slug: o.restaurant.slug, logo: o.restaurant.logo } : String(o.restaurant),
    restaurantSnapshot: o.restaurantSnapshot,
    items: o.items.map((i) => ({
      food: String(i.food),
      name: i.name,
      image: i.image,
      isVeg: i.isVeg,
      unitPrice: i.unitPrice,
      originalPrice: i.originalPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    pricing: o.pricing,
    coupon: { code: o.coupon.code, discount: o.coupon.discount, freeShipping: o.coupon.freeShipping },
    address: o.address,
    instructions: o.instructions,
    statusHistory: (o.statusHistory || []).map((h) => ({ status: h.status, at: h.at, note: h.note })),
    rejectionReason: o.rejectionReason,
    cancelReason: o.cancelReason,
    estimatedDeliveryAt: o.estimatedDeliveryAt,
    deliveredAt: o.deliveredAt,
    reviewed: o.reviewed,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
  if (o.customer && o.customer._id) out.customer = { id: String(o.customer._id), name: o.customer.name };
  else out.customer = String(o.customer);

  if (o.deliveryPartner && o.deliveryPartner._id) {
    out.deliveryPartner = { id: String(o.deliveryPartner._id), name: o.deliveryPartner.name, phone: o.deliveryPartner.phone, vehicle: o.deliveryPartner.vehicle };
  }
  // Privacy: delivery partners only see the full customer phone while the delivery is active.
  if (role === 'delivery' && out.address) {
    const active = ['PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(o.status);
    out.address = { ...out.address, phone: active ? out.address.phone : maskPhone(out.address.phone) };
  }
  // Customers never see other users' data; owners do not need the customer's full phone.
  if (role === 'owner' && out.address) out.address = { ...out.address, phone: maskPhone(out.address.phone) };
  return out;
}

/* ---------------------------------------------------------------------------------------------
 * Access control
 * ------------------------------------------------------------------------------------------- */
async function loadOrderForUser(orderId, user, populate = true) {
  let q = Order.findById(orderId);
  if (populate) {
    q = q
      .populate('restaurant', 'name slug logo owner location')
      .populate('customer', 'name')
      .populate('deliveryPartner', 'name phone vehicle');
  }
  const order = await q;
  if (!order) throw ApiError.notFound('Order not found');
  const restaurantOwner = order.restaurant && order.restaurant.owner ? String(order.restaurant.owner) : null;
  const custId = String(order.customer && order.customer._id ? order.customer._id : order.customer);
  const partnerId = order.deliveryPartner ? String(order.deliveryPartner._id || order.deliveryPartner) : null;

  let allowed = false;
  if (user.role === 'admin') allowed = true;
  else if (user.role === 'customer') allowed = custId === String(user._id);
  else if (user.role === 'owner') {
    let ownerId = restaurantOwner;
    if (!ownerId) {
      const r = await Restaurant.findById(order.restaurant).select('owner');
      ownerId = r ? String(r.owner) : null;
    }
    allowed = ownerId === String(user._id);
  } else if (user.role === 'delivery') allowed = partnerId === String(user._id);
  // Same response for "missing" and "not yours" so ids cannot be probed.
  if (!allowed) throw ApiError.notFound('Order not found');
  return order;
}

/* ---------------------------------------------------------------------------------------------
 * Coupons
 * ------------------------------------------------------------------------------------------- */
async function releaseCoupon(orderId) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, 'coupon.code': { $ne: '' }, 'coupon.released': false },
    { $set: { 'coupon.released': true } },
    { new: false }
  );
  if (order && order.coupon.code) {
    await Coupon.updateOne({ code: order.coupon.code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  }
}

/* ---------------------------------------------------------------------------------------------
 * Create order from the logged-in user's server-side cart
 * ------------------------------------------------------------------------------------------- */
async function createOrderFromCart(userId, { addressId, address, saveAddress, instructions, paymentMethod }) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized();
  if (!user.cart.items.length) throw ApiError.badRequest('Your cart is empty');

  const lines = user.cart.items.map((i) => ({ foodId: i.food, quantity: i.quantity }));
  // Always re-price from the database. Nothing price-related comes from the browser.
  const view = await priceLines({ lines, couponCode: user.cart.couponCode, userId: user._id });

  const blocking = view.issues.find((i) => ['REMOVED', 'UNAVAILABLE', 'RESTAURANT_UNAVAILABLE', 'RESTAURANT_CLOSED', 'MIXED_RESTAURANTS'].includes(i.reason));
  if (blocking) throw ApiError.conflict(blocking.message, { code: blocking.reason, data: { issues: view.issues } });
  if (!view.pricing.meetsMinOrder) {
    throw ApiError.badRequest(`Minimum order for ${view.restaurant.name} is ₹${view.pricing.minOrder}. Add ₹${view.pricing.minOrderShortfall} more.`, { code: 'MIN_ORDER' });
  }
  if (view.pricing.coupon && !view.pricing.coupon.applied) {
    throw ApiError.badRequest(view.pricing.coupon.message, { code: 'COUPON_INVALID' });
  }

  // Delivery address: saved one or a new one.
  let addr;
  if (addressId) {
    const saved = user.addresses.id(addressId);
    if (!saved) throw ApiError.badRequest('Selected address was not found');
    addr = saved.toObject();
  } else if (address) {
    addr = address;
    if (saveAddress) {
      user.addresses.push({ ...address, isDefault: user.addresses.length === 0 });
    }
  } else {
    throw ApiError.badRequest('A delivery address is required');
  }

  const restaurant = view.restaurantDoc;
  const pricing = view.pricing;

  // Reserve coupon usage atomically (respects the global usage limit under concurrency).
  let reservedCoupon = null;
  if (view.couponDoc && pricing.coupon && pricing.coupon.applied) {
    reservedCoupon = await Coupon.findOneAndUpdate(
      { _id: view.couponDoc._id, isActive: true, $or: [{ usageLimit: 0 }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
      { $inc: { usedCount: 1 } },
      { new: true }
    );
    if (!reservedCoupon) throw ApiError.conflict('This coupon has just reached its usage limit', { code: 'COUPON_LIMIT' });
  }

  const now = new Date();
  const eta = new Date(now.getTime() + (restaurant.prepTime + 20) * 60 * 1000);
  const items = view.items.map((i) => ({
    food: i._doc._id,
    name: i._doc.name,
    image: i._doc.image,
    isVeg: i._doc.isVeg,
    unitPrice: i.food.unitPrice,
    originalPrice: i._doc.price,
    quantity: i.quantity,
    lineTotal: i.lineTotal,
  }));

  let order = null;
  try {
    for (let attempt = 0; attempt < 4 && !order; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        order = await Order.create({
          orderNumber: generateOrderNumber(now),
          customer: user._id,
          restaurant: restaurant._id,
          restaurantSnapshot: {
            name: restaurant.name,
            logo: restaurant.logo,
            address: [restaurant.address.line, restaurant.address.city].filter(Boolean).join(', '),
            location: restaurant.location,
          },
          items,
          pricing: {
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            deliveryFee: pricing.deliveryFee,
            tax: pricing.tax,
            total: pricing.total,
          },
          coupon: reservedCoupon
            ? { code: reservedCoupon.code, discount: pricing.discount, freeShipping: pricing.freeShipping, released: false }
            : { code: '', discount: 0, freeShipping: false, released: false },
          address: {
            fullName: addr.fullName,
            phone: addr.phone,
            house: addr.house,
            street: addr.street,
            city: addr.city,
            state: addr.state,
            postalCode: addr.postalCode,
            location: simulatedDropoff(restaurant.location, addr.postalCode), // SIMULATED, see utils/geo.js
          },
          instructions: instructions || '',
          paymentMethod,
          paymentStatus: 'PENDING',
          status: 'PENDING',
          statusHistory: [{ status: 'PENDING', at: now, by: user._id, byRole: 'customer', note: 'Order placed' }],
          estimatedDeliveryAt: eta,
        });
      } catch (e) {
        if (e.code !== 11000) throw e; // retry only on order number collisions
      }
    }
    if (!order) throw new Error('Could not generate a unique order number');
  } catch (e) {
    if (reservedCoupon) await Coupon.updateOne({ _id: reservedCoupon._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
    throw e;
  }

  await Payment.create({
    order: order._id,
    user: user._id,
    gateway: paymentMethod === 'COD' ? 'cod' : paymentMethod === 'DEMO' ? 'demo' : 'razorpay',
    amount: toPaise(pricing.total),
    status: 'PENDING',
    transactionRef: paymentMethod === 'COD' ? `COD-${order.orderNumber}` : undefined,
  });

  // Empty the server cart now that the order exists.
  user.cart = { restaurant: null, items: [], couponCode: '' };
  await user.save();

  if (paymentMethod === 'COD') await onOrderVisibleToRestaurant(order);
  return order;
}

/** Called when an order becomes real for the restaurant: COD at creation, online after payment success. */
async function onOrderVisibleToRestaurant(order) {
  const restaurant = await Restaurant.findById(order.restaurant).select('owner name');
  if (restaurant) {
    await notify(restaurant.owner, {
      title: `New order ${order.orderNumber}`,
      message: `${order.items.length} item(s) · ₹${order.pricing.total}`,
      type: 'order',
      order: order._id,
    });
  }
  await notify(order.customer, {
    title: 'Order placed',
    message: `Your order ${order.orderNumber} has been placed. We'll let you know when the restaurant accepts it.`,
    type: 'order',
    order: order._id,
  });
  emitOrderUpdate(order);
}

/* ---------------------------------------------------------------------------------------------
 * Status changes (single choke point, atomic, role-checked)
 * ------------------------------------------------------------------------------------------- */
async function refundIfPaid(order, reason) {
  if (order.paymentMethod === 'COD' || order.paymentStatus !== 'SUCCESS') {
    // Nothing was collected online. A pending/failed online payment just stays as is.
    return;
  }
  const payment = await Payment.findOne({ order: order._id, status: 'SUCCESS' });
  if (!payment) return;
  let refundId = '';
  if (payment.gateway === 'razorpay') {
    const rz = getRazorpay();
    try {
      if (!rz) throw new Error('Razorpay is not configured');
      const refund = await rz.payments.refund(payment.gatewayPaymentId, { amount: payment.amount, notes: { reason, orderNumber: order.orderNumber } });
      refundId = refund.id;
    } catch (e) {
      // Be honest: do not mark REFUNDED when the gateway did not confirm it.
      await Payment.updateOne({ _id: payment._id }, { $set: { failureReason: `Refund could not be completed automatically: ${e.message || 'gateway error'}` } });
      await notify(order.customer, {
        title: 'Refund needs attention',
        message: `We could not auto-refund order ${order.orderNumber}. Support will process it manually.`,
        type: 'payment',
        order: order._id,
      });
      return;
    }
  } else {
    refundId = `DEMO-REFUND-${order.orderNumber}`;
  }
  await Payment.updateOne({ _id: payment._id }, { $set: { status: 'REFUNDED', refundedAt: new Date(), refundId } });
  await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'REFUNDED' } });
  await notify(order.customer, {
    title: 'Refund initiated',
    message: `₹${order.pricing.total} for order ${order.orderNumber} is being refunded.`,
    type: 'payment',
    order: order._id,
  });
}

/**
 * Moves an order to a new status.
 * @param actor { user, role }   role in customer|owner|delivery|admin
 */
async function changeStatus(orderId, to, { actorUser, role, note = '', reason = '' }) {
  const current = await Order.findById(orderId);
  if (!current) throw ApiError.notFound('Order not found');
  if (isTerminal(current.status)) throw ApiError.conflict(`Order is already ${current.status.toLowerCase()}`);
  if (!canTransition(current.status, to)) {
    throw ApiError.conflict(`Cannot change an order from ${current.status} to ${to}`, { code: 'INVALID_TRANSITION' });
  }
  if (!roleCanTransition(role, current.status, to)) {
    throw ApiError.forbidden(`You are not allowed to move an order from ${current.status} to ${to}`);
  }
  // Online orders must be paid before the restaurant can act on them.
  if (role === 'owner' && current.paymentMethod !== 'COD' && current.paymentStatus !== 'SUCCESS') {
    throw ApiError.conflict('This order is still waiting for payment', { code: 'PAYMENT_PENDING' });
  }
  if (to === 'REJECTED' && !reason) throw ApiError.badRequest('A rejection reason is required');

  const set = { status: to };
  if (to === 'REJECTED') set.rejectionReason = reason;
  if (to === 'CANCELLED') set.cancelReason = reason || note || 'Cancelled';
  if (to === 'DELIVERED') set.deliveredAt = new Date();
  if (to === 'CONFIRMED') set.estimatedDeliveryAt = new Date(Date.now() + 45 * 60 * 1000);

  // Compare-and-set on the old status so two simultaneous updates cannot both win.
  const updated = await Order.findOneAndUpdate(
    { _id: current._id, status: current.status },
    {
      $set: set,
      $push: { statusHistory: { status: to, at: new Date(), by: actorUser ? actorUser._id : undefined, byRole: role, note: reason || note } },
    },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('This order was just updated by someone else. Please refresh.', { code: 'STALE' });

  await afterStatusChange(updated, to);
  emitOrderUpdate(updated);
  return updated;
}

const STATUS_MESSAGES = {
  CONFIRMED: ['Order accepted', 'The restaurant accepted your order.'],
  PREPARING: ['Preparing your food', 'The kitchen has started preparing your order.'],
  READY_FOR_PICKUP: ['Ready for pickup', 'Your order is packed and waiting for the delivery partner.'],
  PICKED_UP: ['Order picked up', 'Your delivery partner has picked up your order.'],
  OUT_FOR_DELIVERY: ['Out for delivery', 'Your order is on its way.'],
  DELIVERED: ['Delivered', 'Enjoy your meal! Tap to rate your order.'],
  CANCELLED: ['Order cancelled', 'Your order was cancelled.'],
  REJECTED: ['Order rejected', 'Sorry, the restaurant could not accept your order.'],
};

async function afterStatusChange(order, to) {
  if (to === 'PREPARING') {
    // Order is now eligible for delivery assignment.
    await DeliveryAssignment.updateOne(
      { order: order._id },
      { $setOnInsert: { order: order._id, restaurant: order.restaurant, status: 'AVAILABLE' } },
      { upsert: true }
    );
    emitTo('delivery', 'assignment:new', { orderId: String(order._id) });
  }
  if (to === 'CANCELLED' || to === 'REJECTED') {
    await releaseCoupon(order._id);
    await refundIfPaid(order, to === 'REJECTED' ? 'Rejected by restaurant' : 'Cancelled');
    const asg = await DeliveryAssignment.findOneAndUpdate({ order: order._id, status: { $nin: ['DELIVERED', 'CANCELLED'] } }, { $set: { status: 'CANCELLED' } });
    if (asg && asg.partner) {
      await notify(asg.partner, { title: 'Delivery cancelled', message: `Order ${order.orderNumber} was cancelled.`, type: 'delivery', order: order._id });
    }
    emitTo('delivery', 'assignment:update', { orderId: String(order._id) });
  }
  if (to === 'DELIVERED') {
    // Cash is collected on delivery: only now does a COD payment count as paid.
    if (order.paymentMethod === 'COD') {
      await Payment.updateOne({ order: order._id, gateway: 'cod', status: 'PENDING' }, { $set: { status: 'SUCCESS', paidAt: new Date() } });
      await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'SUCCESS' } });
      order.paymentStatus = 'SUCCESS';
    }
    const asg = await DeliveryAssignment.findOneAndUpdate(
      { order: order._id, status: { $ne: 'DELIVERED' } },
      { $set: { status: 'DELIVERED', deliveredAt: new Date(), earning: env.DELIVERY_EARNING_PER_ORDER } }
    );
    void asg;
  }
  const msg = STATUS_MESSAGES[to];
  if (msg) {
    let text = msg[1];
    if (to === 'REJECTED' && order.rejectionReason) text += ` Reason: ${order.rejectionReason}`;
    await notify(order.customer, { title: msg[0], message: `${order.orderNumber}: ${text}`, type: 'order', order: order._id });
  }
}

/** Cancels online orders whose payment never completed (runs on an interval from server.js). */
async function expireUnpaidOrders(minutes = 30) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const stale = await Order.find({
    status: 'PENDING',
    paymentMethod: { $ne: 'COD' },
    paymentStatus: { $in: ['PENDING', 'FAILED', 'CANCELLED'] },
    createdAt: { $lt: cutoff },
  }).limit(100);
  for (const o of stale) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await changeStatus(o._id, 'CANCELLED', { role: 'admin', reason: 'Payment was not completed in time' });
    } catch (e) {
      /* someone else updated it; ignore */
    }
  }
  return stale.length;
}

module.exports = {
  serializeOrder,
  loadOrderForUser,
  createOrderFromCart,
  changeStatus,
  releaseCoupon,
  refundPaidOrder: refundIfPaid,
  onOrderVisibleToRestaurant,
  expireUnpaidOrders,
  maskPhone,
  restaurantBrief,
};
