'use strict';
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

const signToken = (userId) => jwt.sign({ id: String(userId) }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
const verifyToken = (token) => jwt.verify(token, env.JWT_SECRET);

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    // Frontend (Vercel) and API (Render) are different sites in production -> SameSite=None.
    // CSRF is mitigated by the X-Requested-With header check (see middleware/csrf.js).
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function setAuthCookie(res, userId) {
  res.cookie(env.COOKIE_NAME, signToken(userId), cookieOptions());
}

function clearAuthCookie(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(env.COOKIE_NAME, opts);
}

const randomToken = () => crypto.randomBytes(32).toString('hex');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie, randomToken, sha256 };
