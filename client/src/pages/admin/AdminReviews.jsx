import { useMemo, useState } from 'react';
import { Eye, EyeOff, MessageSquare, Search, Star, Trash2 } from 'lucide-react';
import useApi from '../../hooks/useApi';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { Badge } from '../../components/Badges';
import { ConfirmDialog } from '../../components/Modal';
import { timeAgo } from '../../utils/format';
import '../../css/admin-extra.css';

const STATUS_TABS = [['', 'All'], ['visible', 'Visible'], ['hidden', 'Hidden']];

export default function AdminReviews() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [rating, setRating] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const params = useMemo(() => ({ page, limit: 15, ...(status ? { status } : {}), ...(rating ? { rating } : {}) }), [page, status, rating]);
  const { data, loading, error, reload } = useApi('/admin/reviews', { params });

  const all = (data && data.reviews) || [];
  const pg = (data && data.pagination) || { page: 1, pages: 1, total: 0 };
  // The API has no text search, so the box filters the reviews on the current page.
  const needle = q.trim().toLowerCase();
  const reviews = needle ? all.filter((r) => `${r.comment} ${r.user} ${r.restaurant}`.toLowerCase().includes(needle)) : all;

  const moderate = async (r) => {
    const next = r.status === 'visible' ? 'hidden' : 'visible';
    try {
      await api.patch(`/admin/reviews/${r.id}`, { status: next });
      toast.success(next === 'hidden' ? 'Review hidden from customers' : 'Review is visible again');
      reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/reviews/${deleting.id}`);
      toast.success('Review deleted');
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dash-head"><div><h1>Review moderation</h1><p className="muted" style={{ margin: 0 }}>Hidden reviews no longer count towards restaurant ratings.</p></div></div>
      <Panel>
        <div className="toolbar">
          <div className="tabs" role="tablist" aria-label="Review status" style={{ margin: 0 }}>
            {STATUS_TABS.map(([v, l]) => (
              <button key={v || 'all'} type="button" role="tab" aria-selected={status === v} className={`chip ${status === v ? 'is-active' : ''}`} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>
            ))}
          </div>
          <label className="sr-only" htmlFor="rv-rating">Rating</label>
          <select id="rv-rating" className="select" value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }}>
            <option value="">Any rating</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
          </select>
          <div className="toolbar__grow" style={{ position: 'relative' }}>
            <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-3)' }} />
            <label className="sr-only" htmlFor="rv-q">Search this page</label>
            <input id="rv-q" type="search" className="input" style={{ width: '100%', paddingLeft: 34 }} placeholder="Search comment, customer or restaurant (this page)" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <DataState loading={loading && !data} error={error} onRetry={reload}>
          {reviews.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No reviews found" message="Try another status, rating or search term." action={<button type="button" className="btn btn--ghost" onClick={() => { setStatus(''); setRating(''); setQ(''); setPage(1); }}>Reset filters</button>} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Rating</th><th>Review</th><th>Customer</th><th>Restaurant</th><th>When</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id}>
                      <td><span className="ax-stars" aria-label={`${r.rating} out of 5`}><Star size={14} fill="#f5a524" color="#f5a524" aria-hidden="true" /> {r.rating}</span></td>
                      <td><span className="ax-clip">{r.comment || <em className="muted">No comment</em>}</span></td>
                      <td>{r.user}</td>
                      <td>{r.restaurant}</td>
                      <td title={new Date(r.createdAt).toLocaleString()}>{timeAgo(r.createdAt)}</td>
                      <td><Badge tone={r.status === 'visible' ? 'green' : 'amber'}>{r.status === 'visible' ? 'Visible' : 'Hidden'}</Badge></td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => moderate(r)}>
                            {r.status === 'visible' ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Unhide</>}
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDeleting(r)} aria-label="Delete review"><Trash2 size={14} /> Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.85rem' }}>{pg.total} review{pg.total === 1 ? '' : 's'} in total</p>
          <Pagination page={pg.page} pages={pg.pages} onChange={setPage} />
        </DataState>
      </Panel>
      <ConfirmDialog open={Boolean(deleting)} danger busy={busy} title="Delete review permanently?" confirmLabel="Delete review" message="This cannot be undone. To keep a record, hide the review instead." onCancel={() => setDeleting(null)} onConfirm={remove}>
        {deleting ? <blockquote className="ax-quote">{deleting.comment || 'No comment'}<br /><small className="muted">{deleting.rating}★ by {deleting.user} for {deleting.restaurant}</small></blockquote> : null}
      </ConfirmDialog>
    </>
  );
}
