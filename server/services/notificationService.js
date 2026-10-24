'use strict';
const { Notification, AuditLog } = require('../models/misc');
const { emitTo } = require('../sockets');

/** Creates an in-app notification and pushes it over Socket.IO. Never throws (best effort). */
async function notify(userId, { title, message = '', type = 'info', order = null }) {
  if (!userId) return null;
  try {
    const n = await Notification.create({ user: userId, title, message, type, order });
    emitTo(`user:${userId}`, 'notification', {
      id: String(n._id),
      title: n.title,
      message: n.message,
      type: n.type,
      order: n.order ? String(n.order) : null,
      createdAt: n.createdAt,
    });
    return n;
  } catch (e) {
    console.error('notify failed:', e.message);
    return null;
  }
}

async function audit(req, action, entity, entityId, meta) {
  try {
    await AuditLog.create({
      actor: req && req.user ? req.user._id : undefined,
      actorEmail: req && req.user ? req.user.email : 'system',
      action,
      entity,
      entityId: entityId ? String(entityId) : '',
      meta,
      ip: req && req.ip ? req.ip : '',
    });
  } catch (e) {
    console.error('audit failed:', e.message);
  }
}

module.exports = { notify, audit };
