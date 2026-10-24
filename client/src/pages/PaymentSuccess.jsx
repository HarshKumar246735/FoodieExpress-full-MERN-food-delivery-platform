import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock } from 'lucide-react';
import useApi from '../hooks/useApi';
import { PAYMENT_METHOD, formatAddress, formatDateTime, rupee } from '../utils/format';
import { Skeleton } from '../components/Skeleton';
import PriceBreakdown from '../components/PriceBreakdown';
import EmptyState from '../components/EmptyState';
import '../css/payment.css';

export default function PaymentSuccess() {
  const { orderId } = useParams();
  const o = useApi(`/orders/${orderId}`);
  const p = useApi(`/payments/order/${orderId}`);
  if (o.loading && !o.data) return <div className="container page"><Skeleton h={320} /></div>;
  if (o.error) return <div className="container page"><EmptyState title="Order not found" message={o.error} action={<Link to="/orders" className="btn btn--primary">My orders</Link>} /></div>;
  const order = o.data.order;
  const pay = p.data && p.data.payments[0];
  const isCod = order.paymentMethod === 'COD';
  const paid = order.paymentStatus === 'SUCCESS';
  return (
    <div className="container page pay-result">
      <div className="pay-result__hero pay-result__hero--ok">
        <span className="pay-result__icon" aria-hidden="true"><CheckCircle2 size={56} /></span>
        <h1>{isCod ? 'Order placed!' : paid ? 'Payment successful' : 'Order received'}</h1>
        <p className="muted">{isCod ? 'Pay in cash when your order arrives.' : paid ? 'Your payment was confirmed and the restaurant has been notified.' : 'We are confirming your payment.'}</p>
      </div>
      <div className="pay-result__grid">
        <section className="card">
          <h2>Details</h2>
          <dl className="co-review">
            <dt>Order number</dt><dd><strong>{order.orderNumber}</strong></dd>
            <dt>Transaction reference</dt><dd>{(pay && pay.transactionRef) || (o.data.order.payment && o.data.order.payment.transactionRef) || 'Pending'}</dd>
            <dt>Amount {paid ? 'paid' : 'payable'}</dt><dd>{rupee(order.pricing.total)}</dd>
            <dt>Payment method</dt><dd>{PAYMENT_METHOD[order.paymentMethod] || order.paymentMethod}{order.paymentMethod === 'DEMO' ? ' (simulated, no real money)' : ''}</dd>
            <dt>Deliver to</dt><dd>{order.address.fullName}, {formatAddress(order.address)}</dd>
            <dt>Estimated delivery</dt><dd><Clock size={14} aria-hidden="true" /> {formatDateTime(order.estimatedDeliveryAt)}</dd>
          </dl>
          <h3>Items</h3>
          <ul className="pay-items">{order.items.map((i) => <li key={i.food}><span>{i.quantity} x {i.name}</span><span>{rupee(i.lineTotal)}</span></li>)}</ul>
        </section>
        <aside className="stack">
          <PriceBreakdown pricing={order.pricing} couponCode={order.coupon.code} />
          <Link to={`/orders/${order.id}/track`} className="btn btn--primary btn--block">Track order</Link>
          <Link to={`/orders/${order.id}`} className="btn btn--ghost btn--block">View order</Link>
          <Link to="/restaurants" className="btn btn--ghost btn--block">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
