'use strict';
/** Pure order state machine (no DB). Used by every controller that changes an order's status. */

const STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REJECTED',
];

const TRANSITIONS = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
};

// Which transitions each role is allowed to trigger (admin may trigger any valid transition).
const ROLE_TRANSITIONS = {
  customer: { PENDING: ['CANCELLED'], CONFIRMED: ['CANCELLED'] },
  owner: {
    PENDING: ['CONFIRMED', 'REJECTED'],
    CONFIRMED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  },
  delivery: {
    READY_FOR_PICKUP: ['PICKED_UP'],
    PICKED_UP: ['OUT_FOR_DELIVERY'],
    OUT_FOR_DELIVERY: ['DELIVERED'],
  },
};

const TERMINAL = ['DELIVERED', 'CANCELLED', 'REJECTED'];

const isTerminal = (status) => TERMINAL.includes(status);
const canTransition = (from, to) => Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));

function roleCanTransition(role, from, to) {
  if (!canTransition(from, to)) return false;
  if (role === 'admin') return true;
  const allowed = ROLE_TRANSITIONS[role];
  return Boolean(allowed && allowed[from] && allowed[from].includes(to));
}

/** Customer-facing tracking steps, in order. */
const TIMELINE = [
  { key: 'PLACED', label: 'Order placed', statuses: ['PENDING'] },
  { key: 'CONFIRMED', label: 'Restaurant accepted', statuses: ['CONFIRMED'] },
  { key: 'PREPARING', label: 'Preparing your food', statuses: ['PREPARING'] },
  { key: 'READY_FOR_PICKUP', label: 'Ready for pickup', statuses: ['READY_FOR_PICKUP'] },
  { key: 'PICKED_UP', label: 'Picked up by delivery partner', statuses: ['PICKED_UP'] },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', statuses: ['OUT_FOR_DELIVERY'] },
  { key: 'DELIVERED', label: 'Delivered', statuses: ['DELIVERED'] },
];

module.exports = { STATUSES, TRANSITIONS, ROLE_TRANSITIONS, TERMINAL, TIMELINE, isTerminal, canTransition, roleCanTransition };
