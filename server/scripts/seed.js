'use strict';
/**
 * Idempotent demo-data seeder. Safe to re-run: every record is upserted by a stable key
 * (slug / email / coupon code) and NOTHING is ever deleted.
 *
 *   npm run seed                  seed everything (needs MongoDB)
 *   npm run seed -- --dry-run     validate the static data only (no DB, no network)
 *   npm run seed -- --offline     seed without live image lookups (cache + overrides only)
 *   npm run seed -- --reset-passwords   also reset demo account passwords
 */
const { validateData, categories, users, restaurants, coupons, buildFoods } = require('./lib/seedData');

const args = new Set(process.argv.slice(2));

function rng(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i += 1) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function main() {
  const problems = validateData();
  if (problems.length) {
    console.error('Seed data is invalid:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
  const foodsData = buildFoods();
  console.log(`Seed data OK: ${categories.length} categories, ${foodsData.length} foods, ${restaurants.length} restaurants, ${users.length} users, ${coupons.length} coupons.`);
  if (args.has('--dry-run')) return;

  const mongoose = require('mongoose');
  const env = require('../config/env');
  const connectDB = require('../config/db');
  const Category = require('../models/Category');
  const Restaurant = require('../models/Restaurant');
  const Food = require('../models/Food');
  const User = require('../models/User');
  const { Coupon, Review } = require('../models/misc');
  const { resolveImage, loadCache, saveCache, loadOverrides } = require('./lib/images');
  const { slugify } = require('../utils/helpers');

  if (env.isProd && !args.has('--force-production')) {
    console.error('Refusing to seed demo data in production without --force-production.');
    process.exit(1);
  }
  await connectDB();
  const cache = loadCache();
  const overrides = loadOverrides();
  const offline = args.has('--offline');
  const imgOpts = { cache, overrides, offline };
  const stats = { lookups: 0, missing: 0 };
  const img = async (kind, slug, q) => {
    const r = await resolveImage(kind, slug, q, imgOpts);
    if (r.source === 'lookup') stats.lookups += 1;
    if (!r.url) stats.missing += 1;
    return r;
  };

  // Users (documents are saved individually so the bcrypt pre-save hook runs)
  const userByKey = {};
  for (const u of users) {
    let doc = await User.findOne({ email: u.email }).select('+password');
    if (!doc) {
      doc = new User({ name: u.name, email: u.email, phone: u.phone, role: u.role, vehicle: u.vehicle || '', password: env.SEED_DEMO_PASSWORD, isDemo: true, isOnline: u.role === 'delivery' && u.key === 'delivery' });
      await doc.save();
    } else if (args.has('--reset-passwords')) {
      doc.password = env.SEED_DEMO_PASSWORD;
      await doc.save();
    }
    userByKey[u.key] = doc;
  }
  const customer = userByKey.customer;
  if (customer && !customer.addresses.length) {
    customer.addresses.push({ label: 'Home', fullName: 'Demo Customer', phone: '9800000001', house: '221, Green Apartments', street: '5th Cross, Indiranagar', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', isDefault: true });
    await customer.save();
  }

  // Categories
  const catBySlug = {};
  for (const c of categories) {
    const image = await img('categories', c.slug, `${c.name} food dish`);
    const set = { name: c.name, description: c.description, sortOrder: c.sortOrder, isActive: true };
    const doc = await Category.findOneAndUpdate({ slug: c.slug }, { $set: set, $setOnInsert: { slug: c.slug, image: image.url } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    if (!doc.image && image.url) { doc.image = image.url; await doc.save(); }
    catBySlug[c.slug] = doc;
  }

  // Restaurants
  const restByKey = {};
  for (const r of restaurants) {
    const slug = slugify(r.name);
    const cover = await img('restaurants', slug, `${r.cuisines[0]} restaurant food`);
    const base = { owner: userByKey[r.owner]._id, name: r.name, description: r.description, cuisines: r.cuisines, address: r.address, location: r.location, prepTime: r.prepTime, deliveryFee: r.deliveryFee, minOrder: r.minOrder, priceForTwo: r.priceForTwo, openingHours: r.openingHours, isOpen: r.isOpen, approvalStatus: r.approvalStatus, isDemo: true };
    const rnd = rng(`rest:${r.key}`);
    const doc = await Restaurant.findOneAndUpdate(
      { slug },
      { $set: base, $setOnInsert: { slug, coverImage: cover.url, logo: cover.url, rating: Number((3.9 + rnd() * 1.0).toFixed(1)), reviewCount: 80 + Math.floor(rnd() * 900) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (!doc.coverImage && cover.url) { doc.coverImage = cover.url; doc.logo = cover.url; await doc.save(); }
    restByKey[r.key] = doc;
  }

  // Foods
  let created = 0;
  for (const f of foodsData) {
    const rnd = rng(`food:${f.slug}`);
    const restaurant = restByKey[f.restaurant];
    const query = `${f.name} ${f.isVeg ? 'vegetarian' : ''} dish`.trim();
    const existing = await Food.findOne({ slug: f.slug });
    const image = existing && existing.image ? { url: existing.image, credit: existing.imageCredit } : await img('foods', f.slug, query);
    const fields = { name: f.name, description: f.description, category: catBySlug[f.category]._id, restaurant: restaurant._id, price: f.price, discountedPrice: f.discountedPrice, isVeg: f.isVeg, prepTime: f.prepTime, ingredients: f.ingredients, isDemo: true };
    const onInsert = { slug: f.slug, rating: Number((3.8 + rnd() * 1.1).toFixed(1)), reviewCount: 20 + Math.floor(rnd() * 480), popularity: Math.floor(rnd() * 1000), isBestseller: rnd() > 0.82, isAvailable: true };
    const res = await Food.findOneAndUpdate({ slug: f.slug }, { $set: fields, $setOnInsert: onInsert }, { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true });
    if (!existing) created += 1;
    if (!res.image && image.url) { res.image = image.url; res.imageCredit = image.credit || ''; await res.save(); }
  }
  saveCache(cache);

  // Coupons (expiry computed relative to now on first insert; existing coupons are left alone)
  for (const c of coupons) {
    const { expiresInDays, ...rest } = c;
    await Coupon.updateOne({ code: c.code }, { $setOnInsert: { ...rest, expiresAt: new Date(Date.now() + expiresInDays * 864e5), isActive: true } }, { upsert: true });
  }

  // A few demo reviews so review sections are not empty
  const reviewTexts = ['Hot, fresh and on time.', 'Great portions and flavour.', 'Packaging was neat, taste even better.', 'Would order again!', 'Good value for money.'];
  let i = 0;
  for (const r of Object.values(restByKey).filter((x) => x.approvalStatus === 'approved')) {
    const exists = await Review.findOne({ user: customer._id, restaurant: r._id, isDemo: true });
    if (!exists) {
      await Review.create({ user: customer._id, restaurant: r._id, rating: 4 + (i % 2), comment: reviewTexts[i % reviewTexts.length], isDemo: true });
    }
    i += 1;
  }

  const counts = { categories: await Category.countDocuments(), restaurants: await Restaurant.countDocuments(), foods: await Food.countDocuments(), users: await User.countDocuments() };
  console.log(`Seed complete. New foods this run: ${created}. DB totals:`, counts);
  console.log(`Images: ${stats.lookups} fetched, ${stats.missing} without an image (UI shows a fallback). Run "npm run images:verify" to check stored URLs.`);
  console.log(`Demo password for all demo accounts: ${env.SEED_DEMO_PASSWORD}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
