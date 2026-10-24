import { useMemo, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import useApi from '../../hooks/useApi';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import useDebounced from './parts-b/useDebounced';
import { formatDateTime, timeAgo } from '../../utils/format';
import '../../css/admin-extra.css';

const isEmpty = (m) => m === null || m === undefined || (typeof m === 'object' && Object.keys(m).length === 0);
const fmtMeta = (m) => (typeof m === 'object' ? Object.entries(m).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('\n') : String(m));

export default function AdminAudit() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  const params = useMemo(() => ({ page, limit: 20, ...(dq ? { q: dq } : {}) }), [page, dq]);
  const { data, loading, error, reload } = useApi('/admin/audit-logs', { params });
  const logs = (data && data.logs) || [];
  const pg = (data && data.pagination) || { page: 1, pages: 1, total: 0 };

  return (
    <>
      <div className="dash-head"><div><h1>Audit log</h1><p className="muted" style={{ margin: 0 }}>Read-only record of administrative actions.</p></div></div>
      <Panel>
        <div className="toolbar">
          <div className="toolbar__grow" style={{ position: 'relative' }}>
            <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-3)' }} />
            <label className="sr-only" htmlFor="au-q">Search by action, actor or entity</label>
            <input id="au-q" type="search" className="input" style={{ width: '100%', paddingLeft: 34 }} placeholder="Search action, actor email or entity (e.g. coupon, review.delete)" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <span className="muted" aria-live="polite">{pg.total} entr{pg.total === 1 ? 'y' : 'ies'}</span>
        </div>
        <DataState loading={loading && !data} error={error} onRetry={reload}>
          {logs.length === 0 ? (
            <EmptyState icon={ScrollText} title="No log entries" message={dq ? 'Nothing matches your search.' : 'Admin actions will appear here.'} action={dq ? <button type="button" className="btn btn--ghost" onClick={() => setQ('')}>Clear search</button> : null} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td title={formatDateTime(l.createdAt)}><div className="ax-cell-main"><span>{timeAgo(l.createdAt)}</span><small>{formatDateTime(l.createdAt)}</small></div></td>
                      <td>{l.actor || 'system'}</td>
                      <td><span className="ax-action">{l.action}</span></td>
                      <td><div className="ax-cell-main"><span>{l.entity || '-'}</span>{l.entityId ? <small className="ax-mono">{l.entityId}</small> : null}</div></td>
                      <td>{isEmpty(l.meta) ? <span className="muted">-</span> : <pre className="ax-meta">{fmtMeta(l.meta)}</pre>}</td>
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
