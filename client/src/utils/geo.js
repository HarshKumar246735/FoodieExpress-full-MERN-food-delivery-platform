// Mirrors server/utils/geo.js: a deterministic, SIMULATED drop-off near the restaurant (no geocoder in this app).
export function simulatedDropoff(restaurantLocation, postalCode) {
  const base = restaurantLocation && Number.isFinite(restaurantLocation.lat) ? restaurantLocation : { lat: 12.9716, lng: 77.5946 };
  let h = 0;
  const s = String(postalCode || '000000');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 9973;
  const angle = (h % 360) * (Math.PI / 180);
  const dist = 0.012 + (h % 20) * 0.0007;
  return { lat: +(base.lat + Math.sin(angle) * dist).toFixed(5), lng: +(base.lng + Math.cos(angle) * dist).toFixed(5) };
}
