export const rupee = (n) => {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (d, opts = {}) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...opts }) : '';

export const formatTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');

export const formatDateTime = (d) => (d ? `${formatDate(d)}, ${formatTime(d)}` : '');

export const timeAgo = (d) => {
  if (!d) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  return days < 7 ? `${days} day${days > 1 ? 's' : ''} ago` : formatDate(d);
};

export const ORDER_STATUS = {
  PENDING: { label: 'Placed', tone: 'amber' },
  CONFIRMED: { label: 'Accepted', tone: 'blue' },
  PREPARING: { label: 'Preparing', tone: 'blue' },
  READY_FOR_PICKUP: { label: 'Ready for pickup', tone: 'violet' },
  PICKED_UP: { label: 'Picked up', tone: 'violet' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'violet' },
  DELIVERED: { label: 'Delivered', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
  REJECTED: { label: 'Rejected', tone: 'red' },
};

export const PAYMENT_STATUS = {
  PENDING: { label: 'Pending', tone: 'amber' },
  SUCCESS: { label: 'Paid', tone: 'green' },
  FAILED: { label: 'Failed', tone: 'red' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
  REFUNDED: { label: 'Refunded', tone: 'blue' },
};

export const PAYMENT_METHOD = {
  COD: 'Cash on Delivery',
  RAZORPAY: 'Razorpay (test mode)',
  DEMO: 'Demo payment',
};

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const debounce = (fn, ms = 300) => {
  let t;
  const d = (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  d.cancel = () => clearTimeout(t);
  return d;
};

/** One readable line from a delivery address ({house,street,city,state,postalCode}) or a restaurant address ({line,city,state,postalCode}). */
export const formatAddress = (a) => {
  if (!a) return '';
  const place = [a.city, [a.state, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [a.house, a.street, a.line, place].filter(Boolean).join(', ');
};
