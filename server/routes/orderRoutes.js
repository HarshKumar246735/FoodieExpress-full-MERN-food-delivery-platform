'use strict';
const router = require('express').Router();
const c = require('../controllers/orderController');
const v = require('../validators');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// notifications are available to every signed-in role
router.get('/notifications', c.listNotifications);
router.patch('/notifications/read-all', c.markAllRead);
router.patch('/notifications/:id/read', v.mongoId('id'), validate, c.markRead);

router.post('/complaints', authorize('customer'), v.complaint, validate, c.createComplaint);
router.get('/complaints/mine', authorize('customer'), c.myComplaints);

router.post('/', authorize('customer'), v.placeOrder, validate, c.create);
router.get('/my-orders', authorize('customer'), c.myOrders);
router.get('/:id', v.mongoId('id'), validate, c.getOrder);
router.get('/:id/receipt', v.mongoId('id'), validate, c.receipt);
router.post('/:id/cancel', authorize('customer', 'admin'), v.mongoId('id'), validate, c.cancel);
router.post('/:id/reorder', authorize('customer'), v.mongoId('id'), validate, c.reorder);
router.post('/:id/review', authorize('customer'), v.mongoId('id'), v.review, validate, c.review);

module.exports = router;
