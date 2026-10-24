'use strict';
const { body, param, query } = require('express-validator');

const mongoId = (field, where = param) => where(field).isMongoId().withMessage(`Invalid ${field}`);

const phone = (field = 'phone', optional = false) => {
  const c = body(field).trim();
  return (optional ? c.optional({ values: 'falsy' }) : c.notEmpty().withMessage('Phone number is required')).matches(/^[6-9][0-9]{9}$/).withMessage('Enter a valid 10-digit Indian mobile number');
};

const password = (field = 'password') =>
  body(field)
    .isString().withMessage('Password is required')
    .isLength({ min: 8, max: 72 }).withMessage('Password must be 8-72 characters')
    .matches(/[A-Za-z]/).withMessage('Password must contain a letter')
    .matches(/[0-9]/).withMessage('Password must contain a number');

const addressFields = (prefix = '') => {
  const f = (n) => (prefix ? `${prefix}.${n}` : n);
  return [
    body(f('fullName')).trim().isLength({ min: 2, max: 80 }).withMessage('Full name is required'),
    body(f('phone')).trim().matches(/^[6-9][0-9]{9}$/).withMessage('Enter a valid 10-digit mobile number'),
    body(f('house')).trim().isLength({ min: 1, max: 120 }).withMessage('House / building is required'),
    body(f('street')).trim().isLength({ min: 2, max: 160 }).withMessage('Street / locality is required'),
    body(f('city')).trim().isLength({ min: 2, max: 60 }).withMessage('City is required'),
    body(f('state')).trim().isLength({ min: 2, max: 60 }).withMessage('State is required'),
    body(f('postalCode')).trim().matches(/^[1-9][0-9]{5}$/).withMessage('Enter a valid 6-digit postal code'),
  ];
};

const register = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters'),
  body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail({ gmail_remove_dots: false }),
  phone('phone', true),
  password('password'),
];
const login = [
  body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail({ gmail_remove_dots: false }),
  body('password').isString().notEmpty().withMessage('Password is required'),
];
const forgot = [body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail({ gmail_remove_dots: false })];
const reset = [body('token').isString().isLength({ min: 20, max: 200 }), password('password')];
const changePassword = [body('currentPassword').isString().notEmpty().withMessage('Current password is required'), password('newPassword')];
const profile = [
  body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters'),
  phone('phone', true),
];
const address = [body('label').optional().trim().isLength({ max: 30 }), ...addressFields(), body('isDefault').optional().isBoolean()];

const cartAdd = [
  body('foodId').isMongoId().withMessage('Invalid food id'),
  body('quantity').optional().isInt({ min: 1, max: 20 }).withMessage('Quantity must be between 1 and 20'),
  body('replace').optional().isBoolean(),
];
const cartUpdate = [param('foodId').isMongoId(), body('quantity').isInt({ min: 0, max: 20 }).withMessage('Quantity must be between 0 and 20')];
const cartCoupon = [body('code').trim().isLength({ min: 2, max: 24 }).withMessage('Enter a coupon code')];
const cartPreview = [
  body('items').isArray({ min: 0, max: 40 }),
  body('items.*.foodId').isMongoId(),
  body('items.*.quantity').isInt({ min: 1, max: 20 }),
  body('couponCode').optional({ values: 'falsy' }).isString().isLength({ max: 24 }),
];

const placeOrder = [
  body('paymentMethod').isIn(['COD', 'RAZORPAY', 'DEMO']).withMessage('Choose a payment method'),
  body('addressId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid address'),
  body('instructions').optional().isString().isLength({ max: 300 }),
  body('saveAddress').optional().isBoolean(),
  body('address').if(body('addressId').not().exists({ values: 'falsy' })).exists().withMessage('A delivery address is required'),
  ...addressFields('address').map((c) => c.if(body('addressId').not().exists({ values: 'falsy' }))),
];

const review = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('comment').optional().isString().isLength({ max: 600 }),
];

const complaint = [
  body('subject').trim().isLength({ min: 3, max: 120 }).withMessage('Subject must be 3-120 characters'),
  body('message').trim().isLength({ min: 10, max: 1000 }).withMessage('Please describe the issue (10-1000 characters)'),
  body('order').optional({ values: 'falsy' }).isMongoId(),
];

const foodInput = (partial = false) => {
  const req = (c) => (partial ? c.optional() : c);
  return [
    req(body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name is required')),
    req(body('price').isFloat({ min: 1, max: 100000 }).withMessage('Price must be at least ₹1')),
    body('discountedPrice').optional({ values: 'null' }).custom((v) => v === '' || v === null || (Number(v) >= 1)).withMessage('Invalid discounted price'),
    req(body('category').isMongoId().withMessage('Choose a category')),
    body('description').optional().isString().isLength({ max: 500 }),
    body('isVeg').optional().isBoolean(),
    body('prepTime').optional().isInt({ min: 1, max: 120 }),
    body('image').optional().isString().isLength({ max: 500 }),
    body('ingredients').optional(),
  ];
};

const coupon = [
  body('code').trim().isLength({ min: 2, max: 24 }).matches(/^[A-Za-z0-9_-]+$/).withMessage('Code may contain letters, numbers, - and _'),
  body('type').isIn(['FLAT', 'PERCENT', 'FREESHIP']),
  body('value').optional().isFloat({ min: 0, max: 100000 }),
  body('minOrder').optional().isFloat({ min: 0 }),
  body('maxDiscount').optional().isFloat({ min: 0 }),
  body('usageLimit').optional().isInt({ min: 0 }),
  body('perUserLimit').optional().isInt({ min: 0 }),
  body('expiresAt').optional({ values: 'falsy' }).isISO8601(),
  body('startsAt').optional({ values: 'falsy' }).isISO8601(),
];

const pageQuery = [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })];

module.exports = {
  mongoId,
  register,
  login,
  forgot,
  reset,
  changePassword,
  profile,
  address,
  addressFields,
  cartAdd,
  cartUpdate,
  cartCoupon,
  cartPreview,
  placeOrder,
  review,
  complaint,
  foodInput,
  coupon,
  pageQuery,
};
