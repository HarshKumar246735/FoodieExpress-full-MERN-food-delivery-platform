'use strict';
/** Demo coupons. expiresInDays is relative to seed time so demos never ship already-expired. */
module.exports = [
  { code: 'WELCOME50', description: 'Flat Rs 50 off your first order above Rs 199', type: 'FLAT', value: 50, minOrder: 199, maxDiscount: 0, perUserLimit: 1, usageLimit: 0, expiresInDays: 365 },
  { code: 'FOOD10', description: '10% off orders above Rs 299 (up to Rs 100)', type: 'PERCENT', value: 10, minOrder: 299, maxDiscount: 100, perUserLimit: 0, usageLimit: 0, expiresInDays: 365 },
  { code: 'FREESHIP', description: 'Free delivery on orders above Rs 249', type: 'FREESHIP', value: 0, minOrder: 249, maxDiscount: 0, perUserLimit: 0, usageLimit: 0, expiresInDays: 365 },
  { code: 'FEAST20', description: '20% off orders above Rs 599 (up to Rs 150)', type: 'PERCENT', value: 20, minOrder: 599, maxDiscount: 150, perUserLimit: 2, usageLimit: 500, expiresInDays: 180 },
  { code: 'SWEET30', description: 'Flat Rs 30 off orders above Rs 149', type: 'FLAT', value: 30, minOrder: 149, maxDiscount: 0, perUserLimit: 3, usageLimit: 0, expiresInDays: 180 },
];
