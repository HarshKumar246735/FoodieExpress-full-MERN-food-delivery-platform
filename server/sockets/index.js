'use strict';
const { Server } = require('socket.io');
const cookie = require('cookie');
const env = require('../config/env');
const { verifyToken } = require('../utils/token');
const User = require('../models/User');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');

let io = null;

/** Real-time layer. Clients authenticate with the same HTTP-only cookie as the REST API. */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URLS, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie || '';
      const token = cookie.parse(raw)[env.COOKIE_NAME];
      if (!token) return next(new Error('unauthorized'));
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id).select('role status');
      if (!user || user.status === 'suspended') return next(new Error('unauthorized'));
      socket.data.user = { id: String(user._id), role: user.role };
      return next();
    } catch (e) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const { id, role } = socket.data.user;
    socket.join(`user:${id}`);
    if (role === 'delivery') socket.join('delivery');
    if (role === 'admin') socket.join('admin');
    if (role === 'owner') {
      const mine = await Restaurant.find({ owner: id }).select('_id');
      mine.forEach((r) => socket.join(`restaurant:${r._id}`));
    }

    // Join a per-order room only if the user is allowed to see that order.
    socket.on('order:join', async (orderId, ack) => {
      try {
        const order = await Order.findById(orderId).select('customer restaurant deliveryPartner');
        if (!order) return ack && ack({ ok: false });
        let allowed = role === 'admin' || String(order.customer) === id || String(order.deliveryPartner) === id;
        if (!allowed && role === 'owner') {
          const r = await Restaurant.findOne({ _id: order.restaurant, owner: id }).select('_id');
          allowed = Boolean(r);
        }
        if (!allowed) return ack && ack({ ok: false });
        socket.join(`order:${orderId}`);
        return ack && ack({ ok: true });
      } catch (e) {
        return ack && ack({ ok: false });
      }
    });
    socket.on('order:leave', (orderId) => socket.leave(`order:${orderId}`));
  });

  return io;
}

const getIO = () => io;

function emitTo(rooms, event, payload) {
  if (!io) return;
  [].concat(rooms).filter(Boolean).forEach((room) => io.to(room).emit(event, payload));
}

/** Broadcast a compact order update to everyone who should see it. */
function emitOrderUpdate(order) {
  const payload = {
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    at: new Date().toISOString(),
  };
  const rooms = [
    `order:${order._id}`,
    `user:${order.customer}`,
    `restaurant:${order.restaurant}`,
    'admin',
  ];
  if (order.deliveryPartner) rooms.push(`user:${order.deliveryPartner}`);
  emitTo(rooms, 'order:update', payload);
}

module.exports = { initSocket, getIO, emitTo, emitOrderUpdate };
