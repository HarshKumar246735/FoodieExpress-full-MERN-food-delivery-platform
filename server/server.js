'use strict';
const http = require('http');
const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { initSocket } = require('./sockets');
const { expireUnpaidOrders } = require('./services/orderService');

async function start() {
  await connectDB();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(env.PORT, () => {
    console.log(`FoodieExpress API listening on :${env.PORT} (${env.NODE_ENV})`);
    console.log(`  Razorpay: ${env.razorpayConfigured ? (env.razorpayIsTestKey ? 'TEST mode configured' : 'configured with a NON-test key (will be refused)') : 'not configured'}`);
    console.log(`  Demo payments: ${env.DEMO_PAYMENTS_ENABLED ? 'enabled' : 'disabled'} | Cloudinary: ${env.cloudinaryConfigured ? 'configured' : 'local uploads'}`);
  });

  // Housekeeping: cancel online orders that were never paid.
  const timer = setInterval(() => expireUnpaidOrders(30).catch((e) => console.error('expire job failed:', e.message)), 5 * 60 * 1000);
  timer.unref();

  const shutdown = (sig) => {
    console.log(`${sig} received, shutting down`);
    clearInterval(timer);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((e) => {
  console.error('Failed to start server:', e.message);
  process.exit(1);
});
