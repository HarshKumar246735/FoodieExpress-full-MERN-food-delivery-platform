'use strict';

/**
 * Deterministic, SIMULATED drop-off coordinate near the restaurant, derived from the postal code.
 * The app has no geocoder, so the tracking map uses this clearly-labelled approximation
 * (the UI always says "simulated route"). It is not the customer's real GPS position.
 */
function simulatedDropoff(restaurantLocation, postalCode) {
  const base = restaurantLocation && Number.isFinite(restaurantLocation.lat) ? restaurantLocation : { lat: 12.9716, lng: 77.5946 };
  let h = 0;
  const s = String(postalCode || '000000');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 9973;
  const angle = (h % 360) * (Math.PI / 180);
  const dist = 0.012 + (h % 20) * 0.0007; // ~1.3 - 2.6 km
  return { lat: +(base.lat + Math.sin(angle) * dist).toFixed(5), lng: +(base.lng + Math.cos(angle) * dist).toFixed(5) };
}

/** 10:00-23:00 every day. */
function defaultHours() {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '10:00', close: '23:00', closed: false }));
}

module.exports = { simulatedDropoff, defaultHours };
