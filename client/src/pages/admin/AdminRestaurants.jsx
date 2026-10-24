import { useState } from 'react';
import { Check, Plus, Store, X } from 'lucide-react';
import useListQuery from './parts-a/useListQuery';
import SearchBox from './parts-a/SearchBox';
import { ApproveConfirm, CreateRestaurantModal, RejectModal } from './parts-a/RestaurantModals';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { Badge } from '../../components/Badges';
import { formatDate } from '../../utils/format';

const TABS = [['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']];
const TONE = { pending: 'amber', approved: 'green', rejected: 'red' };

export default function AdminRestaurants() {
  const L = useListQuery('/admin/restaurants', { status: '' });
  const [approve, setApprove] = useState(null);
  const [reject, setReject] = useState(null);
  const [creating, setCreating] = useState(false);
  const list = (L.data && L.data.restaurants) || [];
  const pg = (L.data && L.data.pagination) || { page: 1, pages: 1, total: 0 };

  return (
    <>
      <div className="dash-head">
        <div><h1>Restaurants</h1><p className="muted">Approve new partners and manage listings.</p></div>
        <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}><Plus size={18} aria-hidden="true" /> Create restaurant</button>
      </div>
      <Panel>
        <div className="tabs" role="tablist" aria-label="Approval status">
          {TABS.map(([v, l]) => (
            <button key={v || 'all'} type="button" role="tab" aria-selected={L.filters.status === v} className={`chip ${L.filters.status === v ? 'is-active' : ''}`} onClick={() => L.setFilter('status', v)}>{l}</button>
          ))}
        </div>
        <div className="toolbar">
          <SearchBox label="Search restaurants" value={L.draft} onChange={L.setSearch} placeholder="Search by name or cuisine" />
          {L.hasFilters ? <button type="button" className="btn btn--ghost btn--sm" onClick={L.clear}>Clear</button> : null}
        </div>
        <DataState loading={L.loading && !L.data} error={L.error} onRetry={L.reload}>
          {list.length === 0 ? (
            <EmptyState icon={Store} title="No restaurants found" message="Nothing matches this view." />
          ) : (
            <>
              <div className={`table-wrap ${L.loading ? 'lst__dim' : ''}`}>
                <table className="table">
                  <thead><tr><th>Restaurant</th><th>Owner</th><th>Menu</th><th>Rating</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.name}</strong><br /><span className="muted">{(r.cuisines || []).slice(0, 3).join(', ') || 'No cuisines'}</span></td>
                        <td>{r.owner ? <>{r.owner.name}<br /><span className="muted">{r.owner.email}</span></> : <span className="muted">-</span>}</td>
                        <td>{r.menuItems} items</td>
                        <td>{r.reviewCount ? `${Number(r.rating).toFixed(1)} (${r.reviewCount})` : <span className="muted">New</span>}</td>
                        <td>
                          <Badge tone={TONE[r.approvalStatus]}>{r.approvalStatus}</Badge>
                          {r.approvalStatus === 'rejected' && r.rejectionReason ? <div className="muted adm-reason">{r.rejectionReason}</div> : null}
                        </td>
                        <td>{formatDate(r.createdAt)}</td>
                        <td>
                          <div className="row-actions">
                            {r.approvalStatus !== 'approved' ? <button type="button" className="btn btn--soft btn--sm" onClick={() => setApprove(r)}><Check size={15} aria-hidden="true" /> Approve</button> : null}
                            {r.approvalStatus !== 'rejected' ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReject(r)}><X size={15} aria-hidden="true" /> Reject</button> : null}
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
      <ApproveConfirm restaurant={approve} onClose={() => setApprove(null)} onDone={L.reload} />
      <RejectModal restaurant={reject} onClose={() => setReject(null)} onDone={L.reload} />
      <CreateRestaurantModal open={creating} onClose={() => setCreating(false)} onCreated={L.reload} />
    </>
  );
}
