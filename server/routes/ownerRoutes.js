'use strict';
const router = require('express').Router();
const c = require('../controllers/ownerController');
const v = require('../validators');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

router.use(protect, authorize('owner'));
router.get('/restaurants', c.myRestaurants);
router.get('/dashboard', c.dashboard);
router.put('/restaurant', c.updateRestaurant);
router.patch('/restaurant/open', c.setOpen);
router.post('/upload', uploadSingle('image'), c.upload);

router.get('/menu', c.listMenu);
router.post('/menu', v.foodInput(false), validate, c.createFood);
router.put('/menu/:id', v.mongoId('id'), v.foodInput(true), validate, c.updateFood);
router.patch('/menu/:id/availability', v.mongoId('id'), validate, c.setAvailability);
router.delete('/menu/:id', v.mongoId('id'), validate, c.deleteFood);

router.get('/orders', c.listOrders);
router.patch('/orders/:id/status', v.mongoId('id'), validate, c.updateOrderStatus);
router.get('/reviews', c.reviews);

module.exports = router;
