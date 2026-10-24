import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, RotateCcw } from 'lucide-react';
import useApi from '../hooks/useApi';
import useReorder from '../hooks/useReorder';
import { useSocketEvent } from '../context/SocketContext';
import { useParamsPatch } from '../components/FilterPanel';
import { OrderStatusBadge, PaymentStatusBadge } from '../components/Badges';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { formatDateTime, rupee } from '../utils/format';
import '../css/orders.css';

const FILTERS = [['', 'All'], ['active', 'Active'], ['past', 'Past'], ['DELIVERED', 'Delivered'], ['CANCELLED', 'Cancelled']];

export default function Orders() {
  const [sp, patch] = useParamsPatch();
  const status = sp.get('status') || '';
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const params = useMemo(() => ({ page, limit: 8, ...(status ? { status } : {}) }), [page, status]);
  const { data, loading, error, reload } = useApi('/orders/my-orders', { params });
  const { reorder, busyId } = useReorder();
  useSocketEvent('order:update', () => reload());

  return (
    <div className="container page">
      <div className="page-head"><h1>My orders</h1></div>
      <div className="rd-tabs" role="group" aria-label="Filter orders">
        {FILTERS.map(([v, l]) => <button key={v || 'all'} type="button" className={`chip ${status === v ? 'is-active' : ''}`} aria-pressed={status === v} onClick={() => patch({ status: v })}>{l}</button>)}
      </div>
      {error ? <div className="alert alert--error" role="alert">{error} <button type="button" className="btn btn--sm btn--ghost" onClick={reload}>Try again</button></div>
        : loading && !data ? <div className="stack"><Skeleton h={110} /><Skeleton h={110} /><Skeleton h={110} /></div>
        : data.orders.length === 0 ? <EmptyState icon={ClipboardList} title="No orders here yet" message={status ? 'No orders match this filter.' : 'When you place an order it will show up here.'} action={<Link to="/restaurants" className="btn btn--primary">Order something tasty</Link>} />
        : (
          <>
            <ul className="ord-list">
              {data.orders.map((o) => {
                const rname = (o.restaurant && o.restaurant.name) || (o.restaurantSnapshot && o.restaurantSnapshot.name) || 'Restaurant';
                const live = !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status);
                return (
                  <li key={o.id} className="card ord">
                    <div className="ord__top">
                      <div><strong>{rname}</strong><div className="muted">#{o.orderNumber} · {formatDateTime(o.createdAt)}</div></div>
                      <div className="row row--wrap"><OrderStatusBadge status={o.status} /><PaymentStatusBadge status={o.paymentStatus} /></div>
                    </div>
                    <p className="ord__items muted">{o.items.map((i) => `${i.quantity} x ${i.name}`).join(', ')}</p>
                    <div className="ord__bottom">
                      <strong>{rupee(o.pricing.total)}</strong>
                      <div className="row row--wrap">
                        {live ? <Link to={`/orders/${o.id}/track`} className="btn btn--primary btn--sm">Track</Link> : null}
                        <Link to={`/orders/${o.id}`} className="btn btn--ghost btn--sm">Details</Link>
                        <button type="button" className="btn btn--soft btn--sm" onClick={() => reorder(o.id)} disabled={busyId === o.id}><RotateCcw size={14} aria-hidden="true" /> {busyId === o.id ? 'Adding...' : 'Reorder'}</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={(n) => { patch({ page: n }, { keepPage: true }); window.scrollTo({ top: 0 }); }} />
          </>
        )}
    </div>
  );
}
