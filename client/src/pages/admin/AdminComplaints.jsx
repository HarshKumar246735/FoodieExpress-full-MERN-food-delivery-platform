import { useEffect, useMemo, useState } from 'react';
import { Inbox, LifeBuoy } from 'lucide-react';
import useApi from '../../hooks/useApi';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import AuthField from '../../components/AuthField';
import { Badge } from '../../components/Badges';
import { Modal } from '../../components/Modal';
import { formatDateTime, timeAgo } from '../../utils/format';
import '../../css/admin-extra.css';

const STATUS = { open: { label: 'Open', tone: 'amber' }, in_review: { label: 'In review', tone: 'blue' }, resolved: { label: 'Resolved', tone: 'green' } };
const TABS = [['', 'All'], ['open', 'Open'], ['in_review', 'In review'], ['resolved', 'Resolved']];
const StatusBadge = ({ status }) => <Badge tone={(STATUS[status] || {}).tone}>{(STATUS[status] || {}).label || status}</Badge>;

function ComplaintModal({ complaint, onClose, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (complaint) { setStatus(complaint.status); setResponse(complaint.adminResponse || ''); }
  }, [complaint]);
  if (!complaint) return null;

  const save = async (e) => {
    e.preventDefault();
    if (response.length > 1000) return;
    setBusy(true);
    try {
      await api.patch(`/admin/complaints/${complaint.id}`, { status, adminResponse: response.trim() });
      toast.success(response.trim() ? 'Saved. The customer has been notified.' : 'Complaint updated');
      onSaved();
    } catch (ex) {
      toast.error(apiError(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title="Complaint details" onClose={onClose} size="lg">
      <form onSubmit={save}>
        <h4 style={{ marginBottom: 6 }}>{complaint.subject}</h4>
        <dl className="kv" style={{ marginBottom: 12 }}>
          <dt>Customer</dt><dd>{complaint.user ? `${complaint.user.name} (${complaint.user.email})` : 'Deleted user'}</dd>
          <dt>Order</dt><dd>{complaint.order || 'Not linked to an order'}</dd>
          <dt>Submitted</dt><dd>{formatDateTime(complaint.createdAt)}</dd>
          <dt>Status</dt><dd><StatusBadge status={complaint.status} /></dd>
        </dl>
        <blockquote className="ax-quote">{complaint.message}</blockquote>
        <div style={{ height: 14 }} />
        <AuthField label="Status" as="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </AuthField>
        <AuthField label="Response to customer" as="textarea" value={response} onChange={(e) => setResponse(e.target.value)} maxLength={1000} error={response.length > 1000 ? 'Maximum 1000 characters' : ''} hint={`${response.length}/1000. Customers receive this as an in-app notification.`} />
        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Close</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminComplaints() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const params = useMemo(() => ({ page, limit: 15, ...(status ? { status } : {}) }), [page, status]);
  const { data, loading, error, reload } = useApi('/admin/complaints', { params });
  const list = (data && data.complaints) || [];
  const pg = (data && data.pagination) || { page: 1, pages: 1, total: 0 };

  return (
    <>
      <div className="dash-head"><div><h1>Complaints</h1><p className="muted" style={{ margin: 0 }}>Customer issues raised from the Support page.</p></div></div>
      <Panel>
        <div className="tabs" role="tablist" aria-label="Complaint status">
          {TABS.map(([v, l]) => (
            <button key={v || 'all'} type="button" role="tab" aria-selected={status === v} className={`chip ${status === v ? 'is-active' : ''}`} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>
          ))}
        </div>
        <DataState loading={loading && !data} error={error} onRetry={reload}>
          {list.length === 0 ? (
            <EmptyState icon={status ? Inbox : LifeBuoy} title="No complaints here" message={status ? 'Nothing matches this status.' : 'Nobody has raised a complaint yet.'} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Subject</th><th>Customer</th><th>Order</th><th>Submitted</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td><div className="ax-cell-main"><strong>{c.subject}</strong><small className="ax-clip">{c.message}</small></div></td>
                      <td>{c.user ? <div className="ax-cell-main"><span>{c.user.name}</span><small>{c.user.email}</small></div> : 'Deleted user'}</td>
                      <td className="ax-mono">{c.order || '-'}</td>
                      <td title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td><button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelected(c)}>{c.status === 'resolved' ? 'View' : 'Review & respond'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={pg.page} pages={pg.pages} onChange={setPage} />
        </DataState>
      </Panel>
      <ComplaintModal complaint={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); reload(); }} />
    </>
  );
}
