'use strict';
const router = require('express').Router();
const c = require('../controllers/paymentController');
const v = require('../validators');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/security');

// NOTE: POST /webhook is mounted in app.js with express.raw() so the signature covers the raw bytes.
router.get('/config', c.config);
router.use(protect, authorize('customer'), paymentLimiter);
router.post('/create-order', body('orderId').isMongoId(), validate, c.createOrder);
router.post(
  '/verify',
  body('razorpay_order_id').isString().isLength({ min: 5, max: 60 }),
  body('razorpay_payment_id').isString().isLength({ min: 5, max: 60 }),
  body('razorpay_signature').isString().isLength({ min: 10, max: 200 }),
  validate,
  c.verify
);
router.post('/report', body('razorpayOrderId').isString().isLength({ min: 5, max: 60 }), validate, c.report);
router.post('/retry', body('orderId').isMongoId(), body('method').isIn(['RAZORPAY', 'DEMO']), validate, c.retry);
router.get('/order/:orderId', v.mongoId('orderId'), validate, c.forOrder);
router.get('/:id/status', v.mongoId('id'), validate, c.status);

module.exports = router;
