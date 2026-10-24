import { useState } from 'react';
import { Check, ChefHat, PackageCheck, Receipt, X } from 'lucide-react';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';
import { OrderStatusBadge, PaymentStatusBadge, VegMark } from '../../components/Badges';
import useApi from '../../hooks/useApi';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { PAYMENT_METHOD, formatDateTime, formatAddress, rupee, timeAgo } from '../../utils/format';
import { scope, useOwner } from './OwnerContext';
import RestaurantSwitcher, { ApprovalNotice } from './RestaurantSwitcher';

const TABS = [['PENDING', 'New'], ['active', 'In progress'], ['past', 'Past']];
// Owner-allowed transitions (mirrors server/services/orderState.js ROLE_TRANSITIONS.owner).
const NEXT = {
  PENDING: [{ to: 'CONFIRMED', label: 'Accept', icon: Check, kind: 'primary' }, { to: 'REJECTED', label: 'Reject', icon: X, kind: 'danger', reason: true }],
  CONFIRMED: [{ to: 'PREPARING', label: 'Start preparing', icon: ChefHat, kind: 'primary' }, { to: 'CANCELLED', label: 'Cancel', icon: X, kind: 'ghost', reason: true }],
  PREPARING: [{ to: 'READY_FOR_PICKUP', label: 'Ready for pickup', icon: PackageCheck, kind: 'primary' }, { to: 'CANCELLED', label: 'Cancel', icon: X, kind: 'ghost', reason: true }],
};

function OrderCard({ order, onAct }) {
  const actions = NEXT[order.status] || [];
  const a = order.address || {};
  return (
    <article className="own-order card card--flat">
      <header className="own-order__head">
        <div>
          <strong>{order.orderNumber}</strong>
          <span className="muted"> · {order.customer && order.customer.name} · {timeAgo(order.createdAt)}</span>
        </div>
        <div className="row row--wrap"><OrderStatusBadge status={order.status} /><PaymentStatusBadge status={order.paymentStatus} /></div>
      </header>
      <ul className="own-order__items">
        {order.items.map((i) => (
          <li key={`${i.food}-${i.name}`}><VegMark isVeg={i.isVeg} /><span>{i.quantity} × {i.name}</span><span className="muted">{rupee(i.lineTotal)}</span></li>
        ))}
      </ul>
      <dl className="kv">
        <dt>Total</dt><dd>{rupee(order.pricing.total)} · {PAYMENT_METHOD[order.paymentMethod] || order.paymentMethod}</dd>
        <dt>Deliver to</dt><dd>{a.fullName}, {formatAddress(a)}{a.phone ? ` · ${a.phone}` : ''}</dd>
        {order.instructions ? (<><dt>Note</dt><dd>{order.instructions}</dd></>) : null}
        {order.deliveryPartner ? (<><dt>Rider</dt><dd>{order.deliveryPartner.name}{order.deliveryPartner.vehicle ? ` (${order.deliveryPartner.vehicle})` : ''}</dd></>) : null}
        {order.rejectionReason ? (<><dt>Rejected</dt><dd>{order.rejectionReason}</dd></>) : null}
        {order.cancelReason ? (<><dt>Cancelled</dt><dd>{order.cancelReason}</dd></>) : null}
        <dt>Placed</dt><dd>{formatDateTime(order.createdAt)}</dd>
      </dl>
      {actions.length ? (
        <div className="row-actions own-order__actions">
          {actions.map((x) => (
            <button key={x.to} type="button" className={`btn btn--sm ${x.kind === 'primary' ? 'btn--primary' : x.kind === 'danger' ? 'btn--danger' : 'btn--ghost'}`} onClick={() => onAct(order, x)}>
              <x.icon size={15} aria-hidden="true" /> {x.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function OwnerOrders() {
  const toast = useToast();
  const { restaurantId, restaurant } = useOwner();
  const [tab, setTab] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [reasonFor, setReasonFor] = useState(null); // { order, action }
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState('');
  const [busy, setBusy] = useState(false);
  const approved = restaurant && restaurant.approvalStatus === 'approved';
  const { data, loading, error, reload } = useApi('/owner/orders', { params: scope(restaurantId, { status: tab, page, limit: 15 }), enabled: Boolean(restaurantId && approved) });
  useSocketEvent('order:update', () => reload());

  const run = async (order, action, why) => {
    setBusy(true);
    try {
      await api.patch(`/owner/orders/${order.id}/status`, { status: action.to, reason: why || undefined });
      toast.success(`${order.orderNumber}: ${action.label.toLowerCase()} done`);
      setReasonFor(null);
      setReason('');
      reload();
    } catch (e) {
      toast.error(apiError(e));
      reload();
    } finally {
      setBusy(false);
    }
  };
  const onAct = (order, action) => {
    if (action.reason) { setReasonFor({ order, action }); setReason(''); setReasonErr(''); } else run(order, action);
  };
  const submitReason = (e) => {
    e.preventDefault();
    if (reason.trim().length < 3) { setReasonErr('Please give a short reason (at least 3 characters).'); return; }
    run(reasonFor.order, reasonFor.action, reason.trim());
  };

  const orders = (data && data.orders) || [];
  return (
    <>
      <div className="dash-head"><h1>Orders</h1><RestaurantSwitcher /></div>
      <ApprovalNotice restaurant={restaurant} />
      {approved ? (
        <Panel>
          <div className="tabs" role="tablist" aria-label="Order filter">
            {TABS.map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'is-active' : ''}`} onClick={() => { setTab(k); setPage(1); }}>{l}</button>
            ))}
          </div>
          <DataState loading={loading && !data} error={error} onRetry={reload}>
            {orders.length === 0 ? (
              <EmptyState icon={Receipt} title={tab === 'PENDING' ? 'No new orders' : 'Nothing here'} message="New orders appear automatically; no need to refresh." />
            ) : (
              <>
                <div className="stack" aria-live="polite">{orders.map((o) => <OrderCard key={o.id} order={o} onAct={onAct} />)}</div>
                <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />
              </>
            )}
          </DataState>
        </Panel>
      ) : null}

      <Modal
        open={Boolean(reasonFor)}
        title={reasonFor ? `${reasonFor.action.label} ${reasonFor.order.orderNumber}` : ''}
        onClose={() => !busy && setReasonFor(null)}
        footer={<><button type="button" className="btn btn--ghost" onClick={() => setReasonFor(null)} disabled={busy}>Back</button><button type="submit" form="own-reason" className="btn btn--danger" disabled={busy}>{busy ? 'Please wait...' : 'Confirm'}</button></>}
      >
        <form id="own-reason" onSubmit={submitReason} noValidate>
          <p className="muted">The customer is notified with this reason{reasonFor && reasonFor.order.paymentStatus === 'SUCCESS' ? ' and any online payment is refunded' : ''}.</p>
          <div className="field">
            <label htmlFor="own-reason-text">Reason</label>
            <textarea id="own-reason-text" className={`textarea ${reasonErr ? 'input--error' : ''}`} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Item sold out" />
            {reasonErr ? <span className="field__error" role="alert">{reasonErr}</span> : null}
          </div>
        </form>
      </Modal>
    </>
  );
}
