import { useState } from 'react';
import { Truck, UserCheck, UserX } from 'lucide-react';
import useListQuery from './parts-a/useListQuery';
import SearchBox from './parts-a/SearchBox';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { Badge } from '../../components/Badges';
import { ConfirmDialog } from '../../components/Modal';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { rupee } from '../../utils/format';

export default function AdminDelivery() {
  const toast = useToast();
  const L = useListQuery('/admin/delivery-partners', { online: '' });
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = (L.data && L.data.partners) || [];
  const pg = (L.data && L.data.pagination) || { page: 1, pages: 1, total: 0 };

  const toggle = async () => {
    const next = target.status === 'active' ? 'suspended' : 'active';
    setBusy(true);
    try {
      await api.patch(`/admin/users/${target.id}`, { status: next });
      toast.success(`${target.name} ${next === 'suspended' ? 'suspended' : 'reactivated'}`);
      setTarget(null);
      L.reload();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="dash-head"><div><h1>Delivery partners</h1><p className="muted">{pg.total} partners</p></div></div>
      <Panel>
        <div className="toolbar">
          <SearchBox label="Search partners" value={L.draft} onChange={L.setSearch} placeholder="Search by name or email" />
          <label className="check"><input type="checkbox" checked={L.filters.online === 'true'} onChange={(e) => L.setFilter('online', e.target.checked ? 'true' : '')} /> Online only</label>
          {L.hasFilters ? <button type="button" className="btn btn--ghost btn--sm" onClick={L.clear}>Clear</button> : null}
        </div>
        <DataState loading={L.loading && !L.data} error={L.error} onRetry={L.reload}>
          {list.length === 0 ? (
            <EmptyState icon={Truck} title="No delivery partners found" message="Create delivery accounts from the Users page." />
          ) : (
            <>
              <div className={`table-wrap ${L.loading ? 'lst__dim' : ''}`}>
                <table className="table">
                  <thead><tr><th>Partner</th><th>Vehicle</th><th>Availability</th><th>Deliveries</th><th>Earnings</th><th>Account</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.name}</strong><br /><span className="muted">{p.email}</span></td>
                        <td>{p.vehicle || <span className="muted">-</span>}</td>
                        <td><Badge tone={p.isOnline ? 'green' : ''}>{p.isOnline ? 'Online' : 'Offline'}</Badge></td>
                        <td>{p.deliveries}</td>
                        <td>{rupee(p.earnings)}</td>
                        <td><Badge tone={p.status === 'active' ? 'green' : 'red'}>{p.status === 'active' ? 'Active' : 'Suspended'}</Badge></td>
                        <td>
                          {p.status === 'active'
                            ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTarget(p)}><UserX size={15} aria-hidden="true" /> Suspend</button>
                            : <button type="button" className="btn btn--soft btn--sm" onClick={() => setTarget(p)}><UserCheck size={15} aria-hidden="true" /> Reactivate</button>}
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
      <ConfirmDialog
        open={Boolean(target)}
        danger={target && target.status === 'active'}
        busy={busy}
        title={target && target.status === 'active' ? 'Suspend this partner?' : 'Reactivate this partner?'}
        message={target ? (target.status === 'active' ? `${target.name} will be taken offline and cannot accept deliveries.` : `${target.name} will be able to go online again.`) : ''}
        confirmLabel={target && target.status === 'active' ? 'Suspend' : 'Reactivate'}
        onCancel={() => setTarget(null)}
        onConfirm={toggle}
      />
    </>
  );
}
