import { useState } from 'react';
import { ClipboardList, Eye } from 'lucide-react';
import useListQuery from './parts-a/useListQuery';
import SearchBox from './parts-a/SearchBox';
import OrderDetailModal from './parts-a/OrderDetailModal';
import CancelOrderDialog from './parts-a/CancelOrderDialog';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { OrderStatusBadge, PaymentStatusBadge } from '../../components/Badges';
import { useSocketEvent } from '../../context/SocketContext';
import { formatDateTime, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, rupee } from '../../utils/format';

// Statuses the state machine still lets an admin cancel (see server/services/orderState.js).
const CANCELLABLE = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'];

export default function AdminOrders() {
  const L = useListQuery('/admin/orders', { status: '', paymentStatus: '', paymentMethod: '', from: '', to: '' });
  const [view, setView] = useState(null);
  const [cancel, setCancel] = useState(null);
  const orders = (L.data && L.data.orders) || [];
  const pg = (L.data && L.data.pagination) || { page: 1, pages: 1, total: 0 };
  useSocketEvent('order:update', () => L.reload());
  const rest = (o) => (typeof o.restaurant === 'object' ? o.restaurant.name : (o.restaurantSnapshot && o.restaurantSnapshot.name) || '-');

  return (
    <>
      <div className="dash-head"><div><h1>Orders</h1><p className="muted">{pg.total} orders. Updates live.</p></div></div>
      <Panel>
        <div className="toolbar">
          <SearchBox label="Search orders" value={L.draft} onChange={L.setSearch} placeholder="Search by order number" />
          <label className="sr-only" htmlFor="o-status">Order status</label>
          <select id="o-status" className="select" value={L.filters.status} onChange={(e) => L.setFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(ORDER_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
          <label className="sr-only" htmlFor="o-pay">Payment status</label>
          <select id="o-pay" className="select" value={L.filters.paymentStatus} onChange={(e) => L.setFilter('paymentStatus', e.target.value)}>
            <option value="">Any payment</option>
            {Object.entries(PAYMENT_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
          <label className="sr-only" htmlFor="o-method">Payment method</label>
          <select id="o-method" className="select" value={L.filters.paymentMethod} onChange={(e) => L.setFilter('paymentMethod', e.target.value)}>
            <option value="">Any method</option>
            {Object.entries(PAYMENT_METHOD).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="adm-date"><span className="sr-only">From date</span><input type="date" className="input" value={L.filters.from} max={L.filters.to || undefined} onChange={(e) => L.setFilter('from', e.target.value)} aria-label="From date" /></label>
          <label className="adm-date"><span className="sr-only">To date</span><input type="date" className="input" value={L.filters.to} min={L.filters.from || undefined} onChange={(e) => L.setFilter('to', e.target.value)} aria-label="To date" /></label>
          {L.hasFilters ? <button type="button" className="btn btn--ghost btn--sm" onClick={L.clear}>Clear</button> : null}
        </div>
        <DataState loading={L.loading && !L.data} error={L.error} onRetry={L.reload}>
          {orders.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No orders found" message="Try a different search or filter." />
          ) : (
            <>
              <div className={`table-wrap ${L.loading ? 'lst__dim' : ''}`}>
                <table className="table">
                  <thead><tr><th>Order</th><th>Restaurant</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td><strong>{o.orderNumber}</strong></td>
                        <td>{rest(o)}</td>
                        <td>{typeof o.customer === 'object' ? o.customer.name : '-'}</td>
                        <td>{rupee(o.pricing.total)}</td>
                        <td><PaymentStatusBadge status={o.paymentStatus} /><br /><span className="muted">{PAYMENT_METHOD[o.paymentMethod] || o.paymentMethod}</span></td>
                        <td><OrderStatusBadge status={o.status} /></td>
                        <td>{formatDateTime(o.createdAt)}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setView(o)}><Eye size={15} aria-hidden="true" /> View</button>
                            {CANCELLABLE.includes(o.status) ? <button type="button" className="btn btn--ghost btn--sm adm-danger" onClick={() => setCancel(o)}>Cancel</button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={pg.page} pages={pg.pages} onChange={L.setPage} />
            </>
          )}
        </DataState>
      </Panel>
      <OrderDetailModal order={view} onClose={() => setView(null)} canCancel={view ? CANCELLABLE.includes(view.status) : false} onCancel={() => { setCancel(view); setView(null); }} />
      <CancelOrderDialog order={cancel} onClose={() => setCancel(null)} onDone={L.reload} />
    </>
  );
}
