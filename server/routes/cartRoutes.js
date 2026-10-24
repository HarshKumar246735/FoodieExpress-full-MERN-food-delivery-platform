'use strict';
const router = require('express').Router();
const c = require('../controllers/cartController');
const v = require('../validators');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');

router.post('/preview', optionalAuth, v.cartPreview, validate, c.preview);
router.use(protect);
router.get('/', c.getCart);
router.delete('/', c.clear);
router.post('/items', v.cartAdd, validate, c.addItem);
router.patch('/items/:foodId', v.cartUpdate, validate, c.updateItem);
router.delete('/items/:foodId', v.mongoId('foodId'), validate, c.removeItem);
router.post('/coupon', v.cartCoupon, validate, c.applyCoupon);
router.delete('/coupon', c.removeCoupon);
router.post('/merge', c.merge);

module.exports = router;
