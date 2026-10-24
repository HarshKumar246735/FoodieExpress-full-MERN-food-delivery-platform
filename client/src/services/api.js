import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL.replace(/\/api\/?$/, '');
export const ASSET_URL = SOCKET_URL; // server origin, used for locally uploaded images (/uploads/...)

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // HTTP-only auth cookie
  headers: { 'X-Requested-With': 'FoodieExpress' }, // required by the server's CSRF guard
  timeout: 20000,
});

/** Always resolves to a user-friendly message. */
export function apiError(err, fallback = 'Something went wrong. Please try again.') {
  if (err && err.response && err.response.data && err.response.data.message) return err.response.data.message;
  if (err && err.code === 'ECONNABORTED') return 'The request timed out. Check your connection and try again.';
  if (err && err.message === 'Network Error') return 'Cannot reach the server. Is the backend running?';
  return (err && err.message) || fallback;
}

/** Server error code (e.g. CART_RESTAURANT_CONFLICT) if present. */
export const apiCode = (err) => (err && err.response && err.response.data && err.response.data.code) || null;
export const apiData = (err) => (err && err.response && err.response.data && err.response.data.data) || null;

/** Turns a stored image path into a usable URL (uploaded files are served by the API origin). */
export function imageUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  return `${ASSET_URL}${src.startsWith('/') ? '' : '/'}${src}`;
}

export default api;
