'use strict';
const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/paymentController');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/security');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// Disabled outright (404) unless demo payments are enabled for this deployment.
router.use((req, res, next) => (env.DEMO_PAYMENTS_ENABLED ? next() : next(ApiError.notFound('Demo payments are disabled on this server'))));
router.post('/simulate', protect, authorize('customer'), paymentLimiter, body('orderId').isMongoId(), body('outcome').isIn(['success', 'failure', 'cancel']), validate, c.demoSimulate);

module.exports = router;
