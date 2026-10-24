import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageSearch, Power } from 'lucide-react';
import useApi from '../../hooks/useApi';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { ConfirmDialog } from '../../components/Modal';
import { OrderStatusBadge } from '../../components/Badges';
import { JobSummary } from './DeliveryParts';
import '../../css/delivery.css';

export default function DeliveryAvailable() {
  const toast = useToast();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi('/delivery/assignments', { params: { scope: 'available', page, limit: 10 } });
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  useSocketEvent('assignment:new', reload);
  useSocketEvent('assignment:update', reload);

  const accept = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/delivery/assignments/${id}/accept`);
      toast.success('Delivery accepted. Head to the restaurant.');
      navigate('/delivery/active');
    } catch (e) {
      toast.error(apiError(e));
      reload();
    } finally {
      setBusyId(null);
    }
  };
  const reject = async () => {
    const id = rejecting;
    setBusyId(id);
    try {
      await api.post(`/delivery/assignments/${id}/reject`);
      toast.info('Job hidden from your list.');
      setRejecting(null);
      reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusyId(null);
    }
  };
  const goOnline = async () => {
    try {
      await api.patch('/delivery/status', { isOnline: true });
      toast.success('You are online.');
      reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const list = (data && data.assignments) || [];
  return (
    <>
      <div className="dash-head"><h1>Available jobs</h1><button type="button" className="btn btn--ghost btn--sm" onClick={reload}>Refresh</button></div>
      <DataState loading={loading && !data} error={error} onRetry={reload}>
        {data && data.offline ? (
          <EmptyState icon={Power} title="You are offline" message="Go online to see deliveries waiting for a partner." action={<button type="button" className="btn btn--primary" onClick={goOnline}>Go online</button>} />
        ) : list.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No jobs right now" message="New orders appear here as soon as restaurants start preparing them." action={<button type="button" className="btn btn--ghost" onClick={reload}>Check again</button>} />
        ) : (
          <div className="stack">
            {list.map((a) => (
              <Panel key={a.id} title={a.order ? `Order ${a.order.orderNumber}` : 'Order'} actions={a.order ? <OrderStatusBadge status={a.order.status} /> : null}>
                <JobSummary a={a} />
                <p className="field__hint">The customer's name, phone and full address are shared after you accept.</p>
                <div className="row row--wrap">
                  <button type="button" className="btn btn--primary" disabled={busyId === a.id} onClick={() => accept(a.id)}>{busyId === a.id ? 'Accepting...' : 'Accept delivery'}</button>
                  <button type="button" className="btn btn--ghost" disabled={busyId === a.id} onClick={() => setRejecting(a.id)}>Not interested</button>
                </div>
              </Panel>
            ))}
            <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />
          </div>
        )}
      </DataState>
      <ConfirmDialog open={Boolean(rejecting)} title="Hide this job?" message="It will be removed from your list. Other partners can still accept it." confirmLabel="Hide job" danger busy={busyId === rejecting} onCancel={() => setRejecting(null)} onConfirm={reject} />
    </>
  );
}
