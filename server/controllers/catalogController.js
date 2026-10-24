'use strict';
const Category = require('../models/Category');
const Restaurant = require('../models/Restaurant');
const Food = require('../models/Food');
const { Review, Coupon, Subscriber } = require('../models/misc');
const ApiError = require('../utils/ApiError');
const { asyncHandler, escapeRegex, isValidId, parsePagination, paginationMeta, toBool } = require('../utils/helpers');
const { isRestaurantOpenNow } = require('../utils/hours');
const { effectivePrice } = require('../services/pricing');

/* ----------------------------- serializers ----------------------------- */
const serializeRestaurant = (r) => ({
  id: String(r._id),
  name: r.name,
  slug: r.slug,
  description: r.description,
  logo: r.logo,
  coverImage: r.coverImage,
  cuisines: r.cuisines,
  address: r.address,
  location: r.location,
  rating: r.rating,
  reviewCount: r.reviewCount,
  prepTime: r.prepTime,
  deliveryFee: r.deliveryFee,
  minOrder: r.minOrder,
  priceForTwo: r.priceForTwo,
  openingHours: r.openingHours,
  isOpen: r.isOpen,
  isOpenNow: isRestaurantOpenNow(r),
  approvalStatus: r.approvalStatus,
});

const serializeFood = (f, restaurantMap) => {
  const r = f.restaurant && f.restaurant._id ? f.restaurant : restaurantMap && restaurantMap.get(String(f.restaurant));
  const c = f.category && f.category._id ? f.category : null;
  const unit = effectivePrice(f);
  return {
    id: String(f._id),
    name: f.name,
    slug: f.slug,
    description: f.description,
    price: f.price,
    discountedPrice: f.discountedPrice,
    unitPrice: unit,
    discountPercent: unit < f.price ? Math.round(((f.price - unit) / f.price) * 100) : 0,
    image: f.image,
    imageCredit: f.imageCredit,
    isVeg: f.isVeg,
    rating: f.rating,
    reviewCount: f.reviewCount,
    prepTime: f.prepTime,
    isAvailable: f.isAvailable,
    isBestseller: f.isBestseller,
    popularity: f.popularity,
    ingredients: f.ingredients,
    category: c ? { id: String(c._id), name: c.name, slug: c.slug } : String(f.category),
    restaurant: r
      ? { id: String(r._id), name: r.name, slug: r.slug, isOpenNow: isRestaurantOpenNow(r), deliveryFee: r.deliveryFee, minOrder: r.minOrder }
      : String(f.restaurant),
    createdAt: f.createdAt,
  };
};

const FOOD_SORTS = {
  popularity: { popularity: -1, rating: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { rating: -1, reviewCount: -1 },
  newest: { createdAt: -1 },
};

const approvedRestaurants = (extra = {}) => Restaurant.find({ approvalStatus: 'approved', ...extra });

/* ----------------------------- categories ----------------------------- */
exports.listCategories = asyncHandler(async (req, res) => {
  const cats = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  const approved = await Restaurant.find({ approvalStatus: 'approved' }).select('_id');
  const counts = await Food.aggregate([
    { $match: { restaurant: { $in: approved.map((r) => r._id) }, isAvailable: true } },
    { $group: { _id: '$category', n: { $sum: 1 } } },
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({
    success: true,
    categories: cats.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug, description: c.description, image: c.image, itemCount: map.get(String(c._id)) || 0 })),
  });
});

/* ----------------------------- restaurants ----------------------------- */
exports.listRestaurants = asyncHandler(async (req, res) => {
  const { q, cuisine, minRating, maxPrep, open, sort = 'rating', maxFee, maxPriceForTwo } = req.query;
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 50 });
  const filter = { approvalStatus: 'approved' };
  if (q) {
    const rx = new RegExp(escapeRegex(String(q).slice(0, 60)), 'i');
    filter.$or = [{ name: rx }, { cuisines: rx }, { description: rx }];
  }
  if (cuisine) filter.cuisines = new RegExp(`^${escapeRegex(String(cuisine))}$`, 'i');
  if (minRating) filter.rating = { $gte: Number(minRating) || 0 };
  if (maxPrep) filter.prepTime = { $lte: Number(maxPrep) || 120 };
  if (maxFee !== undefined && maxFee !== '') filter.deliveryFee = { $lte: Number(maxFee) };
  if (maxPriceForTwo) filter.priceForTwo = { $lte: Number(maxPriceForTwo) };

  const sorts = {
    rating: { rating: -1, reviewCount: -1 },
    delivery_time: { prepTime: 1 },
    price_asc: { priceForTwo: 1 },
    price_desc: { priceForTwo: -1 },
    newest: { createdAt: -1 },
    popularity: { reviewCount: -1 },
  };
  const all = await Restaurant.find(filter).sort(sorts[sort] || sorts.rating);
  // "Open now" depends on opening hours, so it is evaluated in code on the (small) filtered set.
  const wantOpen = toBool(open);
  const filtered = wantOpen === undefined ? all : all.filter((r) => isRestaurantOpenNow(r) === wantOpen);
  const pageItems = filtered.slice(skip, skip + limit);
  res.json({ success: true, restaurants: pageItems.map(serializeRestaurant), pagination: paginationMeta(page, limit, filtered.length) });
});

exports.cuisines = asyncHandler(async (req, res) => {
  const list = await Restaurant.distinct('cuisines', { approvalStatus: 'approved' });
  res.json({ success: true, cuisines: list.sort() });
});

exports.getRestaurant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const r = await Restaurant.findOne(isValidId(id) ? { _id: id } : { slug: String(id).toLowerCase() });
  if (!r) throw ApiError.notFound('Restaurant not found');
  const isOwnerView = req.user && (req.user.role === 'admin' || String(r.owner) === String(req.user._id));
  if (r.approvalStatus !== 'approved' && !isOwnerView) throw ApiError.notFound('Restaurant not found');
  const foods = await Food.find({ restaurant: r._id }).populate('category', 'name slug').sort({ popularity: -1 });
  const menuFoods = foods; // unavailable items stay visible (shown disabled by the client)
  const byCategory = new Map();
  menuFoods.forEach((f) => {
    const key = f.category ? String(f.category._id) : 'other';
    if (!byCategory.has(key)) byCategory.set(key, { category: f.category ? { id: key, name: f.category.name, slug: f.category.slug } : { id: 'other', name: 'Other', slug: 'other' }, items: [] });
    byCategory.get(key).items.push(serializeFood(f, new Map([[String(r._id), r]])));
  });
  res.json({ success: true, restaurant: serializeRestaurant(r), menu: [...byCategory.values()], itemCount: menuFoods.length });
});

exports.restaurantReviews = asyncHandler(async (req, res) => {
  const r = await Restaurant.findOne(isValidId(req.params.id) ? { _id: req.params.id } : { slug: req.params.id });
  if (!r) throw ApiError.notFound('Restaurant not found');
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
  const filter = { restaurant: r._id, status: 'visible' };
  const [list, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name'),
    Review.countDocuments(filter),
  ]);
  res.json({
    success: true,
    reviews: list.map((v) => ({ id: String(v._id), rating: v.rating, comment: v.comment, user: v.user ? v.user.name : 'Customer', createdAt: v.createdAt })),
    pagination: paginationMeta(page, limit, total),
  });
});

/* ----------------------------- food ----------------------------- */
async function buildFoodFilter(q, { forceApproved = true } = {}) {
  const filter = {};
  let restaurantIds = null;

  if (forceApproved || q.open !== undefined) {
    const restaurants = await approvedRestaurants().select('_id isOpen openingHours');
    restaurantIds = restaurants;
    const wantOpen = toBool(q.open);
    if (wantOpen !== undefined) restaurantIds = restaurants.filter((r) => isRestaurantOpenNow(r) === wantOpen);
  }
  if (q.restaurant) {
    const r = await Restaurant.findOne(isValidId(q.restaurant) ? { _id: q.restaurant } : { slug: String(q.restaurant) }).select('_id');
    filter.restaurant = r ? r._id : null;
    if (restaurantIds && r && !restaurantIds.some((x) => String(x._id) === String(r._id))) filter.restaurant = null;
  } else if (restaurantIds) {
    filter.restaurant = { $in: restaurantIds.map((r) => r._id) };
  }
  if (q.category) {
    const cat = await Category.findOne(isValidId(q.category) ? { _id: q.category } : { slug: String(q.category) }).select('_id');
    filter.category = cat ? cat._id : null;
  }
  const veg = toBool(q.veg);
  if (veg !== undefined) filter.isVeg = veg;
  if (q.nonVeg !== undefined && toBool(q.nonVeg)) filter.isVeg = false;
  if (q.minPrice || q.maxPrice) {
    filter.price = {};
    if (q.minPrice) filter.price.$gte = Number(q.minPrice) || 0;
    if (q.maxPrice) filter.price.$lte = Number(q.maxPrice) || 100000;
  }
  if (q.minRating) filter.rating = { $gte: Number(q.minRating) || 0 };
  if (q.maxPrep) filter.prepTime = { $lte: Number(q.maxPrep) || 120 };
  if (toBool(q.discount)) filter.discountedPrice = { $ne: null };
  if (toBool(q.bestseller)) filter.isBestseller = true;
  const avail = toBool(q.available);
  if (avail !== undefined) filter.isAvailable = avail;
  if (q.q) {
    const rx = new RegExp(escapeRegex(String(q.q).slice(0, 60)), 'i');
    const matchingRestaurants = await Restaurant.find({ approvalStatus: 'approved', $or: [{ name: rx }, { cuisines: rx }] }).select('_id');
    const matchingCategories = await Category.find({ name: rx }).select('_id');
    filter.$or = [{ name: rx }, { description: rx }, { ingredients: rx }, { restaurant: { $in: matchingRestaurants.map((r) => r._id) } }, { category: { $in: matchingCategories.map((c) => c._id) } }];
  }
  return filter;
}

exports.listFood = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 60 });
  const filter = await buildFoodFilter(req.query);
  const sort = FOOD_SORTS[req.query.sort] || FOOD_SORTS.popularity;
  const [items, total] = await Promise.all([
    Food.find(filter).sort({ ...sort, _id: 1 }).skip(skip).limit(limit).populate('category', 'name slug').populate('restaurant', 'name slug openingHours isOpen deliveryFee minOrder'),
    Food.countDocuments(filter),
  ]);
  res.json({ success: true, foods: items.map((f) => serializeFood(f)), pagination: paginationMeta(page, limit, total) });
});

exports.getFood = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const f = await Food.findOne(isValidId(id) ? { _id: id } : { slug: String(id).toLowerCase() })
    .populate('category', 'name slug')
    .populate('restaurant', 'name slug openingHours isOpen deliveryFee minOrder approvalStatus');
  if (!f || (f.restaurant && f.restaurant.approvalStatus !== 'approved')) throw ApiError.notFound('Food item not found');
  const related = await Food.find({ category: f.category._id, _id: { $ne: f._id }, isAvailable: true }).sort({ popularity: -1 }).limit(8).populate('category', 'name slug').populate('restaurant', 'name slug openingHours isOpen deliveryFee minOrder');
  res.json({ success: true, food: serializeFood(f), related: related.map((x) => serializeFood(x)) });
});

/* Live search suggestions for the navbar. */
exports.suggest = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.json({ success: true, foods: [], restaurants: [], categories: [] });
  const rx = new RegExp(escapeRegex(q), 'i');
  const approved = await Restaurant.find({ approvalStatus: 'approved' }).select('_id');
  const ids = approved.map((r) => r._id);
  const [foods, restaurants, categories] = await Promise.all([
    Food.find({ restaurant: { $in: ids }, $or: [{ name: rx }, { ingredients: rx }] }).sort({ popularity: -1 }).limit(6).populate('restaurant', 'name slug'),
    Restaurant.find({ approvalStatus: 'approved', $or: [{ name: rx }, { cuisines: rx }] }).sort({ rating: -1 }).limit(4),
    Category.find({ isActive: true, name: rx }).limit(3),
  ]);
  res.json({
    success: true,
    foods: foods.map((f) => ({ id: String(f._id), name: f.name, slug: f.slug, image: f.image, price: effectivePrice(f), isVeg: f.isVeg, restaurant: f.restaurant ? f.restaurant.name : '' })),
    restaurants: restaurants.map((r) => ({ id: String(r._id), name: r.name, slug: r.slug, logo: r.logo, cuisines: r.cuisines })),
    categories: categories.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug })),
  });
});

/* ----------------------------- homepage aggregate ----------------------------- */
exports.home = asyncHandler(async (req, res) => {
  const restaurants = await approvedRestaurants();
  const ids = restaurants.map((r) => r._id);
  const rmap = new Map(restaurants.map((r) => [String(r._id), r]));
  const base = { restaurant: { $in: ids }, isAvailable: true };
  const pop = (filter, n, sort = { popularity: -1 }) => Food.find({ ...base, ...filter }).sort(sort).limit(n).populate('category', 'name slug');
  const [bestsellers, recommended, veg, offers, categories, reviews, coupons] = await Promise.all([
    pop({ isBestseller: true }, 12),
    pop({ rating: { $gte: 4.3 } }, 12, { rating: -1, popularity: -1 }),
    pop({ isVeg: true }, 12),
    pop({ discountedPrice: { $ne: null } }, 12, { createdAt: -1 }),
    Category.find({ isActive: true }).sort({ sortOrder: 1 }),
    Review.find({ status: 'visible', comment: { $ne: '' } }).sort({ createdAt: -1 }).limit(9).populate('user', 'name').populate('restaurant', 'name'),
    Coupon.find({ isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).limit(6),
  ]);
  const popular = [...restaurants].sort((a, b) => b.rating * 100 + b.reviewCount / 1000 - (a.rating * 100 + a.reviewCount / 1000)).slice(0, 8);
  res.json({
    success: true,
    categories: categories.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug, image: c.image })),
    popularRestaurants: popular.map(serializeRestaurant),
    bestsellers: bestsellers.map((f) => serializeFood(f, rmap)),
    recommended: recommended.map((f) => serializeFood(f, rmap)),
    vegetarian: veg.map((f) => serializeFood(f, rmap)),
    offers: offers.map((f) => serializeFood(f, rmap)),
    reviews: reviews.map((v) => ({ id: String(v._id), rating: v.rating, comment: v.comment, user: v.user ? v.user.name : 'Customer', restaurant: v.restaurant ? v.restaurant.name : '' })),
    coupons: coupons.map((c) => ({ code: c.code, description: c.description, type: c.type, value: c.value, minOrder: c.minOrder, maxDiscount: c.maxDiscount })),
    stats: { restaurants: restaurants.length, dishes: await Food.countDocuments(base) },
  });
});

exports.subscribe = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw ApiError.badRequest('Enter a valid email address');
  try {
    await Subscriber.create({ email });
  } catch (e) {
    if (e.code !== 11000) throw e; // already subscribed: treat as success
  }
  res.status(201).json({ success: true, message: 'Thanks for subscribing!' });
});

exports.serializeFood = serializeFood;
exports.serializeRestaurant = serializeRestaurant;
