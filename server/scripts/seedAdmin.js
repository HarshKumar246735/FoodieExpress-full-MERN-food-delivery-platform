'use strict';
/**
 * Creates/updates ONLY the admin account. Admins can never be created through the public API.
 *   npm run seed:admin
 * Override with ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in the environment.
 */
const mongoose = require('mongoose');
const env = require('../config/env');
const connectDB = require('../config/db');
const User = require('../models/User');

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'admin@foodieexpress.demo').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || env.SEED_DEMO_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Demo Admin';
  if (env.isProd && !process.env.ADMIN_PASSWORD) {
    console.error('In production you must set ADMIN_PASSWORD (the default demo password is not allowed).');
    process.exit(1);
  }
  if (password.length < 8) { console.error('Password must be at least 8 characters.'); process.exit(1); }
  await connectDB();
  let u = await User.findOne({ email }).select('+password');
  if (!u) {
    u = new User({ name, email, password, role: 'admin', phone: '9800000005', isDemo: !env.isProd });
  } else {
    u.role = 'admin'; u.status = 'active'; u.password = password;
  }
  await u.save();
  console.log(`Admin ready: ${email}${env.isProd ? '' : ` (password: ${password})`}`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error('seed:admin failed:', e.message); process.exit(1); });
