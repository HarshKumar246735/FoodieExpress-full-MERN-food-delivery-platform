'use strict';
/** Loads and validates the static seed data. No database or network needed. */
const categories = require('../../data/categories');
const users = require('../../data/users');
const restaurants = require('../../data/restaurants');
const coupons = require('../../data/coupons');
// Same rules as utils/helpers.slugify (duplicated so this file loads without mongoose installed).
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

const FOOD_FILES = {
  pizza: require('../../data/foods/pizza'),
  burgers: require('../../data/foods/burgers'),
  'indian-main-course': require('../../data/foods/indian-main-course'),
  biryani: require('../../data/foods/biryani'),
  chinese: require('../../data/foods/chinese'),
  'south-indian': require('../../data/foods/south-indian'),
  'snacks-and-starters': require('../../data/foods/snacks-and-starters'),
  desserts: require('../../data/foods/desserts'),
  beverages: require('../../data/foods/beverages'),
  'healthy-food-and-salads': require('../../data/foods/healthy-food-and-salads'),
};

/** Expand tuples into food objects. */
function buildFoods() {
  const out = [];
  Object.entries(FOOD_FILES).forEach(([category, rows]) => {
    rows.forEach(([name, price, discounted, vegFlag, prep, restaurant, description, ingredients]) => {
      out.push({
        category, name, slug: slugify(name), price, discountedPrice: discounted || null,
        isVeg: vegFlag === 'V', prepTime: prep, restaurant, description,
        ingredients: String(ingredients).split(',').map((s) => s.trim()).filter(Boolean),
      });
    });
  });
  return out;
}

/** Returns an array of human-readable problems (empty = data is valid). */
function validateData() {
  const problems = [];
  const foods = buildFoods();
  const catSlugs = new Set(categories.map((c) => c.slug));
  const userKeys = new Set(users.map((u) => u.key));
  const restKeys = new Set(restaurants.map((r) => r.key));
  if (categories.length < 10) problems.push(`Only ${categories.length} categories (need 10)`);
  categories.forEach((c) => {
    const n = foods.filter((f) => f.category === c.slug).length;
    if (n < 20) problems.push(`Category ${c.slug} has ${n} foods (need >= 20)`);
  });
  Object.keys(FOOD_FILES).forEach((k) => { if (!catSlugs.has(k)) problems.push(`Food file for unknown category ${k}`); });
  const seen = new Set();
  foods.forEach((f) => {
    const key = f.name.toLowerCase();
    if (seen.has(key)) problems.push(`Duplicate food name: ${f.name}`);
    seen.add(key);
    if (!restKeys.has(f.restaurant)) problems.push(`Food "${f.name}" uses unknown restaurant "${f.restaurant}"`);
    if (f.discountedPrice && f.discountedPrice >= f.price) problems.push(`Food "${f.name}" discount is not below price`);
    if (!(f.price > 0) || !(f.prepTime > 0)) problems.push(`Food "${f.name}" has an invalid price or prep time`);
  });
  const slugs = new Set();
  foods.forEach((f) => { if (slugs.has(f.slug)) problems.push(`Duplicate slug ${f.slug}`); slugs.add(f.slug); });
  restaurants.forEach((r) => { if (!userKeys.has(r.owner)) problems.push(`Restaurant ${r.key} has unknown owner ${r.owner}`); });
  if (restaurants.filter((r) => r.approvalStatus === 'approved').length < 15) problems.push('Fewer than 15 approved restaurants');
  const emails = new Set();
  users.forEach((u) => { if (emails.has(u.email)) problems.push(`Duplicate user email ${u.email}`); emails.add(u.email); });
  ['customer', 'owner', 'delivery', 'admin'].forEach((role) => { if (!users.some((u) => u.role === role)) problems.push(`No demo ${role} account`); });
  ['WELCOME50', 'FOOD10', 'FREESHIP'].forEach((code) => { if (!coupons.some((c) => c.code === code)) problems.push(`Missing coupon ${code}`); });
  return problems;
}

module.exports = { categories, users, restaurants, coupons, FOOD_FILES, buildFoods, validateData };
