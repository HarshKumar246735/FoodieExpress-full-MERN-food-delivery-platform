import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Printer, RotateCcw } from 'lucide-react';
import api, { apiError } from '../services/api';
import useApi from '../hooks/useApi';
import useReorder from '../hooks/useReorder';
import { useToast } from '../context/ToastContext';
import { useSocketEvent } from '../context/SocketContext';
import { OrderStatusBadge, PaymentStatusBadge } from '../components/Badges';
import { RatingInput } from '../components/Rating';
import PriceBreakdown from '../components/PriceBreakdown';
import OrderTimeline from '../components/OrderTimeline';
import { ConfirmDialog } from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { PAYMENT_METHOD, formatAddress, formatDateTime, rupee } from '../utils/format';
import '../css/orders.css';

const CANCELLABLE = ['PENDING', 'CONFIRMED'];

function ReviewForm({ orderId, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { toast.error('Choose a star rating first.'); return; }
    setBusy(true);
    try { await api.post(`/orders/${orderId}/review`, { rating, comment: comment.trim() }); toast.success('Thanks for your review!'); onDone(); } catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card no-print">
      <h2>Rate this order</h2>
      <RatingInput value={rating} onChange={setRating} />
      <div className="field" style={{ marginTop: 12 }}><label htmlFor="rv-c">Comment (optional)</label><textarea id="rv-c" className="textarea" rows={3} maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
      <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Sending...' : 'Submit review'}</button>
    </form>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/orders/${id}`);
  const { reorder, busyId } = useReorder();
  const [confirm, setConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  useSocketEvent('order:update', (u) => { if (u.orderId === id) reload(); });

  if (loading && !data) return <div className="container page"><Skeleton h={360} /></div>;
  if (error) return <div className="container page"><EmptyState title="Order not found" message={error} action={<Link to="/orders" className="btn btn--primary">My orders</Link>} /></div>;
  const o = data.order;
  const rname = (o.restaurant && o.restaurant.name) || (o.restaurantSnapshot && o.restaurantSnapshot.name);
  const live = !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status);
  const awaitingPayment = o.paymentMethod !== 'COD' && ['PENDING', 'FAILED', 'CANCELLED'].includes(o.paymentStatus) && live;

  const cancel = async () => {
    setCancelling(true);
    try { await api.post(`/orders/${o.id}/cancel`, { reason: 'Cancelled by customer' }); toast.success('Order cancelled.'); setConfirm(false); reload(); } catch (e) { toast.error(apiError(e)); setConfirm(false); } finally { setCancelling(false); }
  };

  return (
    <div className="container page receipt">
      <div className="page-head">
        <div><h1>Order #{o.orderNumber}</h1><p className="muted">{rname} · placed {formatDateTime(o.createdAt)}</p></div>
        <div className="row row--wrap no-print">
          <OrderStatusBadge status={o.status} /><PaymentStatusBadge status={o.paymentStatus} />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => window.print()}><Printer size={14} aria-hidden="true" /> Print receipt</button>
        </div>
      </div>

      {awaitingPayment ? <div className="alert alert--warn no-print" role="status">Payment for this order is not complete. <Link to={`/payment/failure/${o.id}`}><strong>Complete payment</strong></Link></div> : null}
      {o.rejectionReason ? <div className="alert alert--error" role="status">Rejected by the restaurant: {o.rejectionReason}</div> : null}
      {o.status === 'CANCELLED' && o.cancelReason ? <div className="alert alert--info" role="status">Cancelled: {o.cancelReason}</div> : null}

      <div className="cart-layout">
        <div className="stack">
          <section className="card">
            <h2>Items</h2>
            <ul className="pay-items">{o.items.map((i) => <li key={i.food}><span>{i.quantity} x {i.name}<small className="muted"> @ {rupee(i.unitPrice)}</small></span><span>{rupee(i.lineTotal)}</span></li>)}</ul>
          </section>
          <section className="card">
            <h2><MapPin size={18} aria-hidden="true" /> Delivery</h2>
            <p>{o.address.fullName} · {o.address.phone}<br />{formatAddress(o.address)}</p>
            {o.instructions ? <p className="muted">Instructions: {o.instructions}</p> : null}
            {live ? <p className="muted">Estimated delivery: {formatDateTime(o.estimatedDeliveryAt)}</p> : null}
            {o.deliveryPartner ? <p>Delivery partner: <strong>{o.deliveryPartner.name}</strong>{o.deliveryPartner.vehicle ? ` (${o.deliveryPartner.vehicle})` : ''}</p> : null}
          </section>
          <section className="card no-print"><h2>Progress</h2><OrderTimeline timeline={data.timeline} history={o.statusHistory} status={o.status} /></section>
          {o.status === 'DELIVERED' && !o.reviewed ? <ReviewForm orderId={o.id} onDone={reload} /> : null}
        </div>
        <aside className="stack">
          <PriceBreakdown pricing={o.pricing} couponCode={o.coupon.code} />
          <section className="card">
            <h3>Payment</h3>
            <p>{PAYMENT_METHOD[o.paymentMethod] || o.paymentMethod}{o.paymentMethod === 'DEMO' ? ' (simulated)' : ''}</p>
            {o.payment ? <p className="muted">Reference: {o.payment.transactionRef || 'n/a'}{o.payment.paidAt ? ` · paid ${formatDateTime(o.payment.paidAt)}` : ''}</p> : null}
            {o.payment && o.payment.failureReason ? <p className="field__error">{o.payment.failureReason}</p> : null}
          </section>
          <div className="stack no-print">
            {live ? <Link to={`/orders/${o.id}/track`} className="btn btn--primary btn--block">Track order</Link> : null}
            {CANCELLABLE.includes(o.status) ? <button type="button" className="btn btn--danger btn--block" onClick={() => setConfirm(true)}>Cancel order</button> : null}
            <button type="button" className="btn btn--soft btn--block" onClick={() => reorder(o.id)} disabled={busyId === o.id}><RotateCcw size={14} aria-hidden="true" /> Reorder</button>
            <Link to="/support" state={{ orderId: o.id }} className="btn btn--ghost btn--block">Report a problem</Link>
          </div>
        </aside>
      </div>
      <ConfirmDialog open={confirm} danger busy={cancelling} title="Cancel this order?" message={o.paymentStatus === 'SUCCESS' && o.paymentMethod !== 'COD' ? 'Your payment will be refunded.' : 'This cannot be undone.'} confirmLabel="Yes, cancel order" cancelLabel="Keep order" onCancel={() => setConfirm(false)} onConfirm={cancel} />
    </div>
  );
}
