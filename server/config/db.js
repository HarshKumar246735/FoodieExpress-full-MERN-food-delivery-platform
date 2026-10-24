'use strict';
const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

async function connectDB(uri = env.MONGODB_URI) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    // Log host only - never the credentials.
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    throw err;
  }
  mongoose.connection.on('error', (e) => console.error('MongoDB error:', e.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  return mongoose.connection;
}

module.exports = connectDB;
