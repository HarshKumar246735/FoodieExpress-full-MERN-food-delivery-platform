import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, IndianRupee, ShoppingBag, Star } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import StatCard from '../../components/dash/StatCard';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Rating from '../../components/Rating';
import { OrderStatusBadge } from '../../components/Badges';
import useApi from '../../hooks/useApi';
import { useSocketEvent } from '../../context/SocketContext';
import { rupee, timeAgo } from '../../utils/format';
import { scope, useOwner } from './OwnerContext';
import RestaurantSwitcher, { ApprovalNotice } from './RestaurantSwitcher';

const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function OwnerOverview() {
  const { restaurantId, restaurant } = useOwner();
  const { data, loading, error, reload } = useApi('/owner/dashboard', { params: scope(restaurantId), enabled: Boolean(restaurantId) });
  useSocketEvent('order:update', () => reload());
  const s = data && data.stats;

  return (
    <>
      <div className="dash-head">
        <h1>Overview</h1>
        <RestaurantSwitcher />
      </div>
      <ApprovalNotice restaurant={restaurant} />
      <DataState loading={loading && !data} error={error} onRetry={reload}>
        {data ? (
          <>
            <div className="stat-grid">
              <StatCard icon={ShoppingBag} label="Today's orders" value={s.todayOrders} tone="brand" />
              <StatCard icon={IndianRupee} label="Total sales" value={rupee(s.totalSales)} hint="Delivered orders" tone="green" />
              <StatCard icon={Clock} label="Pending orders" value={s.pendingOrders} hint="Waiting for you" tone="amber" />
              <StatCard icon={CheckCircle2} label="Completed orders" value={s.completedOrders} tone="blue" />
              <StatCard icon={Star} label="Rating" value={s.rating ? s.rating.toFixed(1) : 'New'} hint={`${s.reviewCount} reviews`} tone="violet" />
            </div>

            <Panel title="Sales, last 14 days" subtitle="Delivered orders only (INR)">
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.salesChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e9e2da" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} width={56} />
                    <Tooltip formatter={(v, n) => (n === 'sales' ? [rupee(v), 'Sales'] : [v, 'Orders'])} labelFormatter={shortDate} />
                    <Bar dataKey="sales" fill="#ff6a1a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <div className="dash-grid-2">
              <Panel title="Recent activity" actions={<Link to="/owner/orders" className="btn btn--sm btn--ghost">All orders</Link>}>
                {data.recentActivity.length === 0 ? (
                  <EmptyState icon={ShoppingBag} title="No orders yet" message="New orders will appear here instantly." />
                ) : (
                  <ul className="own-list">
                    {data.recentActivity.map((o) => (
                      <li key={o.id}>
                        <div><strong>{o.orderNumber}</strong><span className="muted"> · {o.customer} · {timeAgo(o.createdAt)}</span></div>
                        <div className="row"><span>{rupee(o.total)}</span><OrderStatusBadge status={o.status} /></div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Latest reviews" actions={<Link to="/owner/reviews" className="btn btn--sm btn--ghost">All ratings</Link>}>
                {data.recentReviews.length === 0 ? (
                  <EmptyState icon={Star} title="No reviews yet" message="Customers can review after delivery." />
                ) : (
                  <ul className="own-list">
                    {data.recentReviews.map((v) => (
                      <li key={v.id}>
                        <div><strong>{v.user}</strong> <Rating value={v.rating} />{v.comment ? <p className="muted own-quote">{v.comment}</p> : null}</div>
                        <span className="muted">{timeAgo(v.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        ) : null}
      </DataState>
    </>
  );
}
