import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bike, Clock, Phone } from 'lucide-react';
import useApi from '../hooks/useApi';
import { useSocket, useSocketEvent } from '../context/SocketContext';
import OrderTimeline from '../components/OrderTimeline';
import RouteMap from '../components/RouteMap';
import { OrderStatusBadge } from '../components/Badges';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { formatDateTime, formatTime, formatAddress } from '../utils/format';
import '../css/orders.css';

/** Simulated rider progress along the route by status (NOT a GPS position). */
const PROGRESS = { PICKED_UP: 0.08, OUT_FOR_DELIVERY: 0.6, DELIVERED: 1 };

export default function OrderTracking() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/orders/${id}`);
  const socket = useSocket();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!socket) return undefined;
    socket.emit('order:join', id, (ack) => setLive(Boolean(ack && ack.ok)));
    return () => { socket.emit('order:leave', id); setLive(false); };
  }, [socket, id]);
  useSocketEvent('order:update', (u) => { if (u.orderId === id) reload(); });
  // Fallback polling when the socket is unavailable.
  useEffect(() => {
    if (live) return undefined;
    const t = setInterval(reload, 20000);
    return () => clearInterval(t);
  }, [live, reload]);

  const o = data && data.order;
  const tr = data && data.tracking;
  const restaurant = useMemo(() => (tr && tr.restaurantLocation ? { ...tr.restaurantLocation, name: (o.restaurant && o.restaurant.name) || (o.restaurantSnapshot && o.restaurantSnapshot.name) } : null), [tr, o]);

  if (loading && !data) return <div className="container page"><Skeleton h={420} /></div>;
  if (error) return <div className="container page"><EmptyState title="Cannot track this order" message={error} action={<Link to="/orders" className="btn btn--primary">My orders</Link>} /></div>;
  const dropoff = o.address.location ? { ...o.address.location, label: 'Delivery address (approximate, simulated)' } : null;
  const real = tr && tr.partnerLocation;
  const progress = !real && PROGRESS[o.status] !== undefined ? PROGRESS[o.status] : null;
  const active = !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status);

  return (
    <div className="container page">
      <div className="page-head">
        <div><h1>Track order #{o.orderNumber}</h1><p className="muted">{live ? 'Live updates on' : 'Refreshing every 20 seconds'}</p></div>
        <div className="row"><OrderStatusBadge status={o.status} /><Link to={`/orders/${o.id}`} className="btn btn--ghost btn--sm">Order details</Link></div>
      </div>
      <div className="cart-layout">
        <div className="stack">
          {active ? <div className="card eta"><Clock size={22} aria-hidden="true" /><div><strong>Estimated delivery {formatTime(o.estimatedDeliveryAt)}</strong><div className="muted">{formatDateTime(o.estimatedDeliveryAt)}</div></div></div> : null}
          {restaurant && dropoff ? (
            <section className="card" aria-label="Delivery map">
              <RouteMap restaurant={restaurant} dropoff={dropoff} partner={real || null} simulatedProgress={progress} />
              <p className="muted map-note">{real ? 'Live partner location.' : 'Simulated route: the rider marker is a demonstration, not a real GPS position. The drop-off point is approximate.'}</p>
            </section>
          ) : null}
          <section className="card"><h2>Delivering to</h2><p>{o.address.fullName}<br />{formatAddress(o.address)}</p></section>
        </div>
        <aside className="stack">
          <section className="card"><h2>Progress</h2><OrderTimeline timeline={data.timeline} history={o.statusHistory} status={o.status} /></section>
          {o.deliveryPartner ? (
            <section className="card partner">
              <h3><Bike size={18} aria-hidden="true" /> Your delivery partner</h3>
              <p><strong>{o.deliveryPartner.name}</strong>{o.deliveryPartner.vehicle ? <span className="muted"> · {o.deliveryPartner.vehicle}</span> : null}</p>
              {o.deliveryPartner.phone ? <a className="btn btn--ghost btn--sm" href={`tel:${o.deliveryPartner.phone}`}><Phone size={14} aria-hidden="true" /> Call</a> : null}
            </section>
          ) : active ? <section className="card muted">A delivery partner will be assigned once the restaurant starts preparing your food.</section> : null}
        </aside>
      </div>
    </div>
  );
}
