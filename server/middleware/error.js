'use strict';
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

const notFound = (req, res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl.split('?')[0]}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let errors = err.errors;
  let code = err.code && typeof err.code === 'string' ? err.code : undefined;

  if (err.name === 'ValidationError' && err.errors && !err.isOperational) {
    status = 400;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = 'Validation failed';
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'value';
    message = `That ${field} is already in use`;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Session expired. Please log in again.';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5 MB)' : err.message;
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  }

  if (status >= 500) {
    // Safe logging: message + stack to server logs only, never to the client.
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl.split('?')[0]} -> ${status}:`, err.message);
    if (!env.isProd && err.stack) console.error(err.stack);
    if (env.isProd) message = 'Internal server error';
  }

  const body = { success: false, message };
  if (errors) body.errors = errors;
  if (code) body.code = code;
  if (err.data) body.data = err.data;
  res.status(status).json(body);
};

module.exports = { notFound, errorHandler };
