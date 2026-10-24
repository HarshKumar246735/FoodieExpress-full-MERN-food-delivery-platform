'use strict';
/** Demo accounts. Password for all = SEED_DEMO_PASSWORD (default Demo@1234), same as the dev reset endpoint. */
const dom = 'foodieexpress.demo';
const owners = [];
for (let i = 2; i <= 16; i += 1) owners.push({ key: `owner${i}`, name: `Restaurant Owner ${i}`, email: `owner${i}@${dom}`, role: 'owner', phone: `98000000${String(10 + i)}` });

module.exports = [
  { key: 'customer', name: 'Demo Customer', email: `customer@${dom}`, role: 'customer', phone: '9800000001' },
  { key: 'owner', name: 'Demo Owner', email: `owner@${dom}`, role: 'owner', phone: '9800000002' },
  { key: 'delivery', name: 'Demo Rider', email: `delivery@${dom}`, role: 'delivery', phone: '9800000003', vehicle: 'Motorbike' },
  { key: 'delivery2', name: 'Second Rider', email: `delivery2@${dom}`, role: 'delivery', phone: '9800000004', vehicle: 'Scooter' },
  { key: 'admin', name: 'Demo Admin', email: `admin@${dom}`, role: 'admin', phone: '9800000005' },
  ...owners,
];
