'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validateData, buildFoods, categories, restaurants } = require('../scripts/lib/seedData');

test('seed data passes all structural checks', () => {
  assert.deepStrictEqual(validateData(), []);
});
test('catalog has at least 200 foods and 20 per category', () => {
  const foods = buildFoods();
  assert.ok(foods.length >= 200, `only ${foods.length} foods`);
  categories.forEach((c) => assert.ok(foods.filter((f) => f.category === c.slug).length >= 20, c.slug));
});
test('at least 15 approved restaurants', () => {
  assert.ok(restaurants.filter((r) => r.approvalStatus === 'approved').length >= 15);
});
