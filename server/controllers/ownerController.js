'use strict';
const crypto = require('crypto');
const Food = require('../models/Food');
const Order = require('../models/Order');
const Category = require('../models/Category');
const Restaurant = require('../models/Restaurant');
const { Review } = require('../models/misc');
const ApiError = require('../utils/ApiError');
const { asyncHandler, slugify, pick, isValidId, parsePagination, paginationMeta } = require('../utils/helpers');
const orderService = require('../services/orderService');
const { storeImage } = require('../middleware/upload');
const { serializeFood, serializeRestaurant } = require('./catalogController');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const startOfTodayIST = () => {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
};

// An order only reaches the kitchen once it is COD, or the online payment succeeded.
const VISIBLE = { $or: [{ paymentMethod: 'COD' }, { paymentStatus: { $in: ['SUCCESS', 'REFUNDED'] } }] };

/** Resolves which of the owner's restaurants a request is about; ownership is enforced here. */
async function ownedRestaurant(req, { requireApproved = true } = {}) {
  const wanted = req.query.restaurant || req.body.restaurant;
  const filter = { owner: req.user._id };
  if (wanted) {
    if (!isValidId(wanted)) throw ApiError.badRequest('Invalid restaurant');
    filter._id = wanted;
  }
  const r = await Restaurant.findOne(filter).sort({ createdAt: 1 });
  if (!r) throw ApiError.notFound('Restaurant not found');
  if (requireApproved && r.approvalStatus !== 'approved') {
    throw ApiError.forbidden(`Your restaurant is ${r.approvalStatus}. You can manage the menu and orders once an admin approves it.`, { code: 'NOT_APPROVED' });
  }
  return r;
}

exports.myRestaurants = asyncHandler(async (req, res) => {
  const list = await Restaurant.find({ owner: req.user._id }).sort({ createdAt: 1 });
  res.json({ success: true, restaurants: list.map(serializeRestaurant) });
});

exports.dashboard = asyncHandler(async (req, res) => {
  const r = await ownedRestaurant(req);
  const today = startOfTodayIST();
  const since14 = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);
  const base = { restaurant: r._id, ...VISIBLE };

  const [todayOrders, pending, completed, sales, daily, recent, reviewAgg, recentReviews, statusBreakdown] = await Promise.all([
    Order.countDocuments({ ...base, createdAt: { $gte: today } }),
    Order.countDocuments({ ...base, status: 'PENDING' }),
    Order.countDocuments({ restaurant: r._id, status: 'DELIVERED' }),
    Order.aggregate([{ $match: { restaurant: r._id, status: 'DELIVERED' } }, { $group: { _id: null, total: { $sum: '$pricing.total' } } }]),
    Order.aggregate([
      { $match: { restaurant: r._id, status: 'DELIVERED', createdAt: { $gte: since14 } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, sales: { $sum: '$pricing.total' }, orders: { $sum: 1 } } },
    ]),
    Order.find(base).sort({ createdAt: -1 }).limit(8).populate('customer', 'name'),
    Review.aggregate([{ $match: { restaurant: r._id, status: 'visible' } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
    Review.find({ restaurant: r._id, status: 'visible' }).sort({ createdAt: -1 }).limit(5).populate('user', 'name'),
    Order.aggregate([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);

  // Fill missing days with zeros for a continuous chart.
  const byDay = new Map(daily.map((d) => [d._id, d]));
  const chart = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000 + IST_OFFSET_MS);
    const key = d.toISOString().slice(0, 10);
    const v = byDay.get(key);
    chart.push({ date: key, sales: v ? Math.round(v.sales * 100) / 100 : 0, orders: v ? v.orders : 0 });
  }

  res.json({
    success: true,
    restaurant: serializeRestaurant(r),
    stats: {
      todayOrders,
      totalSales: sales[0] ? Math.round(sales[0].total * 100) / 100 : 0,
      pendingOrders: pending,
      completedOrders: completed,
      rating: reviewAgg[0] ? Math.round(reviewAgg[0].avg * 10) / 10 : r.rating,
      reviewCount: reviewAgg[0] ? reviewAgg[0].n : r.reviewCount,
    },
    salesChart: chart,
    statusBreakdown: statusBreakdown.map((s) => ({ status: s._id, count: s.n })),
    recentActivity: recent.map((o) => ({ id: String(o._id), orderNumber: o.orderNumber, status: o.status, total: o.pricing.total, customer: o.customer ? o.customer.name : '', createdAt: o.createdAt })),
    recentReviews: recentReviews.map((v) => ({ id: String(v._id), rating: v.rating, comment: v.comment, user: v.user ? v.user.name : 'Customer', createdAt: v.createdAt })),
  });
});

/* ------------------------- restaurant profile ------------------------- */
exports.updateRestaurant = asyncHandler(async (req, res) => {
  const r = await ownedRestaurant(req, { requireApproved: false });
  const body = req.body;
  const data = pick(body, ['name', 'description', 'logo', 'coverImage', 'prepTime', 'deliveryFee', 'minOrder', 'priceForTwo', 'isOpen']);
  if (Array.isArray(body.cuisines)) data.cuisines = body.cuisines.map((c) => String(c).trim()).filter(Boolean).slice(0, 6);
  if (typeof body.cuisines === 'string') data.cuisines = body.cuisines.split(',').map((c) => c.trim()).filter(Boolean).slice(0, 6);
  if (body.address && typeof body.address === 'object') data.address = { ...r.address.toObject(), ...pick(body.address, ['line', 'city', 'state', 'postalCode']) };
  if (Array.isArray(body.openingHours)) {
    if (body.openingHours.length > 7) throw ApiError.badRequest('Opening hours may have at most 7 entries');
    data.openingHours = body.openingHours.map((h) => ({ day: Number(h.day), open: h.open, close: h.close, closed: Boolean(h.closed) }));
  }
  // approvalStatus / owner can never be changed here.
  r.set(data);
  await r.save();
  res.json({ success: true, restaurant: serializeRestaurant(r) });
});

exports.setOpen = asyncHandler(async (req, res) => {
  const r = await ownedRestaurant(req);
  r.isOpen = req.body.isOpen === true || req.body.isOpen === 'true';
  await r.save();
  res.json({ success: true, restaurant: serializeRestaurant(r) });
});

exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload');
  const url = await storeImage(req.file, 'foodieexpress/menu');
  res.status(201).json({ success: true, url });
});

/* ------------------------- menu ------------------------- */
const parseIngredients = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => String(s).trim()).filter(Boolean).slice(0, 20);

async function uniqueSlug(name) {
  const base = slugify(name) || 'item';
  if (!(await Food.exists({ slug: base }))) return base;
  return `${base}-${crypto.randomBytes(2).toString('hex')}`;
}

exports.listMenu = asyncHandler(async (req, res) => {
  const r = await ownedRestaurant(req, { requireApproved: false });
  const filter = { restaurant: r._id };
  if (req.query.category && isValidId(req.query.category)) filter.category = req.query.category;
  if (req.query.q) filter.name = new RegExp(String(req.query.q).slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [foods, categories] = await Promise.all([
    Food.find(filter).populate('category', 'name slug').sort({ createdAt: -1 }),
    Category.find({ isActive: true }).sort({ sortOrder: 1 }),
  ]);
  res.json({
    success: true,
    restaurant: serializeRestaurant(r),
    foods: foods.map((f) => serializeFood(f, new Map([[String(r._id), r]]))),
    categories: categories.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug })),
  });
});

exports.createFood = asyncHandler(async (req, res) => {
  const r = await ownedRestaurant(req);
  const cat = await Category.findById(req.body.category);
  if (!cat) throw ApiError.badRequest('Category not found');
  const price = Number(req.body.price);
  const dp = req.body.discountedPrice === '' || req.body.discountedPrice == null ? null : Number(req.body.discountedPrice);
  if (dp != null && dp >= price) throw ApiError.badRequest('Discounted price must be lower than the price');
  const food = await Food.create({
    name: req.body.name,
    slug: await uniqueSlug(req.body.name),
    description: req.body.description || '',
    category: cat._id,
    restaurant: r._id,
    price,
    discountedPrice: dp,
    image: req.body.image || '',
    isVeg: req.body.isVeg === undefined ? true : req.body.isVeg === true || req.body.isVeg === 'true',
    prepTime: Number(req.body.prepTime) || 20,
    ingredients: parseIngredients(req.body.ingredients),
    isAvailable: true,
  });
  res.status(201).json({ success: true, food: serializeFood(food, new Map([[String(r._id), r]])) });
});

async function ownedFood(req) {
  if (!isValidId(req.params.id)) throw ApiError.notFound('Menu item not found');
  const r = await ownedRestaurant(req, { requireApproved: true });
  const food = await Food.findOne({ _id: req.params.id, restaurant: r._id });
  if (!food) throw ApiError.notFound('Menu item not found');
  return { food, r };
}

exports.updateFood = asyncHandler(async (req, res) => {
  const { food, r } = await ownedFood(req);
  const b = req.body;
  if (b.category) {
    const cat = await Category.findById(b.category);
    if (!cat) throw ApiError.badRequest('Category not found');
    food.category = cat._id;
  }
  if (b.name !== undefined) food.name = b.name;
  if (b.description !== undefined) food.description = b.description;
  if (b.price !== undefined) food.price = Number(b.price);
  if (b.discountedPrice !== undefined) food.discountedPrice = b.discountedPrice === '' || b.discountedPrice === null ? null : Number(b.discountedPrice);
  if (b.image !== undefined) food.image = b.image;
  if (b.isVeg !== undefined) food.isVeg = b.isVeg === true || b.isVeg === 'true';
  if (b.prepTime !== undefined) food.prepTime = Number(b.prepTime);
  if (b.ingredients !== undefined) food.ingredients = parseIngredients(b.ingredients);
  if (b.isAvailable !== undefined) food.isAvailable = b.isAvailable === true || b.isAvailable === 'true';
  await food.save();
  res.json({ success: true, food: serializeFood(food, new Map([[String(r._id), r]])) });
});

exports.setAvailability = asyncHandler(async (req, res) => {
  const { food, r } = await ownedFood(req);
  food.isAvailable = req.body.isAvailable === true || req.body.isAvailable === 'true';
  await food.save();
  res.json({ success: true, food: serializeFood(food, new Map([[String(r._id), r]])) });
});

exports.deleteFood = asyncHandler(async (req, res) => {
  const { food } = await ownedFood(req);
  // Orders keep their own item snapshots, so deleting a menu item never alters history.
  await food.deleteOne();
  res.json({ success: true, message: 'Menu item deleted' });
});

/* ------------------------- orders ------------------------- */
exports.listOrders = asyncHandler(async (req, res) => {
  const r = await ownedRestaurant(req);
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 15, maxLimit: 50 });
  const filter = { restaurant: r._id, ...VISIBLE };
  const s = req.query.status;
  if (s === 'active') filter.status = { $in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY'] };
  else if (s === 'past') filter.status = { $in: ['DELIVERED', 'CANCELLED', 'REJECTED'] };
  else if (s && Order.STATUSES.includes(s)) filter.status = s;
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('customer', 'name').populate('deliveryPartner', 'name phone vehicle'),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, orders: orders.map((o) => orderService.serializeOrder(o, req.user)), pagination: paginationMeta(page, limit, total) });
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await orderService.loadOrderForUser(req.params.id, req.user, false); // 404 unless it is one of the owner's orders
  const to = String(req.body.status || '');
  const updated = await orderService.changeStatus(order._id, to, { actorUser: req.user, role: 'owner', reason: String(req.body.reason || '').slice(0, 200) });
  res.json({ success: true, order: orderService.serializeOrder(updated, req.user) });
});

exports.reviews = asyncHandler(async (req, res) => {
  const r = await ownedRestaurant(req, { requireApproved: false });
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
  const filter = { restaurant: r._id, status: 'visible' };
  const [list, total, agg] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name'),
    Review.countDocuments(filter),
    Review.aggregate([{ $match: filter }, { $group: { _id: '$rating', n: { $sum: 1 } } }]),
  ]);
  res.json({
    success: true,
    reviews: list.map((v) => ({ id: String(v._id), rating: v.rating, comment: v.comment, user: v.user ? v.user.name : 'Customer', createdAt: v.createdAt })),
    distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: (agg.find((a) => a._id === star) || { n: 0 }).n })),
    pagination: paginationMeta(page, limit, total),
  });
});
