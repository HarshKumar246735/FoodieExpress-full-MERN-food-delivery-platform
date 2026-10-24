// Loads Razorpay Checkout on demand (only when the customer chooses Razorpay).
const SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let pending = null;

export function loadRazorpay() {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(window.Razorpay);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay failed to initialise')));
    s.onerror = () => {
      pending = null;
      s.remove();
      reject(new Error('Could not load Razorpay. Check your connection or use another payment method.'));
    };
    document.body.appendChild(s);
  });
  return pending;
}
