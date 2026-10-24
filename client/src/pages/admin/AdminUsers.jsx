import { useState } from 'react';
import { UserCheck, UserPlus, UserX, Users } from 'lucide-react';
import useListQuery from './parts-a/useListQuery';
import SearchBox from './parts-a/SearchBox';
import CreateUserModal from './parts-a/CreateUserModal';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { Badge } from '../../components/Badges';
import { ConfirmDialog } from '../../components/Modal';
import api, { apiError } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDate, timeAgo } from '../../utils/format';

const ROLE_LABEL = { customer: 'Customer', owner: 'Owner', delivery: 'Delivery', admin: 'Admin' };
const ROLE_TONE = { customer: '', owner: 'violet', delivery: 'blue', admin: 'amber' };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const L = useListQuery('/admin/users', { role: '', status: '' });
  const [target, setTarget] = useState(null); // user awaiting suspend/reactivate confirmation
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const users = (L.data && L.data.users) || [];
  const pg = (L.data && L.data.pagination) || { page: 1, pages: 1, total: 0 };

  const toggle = async () => {
    const next = target.status === 'active' ? 'suspended' : 'active';
    setBusy(true);
    try {
      await api.patch(`/admin/users/${target.id}`, { status: next });
      toast.success(`${target.name} ${next === 'suspended' ? 'suspended' : 'reactivated'}`);
      setTarget(null);
      L.reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dash-head">
        <div><h1>Users</h1><p className="muted">{pg.total} accounts</p></div>
        <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}><UserPlus size={18} aria-hidden="true" /> Create user</button>
      </div>
      <Panel>
        <div className="toolbar">
          <SearchBox label="Search users" value={L.draft} onChange={L.setSearch} placeholder="Search by name or email" />
          <label className="sr-only" htmlFor="u-role">Role</label>
          <select id="u-role" className="select" value={L.filters.role} onChange={(e) => L.setFilter('role', e.target.value)}>
            <option value="">All roles</option>
            {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="sr-only" htmlFor="u-status">Status</label>
          <select id="u-status" className="select" value={L.filters.status} onChange={(e) => L.setFilter('status', e.target.value)}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          {L.hasFilters ? <button type="button" className="btn btn--ghost btn--sm" onClick={L.clear}>Clear</button> : null}
        </div>
        <DataState loading={L.loading && !L.data} error={L.error} onRetry={L.reload}>
          {users.length === 0 ? (
            <EmptyState icon={Users} title="No users found" message="Try a different search or filter." />
          ) : (
            <>
              <div className={`table-wrap ${L.loading ? 'lst__dim' : ''}`}>
                <table className="table">
                  <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Last login</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {users.map((u) => {
                      const isMe = me && me.id === u.id;
                      return (
                        <tr key={u.id}>
                          <td><strong>{u.name}</strong>{isMe ? <span className="muted"> (you)</span> : null}{u.isDemo ? <> <Badge>demo</Badge></> : null}<br /><span className="muted">{u.email}</span></td>
                          <td><Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge></td>
                          <td><Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status === 'active' ? 'Active' : 'Suspended'}</Badge></td>
                          <td>{formatDate(u.createdAt)}</td>
                          <td>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : <span className="muted">Never</span>}</td>
                          <td>
                            <div className="row-actions">
                              {u.status === 'active' ? (
                                <button type="button" className="btn btn--ghost btn--sm" disabled={isMe} title={isMe ? 'You cannot suspend yourself' : undefined} onClick={() => setTarget(u)}><UserX size={15} aria-hidden="true" /> Suspend</button>
                              ) : (
                                <button type="button" className="btn btn--soft btn--sm" onClick={() => setTarget(u)}><UserCheck size={15} aria-hidden="true" /> Reactivate</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
        title={target && target.status === 'active' ? 'Suspend this account?' : 'Reactivate this account?'}
        message={target ? (target.status === 'active' ? `${target.name} will be signed out of new requests and unable to use FoodieExpress until reactivated.` : `${target.name} will be able to sign in again.`) : ''}
        confirmLabel={target && target.status === 'active' ? 'Suspend' : 'Reactivate'}
        onCancel={() => setTarget(null)}
        onConfirm={toggle}
      />
      <CreateUserModal open={creating} onClose={() => setCreating(false)} onCreated={L.reload} />
    </>
  );
}
