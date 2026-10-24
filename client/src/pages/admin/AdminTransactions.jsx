import { useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import useApi from '../../hooks/useApi';
import Panel from '../../components/dash/Panel';
import StatCard from '../../components/dash/StatCard';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { PaymentStatusBadge } from '../../components/Badges';
import { formatDateTime, rupee } from '../../utils/format';
import '../../css/admin-extra.css';

const STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'];
const GATEWAY = {
  razorpay: { label: 'Razorpay TEST', cls: 'ax-tag--rzp' },
  demo: { label: 'DEMO (simulated)', cls: 'ax-tag--demo' },
  cod: { label: 'Cash on delivery', cls: 'ax-tag--cod' },
};
const Gateway = ({ g }) => <span className={`ax-tag ${(GATEWAY[g] || {}).cls || ''}`}>{(GATEWAY[g] || {}).label || g}</span>;

export default function AdminTransactions() {
  const [status, setStatus] = useState('');
  const [gateway, setGateway] = useState('');
  const [page, setPage] = useState(1);
  const params = useMemo(() => ({ page, limit: 15, ...(status ? { status } : {}), ...(gateway ? { gateway } : {}) }), [page, status, gateway]);
  const { data, loading, error, reload } = useApi('/admin/transactions', { params });
  const tx = (data && data.transactions) || [];
  const pg = (data && data.pagination) || { page: 1, pages: 1, total: 0 };

  // The API returns no aggregates, so these totals cover the rows on this page only.
  const sum = (s) => tx.filter((t) => t.status === s).reduce((n, t) => n + t.amount, 0);
  const reset = () => { setStatus(''); setGateway(''); setPage(1); };

  return (
    <>
      <div className="dash-head"><div><h1>Transactions</h1><p className="muted" style={{ margin: 0 }}>All payment attempts. No real money moves in this app: DEMO and Razorpay TEST are test-only.</p></div></div>
      <div className="stat-grid">
        <StatCard icon={CreditCard} label="Matching transactions" value={pg.total} tone="blue" />
        <StatCard icon={CreditCard} label="Paid (this page)" value={rupee(sum('SUCCESS'))} tone="green" />
        <StatCard icon={CreditCard} label="Pending (this page)" value={rupee(sum('PENDING'))} tone="amber" />
        <StatCard icon={CreditCard} label="Failed / cancelled (this page)" value={rupee(sum('FAILED') + sum('CANCELLED'))} tone="red" />
      </div>
      <Panel>
        <div className="toolbar">
          <label className="sr-only" htmlFor="tx-status">Payment status</label>
          <select id="tx-status" className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
          <label className="sr-only" htmlFor="tx-gw">Gateway</label>
          <select id="tx-gw" className="select" value={gateway} onChange={(e) => { setGateway(e.target.value); setPage(1); }}>
            <option value="">All gateways</option>
            {Object.entries(GATEWAY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {(status || gateway) ? <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>Clear filters</button> : null}
        </div>
        <DataState loading={loading && !data} error={error} onRetry={reload}>
          {tx.length === 0 ? (
            <EmptyState icon={CreditCard} title="No transactions" message="No payments match these filters." action={(status || gateway) ? <button type="button" className="btn btn--primary" onClick={reset}>Clear filters</button> : null} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
                <tbody>
                  {tx.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDateTime(t.createdAt)}</td>
                      <td className="ax-mono">{t.order || '-'}</td>
                      <td>{t.user || '-'}</td>
                      <td><Gateway g={t.gateway} /></td>
                      <td><strong>{rupee(t.amount)}</strong></td>
                      <td><div className="ax-cell-main"><PaymentStatusBadge status={t.status} />{t.failureReason ? <small>{t.failureReason}</small> : null}</div></td>
                      <td className="ax-mono">{t.ref || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={pg.page} pages={pg.pages} onChange={setPage} />
        </DataState>
      </Panel>
    </>
  );
}
