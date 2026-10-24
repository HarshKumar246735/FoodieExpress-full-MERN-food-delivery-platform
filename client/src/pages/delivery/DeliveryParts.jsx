import { MapPin, Phone, Store, Wallet } from 'lucide-react';
import { rupee } from '../../utils/format';

/** Compact summary of one assignment (used by the available list and history). Shows only what the server returns. */
export function JobSummary({ a }) {
  const o = a.order;
  if (!o) return <p className="muted">Order details unavailable.</p>;
  return (
    <div className="dv-job__info">
      <div className="dv-line"><Store size={16} aria-hidden="true" /><div><strong>{o.pickup.name}</strong><div className="muted">{o.pickup.address}</div></div></div>
      <div className="dv-line"><MapPin size={16} aria-hidden="true" /><div><strong>{o.dropoff.name || 'Customer'}</strong><div className="muted">{o.dropoff.address}</div></div></div>
      {o.dropoff.phone ? <div className="dv-line"><Phone size={16} aria-hidden="true" /><a href={`tel:${o.dropoff.phone.replace(/[^\d+]/g, '')}`}>{o.dropoff.phone}</a></div> : null}
      <div className="dv-line"><Wallet size={16} aria-hidden="true" />
        <span>{o.itemCount} item{o.itemCount === 1 ? '' : 's'} · Order {rupee(o.total)} · Earn <strong>{rupee(a.earning)}</strong>{o.collectCash ? <> · <strong className="dv-cash">Collect {rupee(o.collectCash)} cash</strong></> : null}</span>
      </div>
      <p className="muted dv-items">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
    </div>
  );
}
