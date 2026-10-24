'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./config/env');
const { sanitize, csrfGuard, apiLimiter } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/error');
const paymentController = require('./controllers/paymentController');

const app = express();
app.set('trust proxy', 1); // Render / Vercel sit behind a proxy: needed for rate limiting and secure cookies

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / server-to-server (no Origin header) and the configured frontends.
      if (!origin || env.CLIENT_URLS.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
  })
);
if (!env.isProd && process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Razorpay webhook needs the RAW body to verify its HMAC signature, so it is mounted before express.json().
app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '200kb' }), paymentController.webhook);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(sanitize);
app.use('/api', apiLimiter);
app.use('/api', csrfGuard);

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d' }));
app.use('/api', require('./routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
