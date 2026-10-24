'use strict';
const router = require('express').Router();
const c = require('../controllers/authController');
const v = require('../validators');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

router.post('/register', authLimiter, v.register, validate, c.register);
router.post('/login', authLimiter, v.login, validate, c.login);
router.post('/logout', c.logout);
router.get('/me', protect, c.me);
router.put('/profile', protect, v.profile, validate, c.updateProfile);
router.put('/password', protect, v.changePassword, validate, c.changePassword);
router.post('/forgot-password', authLimiter, v.forgot, validate, c.forgotPassword);
router.post('/reset-password', authLimiter, v.reset, validate, c.resetPassword);

router.post('/addresses', protect, v.address, validate, c.addAddress);
router.put('/addresses/:id', protect, v.mongoId('id'), v.address, validate, c.updateAddress);
router.delete('/addresses/:id', protect, v.mongoId('id'), validate, c.deleteAddress);

module.exports = router;
