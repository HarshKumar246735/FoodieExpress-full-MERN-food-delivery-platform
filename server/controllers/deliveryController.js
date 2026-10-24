'use strict';
const User = require('../models/User');
const Order = require('../models/Order');
const { DeliveryAssignment } = require('../models/misc');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { asyncHandler, parsePagination, paginationMeta, isValidId } = require('../utils/helpers');
const orderService = require('../services/orderService');
const { notify } = require('../services/notificationService');
const { emitTo } = require('../sockets');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const startOfTodayIST = () => {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
};

const MAX_ACTIVE = 3;
const ACTIVE = ['ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'];

function serializeAssignment(a, viewer) {
  const order = a.order && a.order.items ? a.order : null;
  const o = order ? orderService.serializeOrder(order, viewer) : null;
  const mine = a.partner && String(a.partner._id || a.partner) === String(viewer._id);
  const out = {
    id: String(a._id),
    status: a.status,
    earning: a.earning,
    acceptedAt: a.acceptedAt,
    pickedUpAt: a.pickedUpAt,
    deliveredAt: a.deliveredAt,
    createdAt: a.createdAt,
    orderId: String(order ? order._id : a.order),
  };
  if (o) {
    out.order = {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.pricing.total,
      itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
      items: o.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      paymentMethod: o.paymentMethod,
      // Cash to collect only for COD orders.
      collectCash: o.paymentMethod === 'COD' ? o.pricing.total : 0,
      pickup: { name: o.restaurantSnapshot.name, address: o.restaurantSnapshot.address, location: o.restaurantSnapshot.location },
      // Before acceptance partners see only the area, not the customer's full address or phone.
      dropoff: mine
        ? { name: o.address.fullName, phone: o.address.phone, address: `${o.address.house}, ${o.address.street}, ${o.address.city}, ${o.address.state} ${o.address.postalCode}`, city: o.address.city, location: o.address.location }
        : { name: '', phone: '', address: `${o.address.city}, ${o.address.state} ${o.address.postalCode}`, city: o.address.city, location: o.address.location },
      instructions: mine ? o.instructions : '',
    };
  }
  return out;
}

async function loadMyAssignment(req) {
  if (!isValidId(req.params.id)) throw ApiError.notFound('Assignment not found');
  const a = await DeliveryAssignment.findOne({ _id: req.params.id, partner: req.user._id }).populate('order');
  if (!a) throw ApiError.notFound('Assignment not found');
  return a;
}

exports.dashboard = asyncHandler(async (req, res) => {
  const today = startOfTodayIST();
  const mine = { partner: req.user._id };
  const [todayDone, totalDone, earnings, todayEarn, active, daily] = await Promise.all([
    DeliveryAssignment.countDocuments({ ...mine, status: 'DELIVERED', deliveredAt: { $gte: today } }),
    DeliveryAssignment.countDocuments({ ...mine, status: 'DELIVERED' }),
    DeliveryAssignment.aggregate([{ $match: { ...mine, status: 'DELIVERED' } }, { $group: { _id: null, total: { $sum: '$earning' } } }]),
    DeliveryAssignment.aggregate([{ $match: { ...mine, status: 'DELIVERED', deliveredAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$earning' } } }]),
    DeliveryAssignment.countDocuments({ ...mine, status: { $in: ACTIVE } }),
    DeliveryAssignment.aggregate([
      { $match: { ...mine, status: 'DELIVERED', deliveredAt: { $gte: new Date(today.getTime() - 6 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$deliveredAt', timezone: 'Asia/Kolkata' } }, deliveries: { $sum: 1 }, earnings: { $sum: '$earning' } } },
    ]),
  ]);
  const byDay = new Map(daily.map((d) => [d._id, d]));
  const chart = [];
  for (let i = 6; i >= 0; i -= 1) {
    const key = new Date(today.getTime() - i * 86400000 + IST_OFFSET_MS).toISOString().slice(0, 10);
    const v = byDay.get(key);
    chart.push({ date: key, deliveries: v ? v.deliveries : 0, earnings: v ? v.earnings : 0 });
  }
  res.json({
    success: true,
    isOnline: req.user.isOnline,
    vehicle: req.user.vehicle,
    stats: {
      todayDeliveries: todayDone,
      totalDeliveries: totalDone,
      totalEarnings: earnings[0] ? earnings[0].total : 0,
      todayEarnings: todayEarn[0] ? todayEarn[0].total : 0,
      activeDeliveries: active,
      earningPerDelivery: env.DELIVERY_EARNING_PER_ORDER,
    },
    chart,
  });
});

exports.setOnline = asyncHandler(async (req, res) => {
  const online = req.body.isOnline === true || req.body.isOnline === 'true';
  if (!online) {
    const active = await DeliveryAssignment.countDocuments({ partner: req.user._id, status: { $in: ACTIVE } });
    if (active > 0) throw ApiError.conflict('Finish your active deliveries before going offline');
  }
  req.user.isOnline = online;
  await req.user.save({ validateModifiedOnly: true });
  res.json({ success: true, isOnline: online });
});

/** Optional: partner's browser shares real GPS. The customer map shows it ONLY while it is fresh. */
exports.updateLocation = asyncHandler(async (req, res) => {
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw ApiError.badRequest('Invalid coordinates');
  req.user.lastLocation = { lat, lng, at: new Date() };
  await req.user.save({ validateModifiedOnly: true });
  const active = await DeliveryAssignment.find({ partner: req.user._id, status: { $in: ['PICKED_UP', 'OUT_FOR_DELIVERY'] } }).select('order');
  active.forEach((a) => emitTo(`order:${a.order}`, 'delivery:location', { orderId: String(a.order), lat, lng, at: new Date().toISOString(), real: true }));
  res.json({ success: true });
});

exports.listAssignments = asyncHandler(async (req, res) => {
  const scope = req.query.scope || 'available';
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 15, maxLimit: 50 });
  let filter;
  if (scope === 'available') {
    if (!req.user.isOnline) return res.json({ success: true, assignments: [], pagination: paginationMeta(1, limit, 0), offline: true });
    filter = { status: 'AVAILABLE', partner: null, rejectedBy: { $ne: req.user._id } };
  } else if (scope === 'mine') {
    filter = { partner: req.user._id, status: { $in: ACTIVE } };
  } else if (scope === 'history') {
    filter = { partner: req.user._id, status: 'DELIVERED' };
  } else throw ApiError.badRequest('scope must be available, mine or history');

  const [list, total] = await Promise.all([
    DeliveryAssignment.find(filter).sort(scope === 'history' ? { deliveredAt: -1 } : { createdAt: 1 }).skip(skip).limit(limit).populate('order'),
    DeliveryAssignment.countDocuments(filter),
  ]);
  // Eligibility: only orders actually in the kitchen/ready stage are offered.
  const usable = scope === 'available' ? list.filter((a) => a.order && ['PREPARING', 'READY_FOR_PICKUP'].includes(a.order.status)) : list;
  res.json({ success: true, assignments: usable.map((a) => serializeAssignment(a, req.user)), pagination: paginationMeta(page, limit, total) });
});

exports.accept = asyncHandler(async (req, res) => {
  if (!req.user.isOnline) throw ApiError.conflict('Go online to accept deliveries');
  if (!isValidId(req.params.id)) throw ApiError.notFound('Assignment not found');
  const activeCount = await DeliveryAssignment.countDocuments({ partner: req.user._id, status: { $in: ACTIVE } });
  if (activeCount >= MAX_ACTIVE) throw ApiError.conflict(`You can carry at most ${MAX_ACTIVE} active deliveries`);

  const candidate = await DeliveryAssignment.findById(req.params.id).populate('order', 'status');
  if (!candidate || !candidate.order || !['PREPARING', 'READY_FOR_PICKUP'].includes(candidate.order.status)) {
    throw ApiError.conflict('This order is no longer available for pickup');
  }
  // Atomic claim: only one partner can win.
  const claimed = await DeliveryAssignment.findOneAndUpdate(
    { _id: candidate._id, status: 'AVAILABLE', partner: null, rejectedBy: { $ne: req.user._id } },
    { $set: { partner: req.user._id, status: 'ACCEPTED', acceptedAt: new Date() } },
    { new: true }
  ).populate('order');
  if (!claimed) throw ApiError.conflict('Another partner has already accepted this delivery');
  await Order.updateOne({ _id: claimed.order._id }, { $set: { deliveryPartner: req.user._id } });
  const order = await Order.findById(claimed.order._id);
  await notify(order.customer, { title: 'Delivery partner assigned', message: `${req.user.name} will deliver your order ${order.orderNumber}.`, type: 'delivery', order: order._id });
  const restaurantOwner = await require('../models/Restaurant').findById(order.restaurant).select('owner');
  if (restaurantOwner) await notify(restaurantOwner.owner, { title: 'Delivery partner assigned', message: `${req.user.name} will pick up ${order.orderNumber}.`, type: 'delivery', order: order._id });
  require('../sockets').emitOrderUpdate(order);
  emitTo('delivery', 'assignment:update', { orderId: String(order._id) });
  const fresh = await DeliveryAssignment.findById(claimed._id).populate('order');
  res.json({ success: true, assignment: serializeAssignment(fresh, req.user) });
});

/** Reject an offered job, or hand back one you accepted but have not picked up yet. */
exports.reject = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) throw ApiError.notFound('Assignment not found');
  const a = await DeliveryAssignment.findById(req.params.id);
  if (!a) throw ApiError.notFound('Assignment not found');

  if (a.status === 'AVAILABLE' && !a.partner) {
    await DeliveryAssignment.updateOne({ _id: a._id }, { $addToSet: { rejectedBy: req.user._id } });
    return res.json({ success: true, message: 'Assignment hidden from your list' });
  }
  if (String(a.partner) === String(req.user._id) && a.status === 'ACCEPTED') {
    await DeliveryAssignment.updateOne({ _id: a._id, status: 'ACCEPTED' }, { $set: { partner: null, status: 'AVAILABLE', acceptedAt: null }, $addToSet: { rejectedBy: req.user._id } });
    await Order.updateOne({ _id: a.order, deliveryPartner: req.user._id }, { $set: { deliveryPartner: null } });
    emitTo('delivery', 'assignment:new', { orderId: String(a.order) });
    return res.json({ success: true, message: 'Delivery released back to the pool' });
  }
  throw ApiError.conflict('This delivery can no longer be rejected');
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const to = String(req.body.status || '');
  if (!['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(to)) throw ApiError.badRequest('status must be PICKED_UP, OUT_FOR_DELIVERY or DELIVERED');
  const a = await loadMyAssignment(req); // only the assigned partner can update
  if (!ACTIVE.includes(a.status)) throw ApiError.conflict('This delivery is not active');

  // The order state machine enforces the sequence (READY_FOR_PICKUP -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED).
  await orderService.changeStatus(a.order._id, to, { actorUser: req.user, role: 'delivery' });
  const set = { status: to };
  if (to === 'PICKED_UP') set.pickedUpAt = new Date();
  if (to !== 'DELIVERED') await DeliveryAssignment.updateOne({ _id: a._id }, { $set: set });
  const fresh = await DeliveryAssignment.findById(a._id).populate('order');
  res.json({ success: true, assignment: serializeAssignment(fresh, req.user) });
});

void User;
