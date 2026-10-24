import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LifeBuoy, Mail, Phone } from 'lucide-react';
import api, { apiError } from '../services/api';
import useApi from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import AuthField from '../components/AuthField';
import { formatDate } from '../utils/format';
import '../css/account.css';

const STATUS_TONE = { open: 'amber', resolved: 'green', closed: 'blue', in_review: 'blue' };

export default function Support() {
  const toast = useToast();
  const { state } = useLocation();
  const mine = useApi('/orders/complaints/mine');
  const orders = useApi('/orders/my-orders', { params: { limit: 20 } });
  const [f, setF] = useState({ subject: '', message: '', order: (state && state.orderId) || '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (f.subject.trim().length < 3) errs.subject = 'Subject must be at least 3 characters';
    if (f.message.trim().length < 10) errs.message = 'Please describe the issue (at least 10 characters)';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const { data } = await api.post('/orders/complaints', { subject: f.subject.trim(), message: f.message.trim(), order: f.order || undefined });
      toast.success(data.message || 'Complaint submitted');
      setF({ subject: '', message: '', order: '' });
      mine.reload();
    } catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };

  return (
    <div className="container page">
      <div className="page-head"><h1><LifeBuoy size={28} aria-hidden="true" /> Support</h1></div>
      <div className="acc-grid">
        <form className="card" onSubmit={submit} noValidate>
          <h2>Report a problem</h2>
          <AuthField label="Related order (optional)" as="select" value={f.order} onChange={set('order')}>
            <option value="">Not about a specific order</option>
            {orders.data ? orders.data.orders.map((o) => <option key={o.id} value={o.id}>#{o.orderNumber}</option>) : null}
          </AuthField>
          <AuthField label="Subject" value={f.subject} onChange={set('subject')} error={errors.subject} maxLength={120} />
          <AuthField label="What happened?" as="textarea" rows={5} value={f.message} onChange={set('message')} error={errors.message} maxLength={1000} />
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit complaint'}</button>
        </form>
        <div className="stack">
          <section className="card">
            <h2>Contact us</h2>
            <p><Phone size={14} aria-hidden="true" /> <a href="tel:+918000000000">+91 80000 00000</a> (10am to 10pm)</p>
            <p><Mail size={14} aria-hidden="true" /> <a href="mailto:support@foodieexpress.demo">support@foodieexpress.demo</a></p>
          </section>
          <section className="card">
            <h2>Your complaints</h2>
            {mine.loading && !mine.data ? <p className="muted">Loading...</p> : mine.error ? <p className="field__error">{mine.error}</p> : mine.data.complaints.length === 0 ? <p className="muted">You have not submitted any complaints.</p> : (
              <ul className="notif-list">
                {mine.data.complaints.map((c) => (
                  <li key={c.id} className="notif">
                    <div><strong>{c.subject}</strong> <span className={`badge badge--${STATUS_TONE[c.status] || 'amber'}`}>{String(c.status).replace('_', ' ')}</span><p>{c.message}</p>{c.adminResponse ? <p className="acc-reply"><strong>Response:</strong> {c.adminResponse}</p> : null}<small className="muted">{formatDate(c.createdAt)}</small></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
