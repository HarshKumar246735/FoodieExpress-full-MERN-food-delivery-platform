'use strict';
const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/adminController');
const v = require('../validators');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');

// Every admin endpoint requires a valid session AND the admin role, enforced here on the server.
router.use(protect, authorize('admin'));

router.get('/dashboard', c.dashboard);

router.get('/users', c.listUsers);
router.post('/users', v.register, body('role').isIn(['customer', 'owner', 'delivery', 'admin']), validate, c.createUser);
router.patch('/users/:id', v.mongoId('id'), validate, c.updateUser);
router.get('/delivery-partners', c.listDeliveryPartners);

router.get('/restaurants', c.listRestaurants);
router.post('/restaurants', body('name').trim().isLength({ min: 2, max: 80 }), body('ownerId').isMongoId(), validate, c.createRestaurant);
router.patch('/restaurants/:id/approval', v.mongoId('id'), validate, c.setApproval);

router.get('/orders', c.listOrders);
router.post('/orders/:id/cancel', v.mongoId('id'), validate, c.cancelOrder);

router.get('/categories', c.listCategories);
router.post('/categories', c.createCategory);
router.put('/categories/:id', v.mongoId('id'), validate, c.updateCategory);
router.delete('/categories/:id', v.mongoId('id'), validate, c.deleteCategory);

router.get('/coupons', c.listCoupons);
router.post('/coupons', v.coupon, validate, c.createCoupon);
router.put('/coupons/:id', v.mongoId('id'), validate, c.updateCoupon);
router.delete('/coupons/:id', v.mongoId('id'), validate, c.deleteCoupon);

router.get('/reviews', c.listReviews);
router.patch('/reviews/:id', v.mongoId('id'), validate, c.moderateReview);
router.delete('/reviews/:id', v.mongoId('id'), validate, c.deleteReview);

router.get('/complaints', c.listComplaints);
router.patch('/complaints/:id', v.mongoId('id'), validate, c.updateComplaint);

router.get('/transactions', c.listTransactions);
router.get('/audit-logs', c.listAudit);

module.exports = router;
