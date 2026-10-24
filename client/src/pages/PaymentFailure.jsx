import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Mail, Phone, XCircle } from 'lucide-react';
import api, { apiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import { DemoPaymentPanel, payWithRazorpay } from '../components/payments';
import { Skeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { rupee } from '../utils/format';
import '../css/payment.css';

export default function PaymentFailure() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const o = useApi(`/orders/${orderId}`);
  const p = useApi(`/payments/order/${orderId}`);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);

  if (o.loading && !o.data) return <div className="container page"><Skeleton h={260} /></div>;
  if (o.error) return <div className="container page"><EmptyState title="Order not found" message={o.error} action={<Link to="/orders" className="btn btn--primary">My orders</Link>} /></div>;
  const order = o.data.order;
  const last = p.data && p.data.payments[0];
  const cancelled = (last && last.status === 'CANCELLED') || order.paymentStatus === 'CANCELLED';
  const reason = (last && last.failureReason) || (cancelled ? 'The payment was cancelled.' : 'The payment could not be completed.');
  const canRetry = order.paymentMethod !== 'COD' && order.paymentStatus !== 'SUCCESS' && !['CANCELLED', 'REJECTED', 'DELIVERED'].includes(order.status);
  const reload = () => { o.reload(); p.reload(); };

  const afterAttempt = (status) => {
    if (status === 'success') navigate(`/payment/success/${order.id}`, { replace: true });
    else { setDemo(false); reload(); }
  };
  const retry = async (method) => {
    setBusy(true);
    try {
      if (method !== order.paymentMethod) await api.post('/payments/retry', { orderId: order.id, method });
      if (method === 'DEMO') { setDemo(true); return; }
      const r = await payWithRazorpay({ ...order, id: order.id }, user);
      if (r.status !== 'success') toast.error(r.message || 'Payment was not completed.');
      afterAttempt(r.status);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (demo) return <div className="container page co-narrow"><DemoPaymentPanel order={order} onResult={(r) => afterAttempt(r.status)} /></div>;

  return (
    <div className="container page pay-result">
      <div className="pay-result__hero pay-result__hero--bad">
        <span className="pay-result__icon" aria-hidden="true"><XCircle size={56} /></span>
        <h1>{cancelled ? 'Payment cancelled' : 'Payment failed'}</h1>
        <p role="alert">{reason}</p>
        <p className="muted">Order {order.orderNumber} · {rupee(order.pricing.total)}. You have not been charged for this attempt.</p>
      </div>
      <div className="pay-result__actions">
        {canRetry ? (
          <>
            {order.paymentMethod === 'RAZORPAY' ? <button type="button" className="btn btn--primary" disabled={busy} onClick={() => retry('RAZORPAY')}>{busy ? 'Opening...' : 'Retry payment'}</button> : null}
            {order.paymentMethod === 'DEMO' ? <button type="button" className="btn btn--primary" disabled={busy} onClick={() => retry('DEMO')}>Retry payment</button> : null}
            {order.paymentMethod === 'RAZORPAY' ? <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => retry('DEMO')}>Use demo payment instead</button> : null}
          </>
        ) : null}
        <Link to="/cart" className="btn btn--ghost">Return to cart</Link>
        <Link to={`/orders/${order.id}`} className="btn btn--ghost">View order</Link>
      </div>
      <section className="card pay-support">
        <h2>Need help?</h2>
        <p><Phone size={14} aria-hidden="true" /> <a href="tel:+918000000000">+91 80000 00000</a> · <Mail size={14} aria-hidden="true" /> <a href="mailto:support@foodieexpress.demo">support@foodieexpress.demo</a> · <Link to="/support">Report a problem</Link></p>
      </section>
    </div>
  );
}
