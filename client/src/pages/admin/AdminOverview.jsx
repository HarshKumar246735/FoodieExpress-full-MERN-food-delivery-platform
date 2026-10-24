import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Ban, CheckCircle2, ClipboardList, IndianRupee, MessageSquareWarning, Store, Truck, UtensilsCrossed, Users } from 'lucide-react';
import useApi from '../../hooks/useApi';
import StatCard from '../../components/dash/StatCard';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import { PaymentStatusBadge } from '../../components/Badges';
import { formatDateTime, ORDER_STATUS, rupee } from '../../utils/format';

const COLORS = { PENDING: '#c27a00', CONFIRMED: '#2563c9', PREPARING: '#5b8def', READY_FOR_PICKUP: '#6d3fc7', PICKED_UP: '#8d68d9', OUT_FOR_DELIVERY: '#a98ae3', DELIVERED: '#1f9d55', CANCELLED: '#d63b3b', REJECTED: '#e57373' };
const shortDate = (d) => { const [, m, day] = String(d).split('-'); return `${day}/${m}`; };

export default function AdminOverview() {
  const { data, loading, error, reload } = useApi('/admin/dashboard');
  const s = data && data.stats;
  const status = ((data && data.statusChart) || []).map((x) => ({ name: (ORDER_STATUS[x.status] || { label: x.status }).label, key: x.status, count: x.count }));
  const sales = (data && data.salesChart) || [];
  const hasSales = sales.some((d) => d.sales > 0 || d.orders > 0);

  return (
    <>
      <div className="dash-head"><div><h1>Overview</h1><p className="muted">Platform health at a glance.</p></div></div>
      <DataState loading={loading} error={error} onRetry={reload} rows={6}>
        {s ? (
          <>
            <div className="stat-grid">
              <StatCard icon={Users} label="Total users" value={s.totalUsers} hint={`${s.customers} customers`} tone="blue" />
              <StatCard icon={Store} label="Restaurants" value={s.totalRestaurants} hint={s.pendingRestaurants ? `${s.pendingRestaurants} awaiting approval` : 'All reviewed'} tone="violet" />
              <StatCard icon={UtensilsCrossed} label="Food products" value={s.totalFoods} tone="brand" />
              <StatCard icon={ClipboardList} label="Total orders" value={s.totalOrders} hint={`${s.pendingOrders} pending`} tone="amber" />
              <StatCard icon={CheckCircle2} label="Completed orders" value={s.completedOrders} tone="green" />
              <StatCard icon={Ban} label="Cancelled / rejected" value={s.cancelledOrders} tone="red" />
              <StatCard icon={IndianRupee} label="Revenue (delivered)" value={rupee(s.totalRevenue)} hint={`Today ${rupee(s.todayRevenue)}`} tone="green" />
              <StatCard icon={Truck} label="Partners online" value={s.partnersOnline} tone="blue" />
              <StatCard icon={MessageSquareWarning} label="Open complaints" value={s.openComplaints} tone={s.openComplaints ? 'red' : 'green'} />
            </div>

            <div className="dash-grid-2">
              <Panel title="Sales, last 30 days" subtitle="Delivered orders only">
                {hasSales ? (
                  <div className="chart-box">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sales} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9e2da" />
                        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} interval={4} />
                        <YAxis tick={{ fontSize: 11 }} width={48} />
                        <Tooltip formatter={(v, n) => (n === 'sales' ? [rupee(v), 'Sales'] : [v, 'Orders'])} labelFormatter={shortDate} />
                        <Legend />
                        <Line type="monotone" dataKey="sales" name="Sales" stroke="#ff6a1a" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="orders" name="Orders" stroke="#2563c9" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyState icon={IndianRupee} title="No delivered orders yet" message="Sales will chart here once orders are delivered." />}
              </Panel>

              <Panel title="Orders by status">
                {status.length ? (
                  <div className="chart-box">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={status} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9e2da" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                        <Tooltip />
                        <Bar dataKey="count" name="Orders" radius={[6, 6, 0, 0]}>
                          {status.map((x) => <Cell key={x.key} fill={COLORS[x.key] || '#999'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyState icon={ClipboardList} title="No orders yet" />}
              </Panel>
            </div>

            <Panel title="Recent transactions" actions={<Link to="/admin/transactions" className="btn btn--ghost btn--sm">View all</Link>}>
              {data.recentTransactions.length === 0 ? <EmptyState icon={IndianRupee} title="No transactions yet" /> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th><th>Reference</th><th>When</th></tr></thead>
                    <tbody>
                      {data.recentTransactions.map((t) => (
                        <tr key={t.id}>
                          <td><strong>{t.order || '-'}</strong></td>
                          <td>{t.user || '-'}</td>
                          <td className="adm-cap">{t.gateway === 'cod' ? 'Cash on delivery' : t.gateway}</td>
                          <td>{rupee(t.amount)}</td>
                          <td><PaymentStatusBadge status={t.status} /></td>
                          <td className="adm-mono">{t.ref || '-'}</td>
                          <td>{formatDateTime(t.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        ) : null}
      </DataState>
    </>
  );
}
