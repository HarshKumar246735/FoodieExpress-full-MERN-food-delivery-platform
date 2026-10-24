import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../css/map.css';

/**
 * Leaflet + OpenStreetMap map showing restaurant -> drop-off.
 *
 * HONESTY RULE: unless `partner` holds real, recently shared GPS coordinates, any moving marker is a
 * SIMULATION driven by `simulatedProgress` (0..1) and is labelled as such on the map.
 *
 * props:
 *  restaurant { lat, lng, name }      dropoff { lat, lng, label }
 *  partner    { lat, lng } | null     real partner position (only when the server says it is fresh)
 *  simulatedProgress number | null    0..1 position of the clearly-labelled simulated rider
 */
const pin = (cls, text) => L.divIcon({ className: '', html: `<div class="rmap-pin ${cls}"><span>${text}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 34] });

const valid = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/** Gentle curve between two points so the route does not look like a ruler line. */
function routePoints(a, b, steps = 24) {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const bend = Math.sin(Math.PI * t) * 0.18;
    pts.push([a.lat + dy * t - dx * bend * 0.35, a.lng + dx * t + dy * bend * 0.35]);
  }
  return pts;
}

export default function RouteMap({ restaurant, dropoff, partner = null, simulatedProgress = null, height = 340 }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    if (!el.current || map.current) return undefined;
    map.current = L.map(el.current, { scrollWheelZoom: false, zoomControl: true }).setView([12.9716, 77.5946], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const bounds = [];
    if (valid(restaurant)) {
      L.marker([restaurant.lat, restaurant.lng], { icon: pin('rmap-pin--rest', 'R') }).bindPopup(`Restaurant: ${restaurant.name || ''}`).addTo(layer.current);
      bounds.push([restaurant.lat, restaurant.lng]);
    }
    if (valid(dropoff)) {
      L.marker([dropoff.lat, dropoff.lng], { icon: pin('rmap-pin--drop', 'D') }).bindPopup(dropoff.label || 'Delivery address (approximate)').addTo(layer.current);
      bounds.push([dropoff.lat, dropoff.lng]);
    }
    if (valid(restaurant) && valid(dropoff)) {
      const pts = routePoints(restaurant, dropoff);
      L.polyline(pts, { color: '#ff6a1a', weight: 4, opacity: 0.85, dashArray: '8 8' }).addTo(layer.current);
      if (valid(partner)) {
        L.marker([partner.lat, partner.lng], { icon: pin('rmap-pin--rider', 'P') }).bindPopup('Delivery partner (live location)').addTo(layer.current);
        bounds.push([partner.lat, partner.lng]);
      } else if (simulatedProgress !== null && simulatedProgress !== undefined) {
        const idx = Math.max(0, Math.min(pts.length - 1, Math.round(simulatedProgress * (pts.length - 1))));
        L.marker(pts[idx], { icon: pin('rmap-pin--sim', 'S') }).bindPopup('SIMULATED position for demonstration. Not a real GPS location.').addTo(layer.current);
      }
    }
    if (bounds.length > 1) map.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    else if (bounds.length === 1) map.current.setView(bounds[0], 15);
  }, [restaurant, dropoff, partner, simulatedProgress]);

  const live = valid(partner);
  return (
    <figure className="rmap">
      <div ref={el} className="rmap__canvas" style={{ height }} role="img" aria-label="Map showing the restaurant and the delivery address" />
      <figcaption className="rmap__caption">
        <span className="rmap__legend"><i className="rmap-dot rmap-dot--rest" /> Restaurant</span>
        <span className="rmap__legend"><i className="rmap-dot rmap-dot--drop" /> Drop-off (approximate)</span>
        {live ? <span className="rmap__legend"><i className="rmap-dot rmap-dot--rider" /> Partner (live)</span> : simulatedProgress !== null && simulatedProgress !== undefined ? <span className="rmap__legend"><i className="rmap-dot rmap-dot--sim" /> Simulated rider (demo only)</span> : null}
        <span className="rmap__note muted">{live ? 'Live location shared by the delivery partner.' : 'Demo map: the route and drop-off are illustrative, not real GPS tracking.'}</span>
      </figcaption>
    </figure>
  );
}
