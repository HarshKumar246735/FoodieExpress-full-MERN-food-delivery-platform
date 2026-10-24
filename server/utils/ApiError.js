'use strict';

class ApiError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = extra.code;
    this.errors = extra.errors;
    this.data = extra.data;
    this.isOperational = true;
  }
  static badRequest(msg, extra) { return new ApiError(400, msg, extra); }
  static unauthorized(msg = 'Please log in to continue', extra) { return new ApiError(401, msg, extra); }
  static forbidden(msg = 'You do not have permission to do that', extra) { return new ApiError(403, msg, extra); }
  static notFound(msg = 'Resource not found', extra) { return new ApiError(404, msg, extra); }
  static conflict(msg, extra) { return new ApiError(409, msg, extra); }
}

module.exports = ApiError;
