'use strict';
const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Runs after express-validator chains; converts failures into a 422-style 400 with field errors. */
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return next(new ApiError(400, errors[0].message, { errors }));
};

module.exports = validate;
