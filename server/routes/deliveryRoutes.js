'use strict';
const router = require('express').Router();
const c = require('../controllers/deliveryController');
const v = require('../validators');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('delivery'));
router.get('/dashboard', c.dashboard);
router.patch('/status', c.setOnline);
router.patch('/location', c.updateLocation);
router.get('/assignments', c.listAssignments);
router.post('/assignments/:id/accept', v.mongoId('id'), validate, c.accept);
router.post('/assignments/:id/reject', v.mongoId('id'), validate, c.reject);
router.patch('/assignments/:id/status', v.mongoId('id'), validate, c.updateStatus);

module.exports = router;
