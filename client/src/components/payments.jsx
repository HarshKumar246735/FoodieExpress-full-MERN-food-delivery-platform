import { useCallback, useState } from 'react';
import { FlaskConical, CheckCircle2, XCircle, Ban } from 'lucide-react';
import api, { apiError } from '../services/api';
import { loadRazorpay } from '../utils/razorpay';

/**
 * Opens Razorpay Checkout (TEST mode) for an existing order and reports the outcome to the backend.
 * Resolves to { status: 'success' | 'failed' | 'cancelled', message }. Signature verification happens ONLY on the server.
 */
export async function payWithRazorpay(order, user) {
  let data;
  try {
    ({ data } = await api.post('/payments/create-order', { orderId: order.id }));
  } catch (e) {
    return { status: 'failed', message: apiError(e) };
  }
  let Razorpay;
  try {
    Razorpay = await loadRazorpay();
  } catch (e) {
    await api.post('/payments/report', { razorpayOrderId: data.razorpayOrderId, reason: e.message }).catch(() => {});
    return { status: 'failed', message: e.message };
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve(r); } };
    const report = (reason, cancelled) => api.post('/payments/report', { razorpayOrderId: data.razorpayOrderId, reason, cancelled }).catch(() => {});
    const rz = new Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      order_id: data.razorpayOrderId,
      name: 'FoodieExpress (TEST MODE)',
      description: `Order ${data.orderNumber}`,
      prefill: { name: user && user.name, email: user && user.email, contact: user && user.phone },
      theme: { color: '#ff6a1a' },
      handler: async (resp) => {
        try {
          await api.post('/payments/verify', resp);
          done({ status: 'success' });
        } catch (e) {
          done({ status: 'failed', message: apiError(e, 'Payment could not be verified.') });
        }
      },
      modal: { ondismiss: async () => { await report('Payment window closed', true); done({ status: 'cancelled', message: 'You closed the payment window.' }); } },
    });
    rz.on('payment.failed', async (resp) => {
      const reason = (resp && resp.error && resp.error.description) || 'Payment failed';
      await report(reason, false);
      done({ status: 'failed', message: reason });
    });
    rz.open();
  });
}

/** The clearly labelled DEMO PAYMENT panel: three buttons, each calls the server-side simulation. */
export function DemoPaymentPanel({ order, onResult }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const run = useCallback(async (outcome) => {
    setBusy(outcome);
    setError('');
    try {
      const { data } = await api.post('/demo-payments/simulate', { orderId: order.id, outcome });
      onResult({ status: outcome === 'success' ? 'success' : outcome === 'cancel' ? 'cancelled' : 'failed', data });
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy('');
    }
  }, [order.id, onResult]);

  return (
    <section className="demo-pay" aria-labelledby="demo-pay-h">
      <span className="demo-pay__tag"><FlaskConical size={14} aria-hidden="true" /> DEMO PAYMENT</span>
      <h2 id="demo-pay-h">Simulate your payment</h2>
      <p className="muted">This is a simulation. No card is used and no real money moves. Choose an outcome to see how the app responds.</p>
      <p><strong>Order {order.orderNumber}</strong></p>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      <div className="demo-pay__btns">
        <button type="button" className="btn btn--primary" disabled={Boolean(busy)} onClick={() => run('success')}><CheckCircle2 size={18} aria-hidden="true" /> {busy === 'success' ? 'Processing...' : 'Simulate Successful Payment'}</button>
        <button type="button" className="btn btn--danger" disabled={Boolean(busy)} onClick={() => run('failure')}><XCircle size={18} aria-hidden="true" /> {busy === 'failure' ? 'Processing...' : 'Simulate Failed Payment'}</button>
        <button type="button" className="btn btn--ghost" disabled={Boolean(busy)} onClick={() => run('cancel')}><Ban size={18} aria-hidden="true" /> {busy === 'cancel' ? 'Processing...' : 'Simulate Payment Cancellation'}</button>
      </div>
    </section>
  );
}
