'use strict';
const router = require('express').Router();
const env = require('../config/env');
const { authLimiter } = require('../middleware/security');
const { protect } = require('../middleware/auth');
const authController = require('../controllers/authController');

router.get('/health', (req, res) => res.json({ success: true, status: 'ok', env: env.NODE_ENV, time: new Date().toISOString() }));

router.use('/auth', require('./authRoutes'));
router.use('/', require('./catalogRoutes'));
router.use('/cart', require('./cartRoutes'));
router.use('/orders', require('./orderRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/demo-payments', require('./demoPaymentRoutes'));
router.use('/owner', require('./ownerRoutes'));
router.use('/delivery', require('./deliveryRoutes'));
router.use('/admin', require('./adminRoutes'));

// Development-only helper (never mounted in production).
if (!env.isProd) {
  router.post('/dev/reset-demo-accounts', authLimiter, authController.resetDemoAccounts);
}
void protect;

module.exports = router;
