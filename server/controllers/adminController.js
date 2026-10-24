'use strict';
const User = require('../models/User');
const Category = require('../models/Category');
const Restaurant = require('../models/Restaurant');
const Food = require('../models/Food');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { Review, Coupon, Complaint, AuditLog, DeliveryAssignment } = require('../models/misc');
const ApiError = require('../utils/ApiError');
const { asyncHandler, slugify, escapeRegex, pick, isValidId, parsePagination, paginationMeta } = require('../utils/helpers');
const orderService = require('../services/orderService');
const { audit, notify } = require('../services/notificationService');
const { serializeRestaurant } = require('./catalogController');
const { defaultHours } = require('../utils/geo');

const rx = (s) => new RegExp(escapeRegex(String(s).slice(0, 60)), 'i');
const needId = (id, what = 'record') => {
  if (!isValidId(id)) throw ApiError.notFound(`${what} not found`);
};

/* ------------------------- dashboard ------------------------- */
exports.dashboard = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 29 * 86400000);
  const todayStart = new Date(Date.now() + 5.5 * 3600000);
  todayStart.setUTCHours(0, 0, 0, 0);
  const today = new Date(todayStart.getTime() - 5.5 * 3600000);

  const [users, customers, restaurants, pendingRestaurants, foods, orders, completed, cancelled, revenue, todayRevenue, statusAgg, daily, recentTx, partnersOnline, openComplaints, pendingOrders] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    Restaurant.countDocuments({ approvalStatus: 'approved' }),
    Restaurant.countDocuments({ approvalStatus: 'pending' }),
    Food.countDocuments(),
    Order.countDocuments(),
    Order.countDocuments({ status: 'DELIVERED' }),
    Order.countDocuments({ status: { $in: ['CANCELLED', 'REJECTED'] } }),
    Order.aggregate([{ $match: { status: 'DELIVERED' } }, { $group: { _id: null, total: { $sum: '$pricing.total' } } }]),
    Order.aggregate([{ $match: { status: 'DELIVERED', deliveredAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$pricing.total' } } }]),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { status: 'DELIVERED', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, sales: { $sum: '$pricing.total' }, orders: { $sum: 1 } } },
    ]),
    Payment.find().sort({ createdAt: -1 }).limit(8).populate('order', 'orderNumber').populate('user', 'name'),
    User.countDocuments({ role: 'delivery', isOnline: true }),
    Complaint.countDocuments({ status: { $ne: 'resolved' } }),
    Order.countDocuments({ status: 'PENDING' }),
  ]);

  const byDay = new Map(daily.map((d) => [d._id, d]));
  const chart = [];
  for (let i = 29; i >= 0; i -= 1) {
    const key = new Date(today.getTime() - i * 86400000 + 5.5 * 3600000).toISOString().slice(0, 10);
    const v = byDay.get(key);
    chart.push({ date: key, sales: v ? Math.round(v.sales) : 0, orders: v ? v.orders : 0 });
  }
  res.json({
    success: true,
    stats: {
      totalUsers: users,
      customers,
      totalRestaurants: restaurants,
      pendingRestaurants,
      totalFoods: foods,
      totalOrders: orders,
      completedOrders: completed,
      cancelledOrders: cancelled,
      pendingOrders,
      totalRevenue: revenue[0] ? Math.round(revenue[0].total * 100) / 100 : 0,
      todayRevenue: todayRevenue[0] ? Math.round(todayRevenue[0].total * 100) / 100 : 0,
      partnersOnline,
      openComplaints,
    },
    statusChart: statusAgg.map((s) => ({ status: s._id, count: s.n })),
    salesChart: chart,
    recentTransactions: recentTx.map((p) => ({ id: String(p._id), gateway: p.gateway, status: p.status, amount: p.amount / 100, order: p.order ? p.order.orderNumber : '', user: p.user ? p.user.name : '', ref: p.transactionRef || p.gatewayPaymentId || '', createdAt: p.createdAt })),
  });
});

/* ------------------------- users ------------------------- */
const serializeUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, phone: u.phone || '', role: u.role, status: u.status, isOnline: u.isOnline, isDemo: u.isDemo, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt });

exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 15 });
  const filter = {};
  if (req.query.role && ['customer', 'owner', 'delivery', 'admin'].includes(req.query.role)) filter.role = req.query.role;
  if (req.query.status && ['active', 'suspended'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.q) filter.$or = [{ name: rx(req.query.q) }, { email: rx(req.query.q) }];
  const [list, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), User.countDocuments(filter)]);
  res.json({ success: true, users: list.map(serializeUser), pagination: paginationMeta(page, limit, total) });
});

exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  if (!['customer', 'owner', 'delivery', 'admin'].includes(role)) throw ApiError.badRequest('Invalid role');
  if (await User.findOne({ email })) throw ApiError.conflict('An account with this email already exists');
  const user = await User.create({ name, email, phone: phone || undefined, password, role, vehicle: role === 'delivery' ? req.body.vehicle || '' : '' });
  await audit(req, 'user.create', 'User', user._id, { role, email });
  res.status(201).json({ success: true, user: serializeUser(user) });
});

exports.updateUser = asyncHandler(async (req, res) => {
  needId(req.params.id, 'User');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  const isSelf = String(user._id) === String(req.user._id);
  const { status, role } = req.body;
  if (isSelf && ((status && status !== 'active') || (role && role !== 'admin'))) throw ApiError.badRequest('You cannot suspend or demote your own account');
  const before = { status: user.status, role: user.role };
  if (req.body.name) user.name = req.body.name;
  if (req.body.phone !== undefined) user.phone = req.body.phone || undefined;
  if (status && ['active', 'suspended'].includes(status)) user.status = status;
  if (role && ['customer', 'owner', 'delivery', 'admin'].includes(role)) user.role = role;
  if (user.status === 'suspended') user.isOnline = false;
  await user.save({ validateModifiedOnly: true });
  await audit(req, status && status !== before.status ? `user.${status === 'suspended' ? 'suspend' : 'activate'}` : 'user.update', 'User', user._id, { before, after: { status: user.status, role: user.role } });
  res.json({ success: true, user: serializeUser(user) });
});

exports.listDeliveryPartners = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 15 });
  const filter = { role: 'delivery' };
  if (req.query.q) filter.$or = [{ name: rx(req.query.q) }, { email: rx(req.query.q) }];
  if (req.query.online === 'true') filter.isOnline = true;
  const [list, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), User.countDocuments(filter)]);
  const stats = await DeliveryAssignment.aggregate([
    { $match: { partner: { $in: list.map((u) => u._id) }, status: 'DELIVERED' } },
    { $group: { _id: '$partner', deliveries: { $sum: 1 }, earnings: { $sum: '$earning' } } },
  ]);
  const map = new Map(stats.map((s) => [String(s._id), s]));
  res.json({
    success: true,
    partners: list.map((u) => ({ ...serializeUser(u), vehicle: u.vehicle, deliveries: (map.get(String(u._id)) || {}).deliveries || 0, earnings: (map.get(String(u._id)) || {}).earnings || 0 })),
    pagination: paginationMeta(page, limit, total),
  });
});

/* ------------------------- restaurants ------------------------- */
exports.listRestaurants = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 15 });
  const filter = {};
  if (['pending', 'approved', 'rejected'].includes(req.query.status)) filter.approvalStatus = req.query.status;
  if (req.query.q) filter.$or = [{ name: rx(req.query.q) }, { cuisines: rx(req.query.q) }];
  const [list, total] = await Promise.all([Restaurant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('owner', 'name email'), Restaurant.countDocuments(filter)]);
  const counts = await Food.aggregate([{ $match: { restaurant: { $in: list.map((r) => r._id) } } }, { $group: { _id: '$restaurant', n: { $sum: 1 } } }]);
  const cmap = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({
    success: true,
    restaurants: list.map((r) => ({ ...serializeRestaurant(r), rejectionReason: r.rejectionReason, owner: r.owner ? { id: String(r.owner._id), name: r.owner.name, email: r.owner.email } : null, menuItems: cmap.get(String(r._id)) || 0, createdAt: r.createdAt })),
    pagination: paginationMeta(page, limit, total),
  });
});

exports.createRestaurant = asyncHandler(async (req, res) => {
  const owner = await User.findOne({ _id: req.body.ownerId, role: 'owner' });
  if (!owner) throw ApiError.badRequest('Choose a user with the owner role');
  let slug = slugify(req.body.name);
  if (await Restaurant.exists({ slug })) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const r = await Restaurant.create({
    owner: owner._id,
    name: req.body.name,
    slug,
    description: req.body.description || '',
    cuisines: Array.isArray(req.body.cuisines) ? req.body.cuisines : String(req.body.cuisines || '').split(',').map((s) => s.trim()).filter(Boolean),
    address: pick(req.body.address || {}, ['line', 'city', 'state', 'postalCode']),
    openingHours: defaultHours(),
    approvalStatus: req.body.approve ? 'approved' : 'pending',
  });
  await audit(req, 'restaurant.create', 'Restaurant', r._id, { owner: owner.email });
  res.status(201).json({ success: true, restaurant: serializeRestaurant(r) });
});

exports.setApproval = asyncHandler(async (req, res) => {
  needId(req.params.id, 'Restaurant');
  const { approvalStatus, reason } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) throw ApiError.badRequest('Invalid approval status');
  if (approvalStatus === 'rejected' && !reason) throw ApiError.badRequest('Please give a reason for rejecting this restaurant');
  const r = await Restaurant.findByIdAndUpdate(req.params.id, { $set: { approvalStatus, rejectionReason: approvalStatus === 'rejected' ? reason : '' } }, { new: true });
  if (!r) throw ApiError.notFound('Restaurant not found');
  await audit(req, `restaurant.${approvalStatus}`, 'Restaurant', r._id, { reason });
  await notify(r.owner, { title: `Restaurant ${approvalStatus}`, message: approvalStatus === 'approved' ? `${r.name} is now live on FoodieExpress.` : `${r.name} was ${approvalStatus}.${reason ? ` Reason: ${reason}` : ''}`, type: 'restaurant' });
  res.json({ success: true, restaurant: serializeRestaurant(r) });
});

/* ------------------------- orders ------------------------- */
exports.listOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 15 });
  const filter = {};
  if (req.query.status && Order.STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.paymentStatus && Order.PAYMENT_STATUSES.includes(req.query.paymentStatus)) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.paymentMethod && ['COD', 'RAZORPAY', 'DEMO'].includes(req.query.paymentMethod)) filter.paymentMethod = req.query.paymentMethod;
  if (req.query.q) filter.orderNumber = rx(req.query.q);
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }
  const [list, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('customer', 'name').populate('restaurant', 'name slug logo').populate('deliveryPartner', 'name phone vehicle'),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, orders: list.map((o) => orderService.serializeOrder(o, req.user)), pagination: paginationMeta(page, limit, total) });
});

exports.cancelOrder = asyncHandler(async (req, res) => {
  needId(req.params.id, 'Order');
  const updated = await orderService.changeStatus(req.params.id, 'CANCELLED', { actorUser: req.user, role: 'admin', reason: String(req.body.reason || 'Cancelled by admin').slice(0, 200) });
  await audit(req, 'order.cancel', 'Order', updated._id, { reason: req.body.reason });
  res.json({ success: true, order: orderService.serializeOrder(updated, req.user) });
});

/* ------------------------- categories ------------------------- */
exports.listCategories = asyncHandler(async (req, res) => {
  const cats = await Category.find().sort({ sortOrder: 1, name: 1 });
  const counts = await Food.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ success: true, categories: cats.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug, description: c.description, image: c.image, sortOrder: c.sortOrder, isActive: c.isActive, itemCount: map.get(String(c._id)) || 0 })) });
});
exports.createCategory = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (name.length < 2) throw ApiError.badRequest('Category name is required');
  const c = await Category.create({ name, slug: slugify(name), description: req.body.description || '', image: req.body.image || '', sortOrder: Number(req.body.sortOrder) || 0 });
  await audit(req, 'category.create', 'Category', c._id, { name });
  res.status(201).json({ success: true, category: c });
});
exports.updateCategory = asyncHandler(async (req, res) => {
  needId(req.params.id, 'Category');
  const c = await Category.findById(req.params.id);
  if (!c) throw ApiError.notFound('Category not found');
  Object.assign(c, pick(req.body, ['description', 'image', 'sortOrder', 'isActive']));
  if (req.body.name) {
    c.name = req.body.name;
    c.slug = slugify(req.body.name);
  }
  await c.save();
  await audit(req, 'category.update', 'Category', c._id, pick(req.body, ['name', 'isActive']));
  res.json({ success: true, category: c });
});
exports.deleteCategory = asyncHandler(async (req, res) => {
  needId(req.params.id, 'Category');
  if (await Food.exists({ category: req.params.id })) throw ApiError.conflict('This category still has food items. Move or delete them first, or deactivate the category instead.');
  const c = await Category.findByIdAndDelete(req.params.id);
  if (!c) throw ApiError.notFound('Category not found');
  await audit(req, 'category.delete', 'Category', c._id, { name: c.name });
  res.json({ success: true });
});

/* ------------------------- coupons ------------------------- */
const couponFields = ['description', 'type', 'value', 'minOrder', 'maxDiscount', 'usageLimit', 'perUserLimit', 'isActive'];
exports.listCoupons = asyncHandler(async (req, res) => {
  const list = await Coupon.find().sort({ createdAt: -1 });
  res.json({ success: true, coupons: list });
});
exports.createCoupon = asyncHandler(async (req, res) => {
  const data = pick(req.body, couponFields);
  if (data.type === 'PERCENT' && Number(data.value) > 100) throw ApiError.badRequest('A percentage cannot exceed 100');
  const c = await Coupon.create({ ...data, code: String(req.body.code).toUpperCase(), expiresAt: req.body.expiresAt || null, startsAt: req.body.startsAt || null });
  await audit(req, 'coupon.create', 'Coupon', c._id, { code: c.code });
  res.status(201).json({ success: true, coupon: c });
});
exports.updateCoupon = asyncHandler(async (req, res) => {
  needId(req.params.id, 'Coupon');
  const c = await Coupon.findById(req.params.id);
  if (!c) throw ApiError.notFound('Coupon not found');
  Object.assign(c, pick(req.body, couponFields));
  if (req.body.expiresAt !== undefined) c.expiresAt = req.body.expiresAt || null;
  if (req.body.startsAt !== undefined) c.startsAt = req.body.startsAt || null;
  if (c.type === 'PERCENT' && c.value > 100) throw ApiError.badRequest('A percentage cannot exceed 100');
  await c.save();
  await audit(req, 'coupon.update', 'Coupon', c._id, pick(req.body, ['isActive', 'value']));
  res.json({ success: true, coupon: c });
});
exports.deleteCoupon = asyncHandler(async (req, res) => {
  needId(req.params.id, 'Coupon');
  const c = await Coupon.findByIdAndDelete(req.params.id);
  if (!c) throw ApiError.notFound('Coupon not found');
  await audit(req, 'coupon.delete', 'Coupon', c._id, { code: c.code });
  res.json({ success: true });
});

/* ------------------------- reviews & complaints ------------------------- */
async function recomputeRating(restaurantId) {
  const agg = await Review.aggregate([{ $match: { restaurant: restaurantId, status: 'visible' } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  await Restaurant.updateOne({ _id: restaurantId }, { $set: { rating: agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0, reviewCount: agg[0] ? agg[0].n : 0 } });
}

exports.listReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 15 });
  const filter = {};
  if (['visible', 'hidden'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.rating) filter.rating = Number(req.query.rating);
  const [list, total] = await Promise.all([Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name').populate('restaurant', 'name'), Review.countDocuments(filter)]);
  res.json({ success: true, reviews: list.map((v) => ({ id: String(v._id), rating: v.rating, comment: v.comment, status: v.status, user: v.user ? v.user.name : 'Customer', restaurant: v.restaurant ? v.restaurant.name : '', createdAt: v.createdAt })), pagination: paginationMeta(page, limit, total) });
});
exports.moderateReview = asyncHandler(async (req, res) => {
  needId(req.params.id, 'Review');
  if (!['visible', 'hidden'].includes(req.body.status)) throw ApiError.badRequest('status must be visible or hidden');
  const v = await Review.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true });
  if (!v) throw ApiError.notFound('Review not found');
  await recomputeRating(v.restaurant);
  await audit(req, `review.${req.body.status}`, 'Review', v._id);
  res.json({ success: true });
});
exports.deleteReview = asyncHandler(async (req, res) => {
  needId(req.params.id, 'Review');
  const v = await Review.findByIdAndDelete(req.params.id);
  if (!v) throw ApiError.notFound('Review not found');
  await recomputeRating(v.restaurant);
  await audit(req, 'review.delete', 'Review', v._id);
  res.json({ success: true });
});

exports.listComplaints = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 15 });
  const filter = {};
  if (['open', 'in_review', 'resolved'].includes(req.query.status)) filter.status = req.query.status;
  const [list, total] = await Promise.all([Complaint.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name email').populate('order', 'orderNumber'), Complaint.countDocuments(filter)]);
  res.json({ success: true, complaints: list.map((c) => ({ id: String(c._id), subject: c.subject, message: c.message, status: c.status, adminResponse: c.adminResponse, user: c.user ? { name: c.user.name, email: c.user.email } : null, order: c.order ? c.order.orderNumber : '', createdAt: c.createdAt })), pagination: paginationMeta(page, limit, total) });
});
exports.updateComplaint = asyncHandler(async (req, res) => {
  needId(req.params.id, 'Complaint');
  const c = await Complaint.findById(req.params.id);
  if (!c) throw ApiError.notFound('Complaint not found');
  if (req.body.status && ['open', 'in_review', 'resolved'].includes(req.body.status)) c.status = req.body.status;
  if (req.body.adminResponse !== undefined) c.adminResponse = String(req.body.adminResponse).slice(0, 1000);
  if (c.status === 'resolved') c.resolvedBy = req.user._id;
  await c.save();
  await audit(req, 'complaint.update', 'Complaint', c._id, { status: c.status });
  if (c.adminResponse) await notify(c.user, { title: 'Update on your complaint', message: c.adminResponse.slice(0, 200), type: 'complaint' });
  res.json({ success: true });
});

/* ------------------------- transactions & audit ------------------------- */
exports.listTransactions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 15 });
  const filter = {};
  if (['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(req.query.status)) filter.status = req.query.status;
  if (['razorpay', 'demo', 'cod'].includes(req.query.gateway)) filter.gateway = req.query.gateway;
  const [list, total] = await Promise.all([Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('order', 'orderNumber').populate('user', 'name'), Payment.countDocuments(filter)]);
  res.json({ success: true, transactions: list.map((p) => ({ id: String(p._id), gateway: p.gateway, status: p.status, amount: p.amount / 100, order: p.order ? p.order.orderNumber : '', user: p.user ? p.user.name : '', ref: p.transactionRef || p.gatewayPaymentId || '', failureReason: p.failureReason, createdAt: p.createdAt })), pagination: paginationMeta(page, limit, total) });
});

exports.listAudit = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.q) filter.$or = [{ action: rx(req.query.q) }, { actorEmail: rx(req.query.q) }, { entity: rx(req.query.q) }];
  const [list, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), AuditLog.countDocuments(filter)]);
  res.json({ success: true, logs: list.map((l) => ({ id: String(l._id), actor: l.actorEmail, action: l.action, entity: l.entity, entityId: l.entityId, meta: l.meta, createdAt: l.createdAt })), pagination: paginationMeta(page, limit, total) });
});
