// Client-side mirrors of server/validators/index.js (the server remains the source of truth).
export const EMAIL_RE = /^\S+@\S+\.\S+$/;
export const PHONE_RE = /^[6-9][0-9]{9}$/;
export const PIN_RE = /^[1-9][0-9]{5}$/;

export const EMPTY_ADDRESS = { label: 'Home', fullName: '', phone: '', house: '', street: '', city: '', state: '', postalCode: '' };

export function validateEmail(v) {
  if (!v || !v.trim()) return 'Email is required';
  return EMAIL_RE.test(v.trim()) ? '' : 'Enter a valid email';
}

export function validatePassword(p) {
  if (!p) return 'Password is required';
  if (p.length < 8 || p.length > 72) return 'Password must be 8-72 characters';
  if (!/[A-Za-z]/.test(p)) return 'Password must contain a letter';
  if (!/[0-9]/.test(p)) return 'Password must contain a number';
  return '';
}

export const validatePhone = (v, optional = false) => {
  const s = (v || '').trim();
  if (!s) return optional ? '' : 'Phone number is required';
  return PHONE_RE.test(s) ? '' : 'Enter a valid 10-digit Indian mobile number';
};

/** Returns { field: message } (empty object when valid). */
export function validateAddress(a) {
  const e = {};
  const t = (k) => String(a[k] || '').trim();
  if (t('fullName').length < 2) e.fullName = 'Full name is required';
  const p = validatePhone(a.phone);
  if (p) e.phone = p;
  if (!t('house')) e.house = 'House / building is required';
  if (t('street').length < 2) e.street = 'Street / locality is required';
  if (t('city').length < 2) e.city = 'City is required';
  if (t('state').length < 2) e.state = 'State is required';
  if (!PIN_RE.test(t('postalCode'))) e.postalCode = 'Enter a valid 6-digit postal code';
  return e;
}

export const formatAddress = (a) => (a ? [a.house, a.street, `${a.city}, ${a.state} ${a.postalCode}`].filter(Boolean).join(', ') : '');
