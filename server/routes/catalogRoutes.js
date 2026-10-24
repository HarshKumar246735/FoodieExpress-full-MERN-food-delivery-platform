'use strict';
const router = require('express').Router();
const c = require('../controllers/catalogController');
const { optionalAuth } = require('../middleware/auth');

router.get('/home', c.home);
router.get('/categories', c.listCategories);
router.get('/cuisines', c.cuisines);
router.get('/restaurants', c.listRestaurants);
router.get('/restaurants/:id', optionalAuth, c.getRestaurant);
router.get('/restaurants/:id/reviews', c.restaurantReviews);
router.get('/food', c.listFood);
router.get('/food/:id', c.getFood);
router.get('/search/suggest', c.suggest);
router.post('/newsletter', c.subscribe);

module.exports = router;
