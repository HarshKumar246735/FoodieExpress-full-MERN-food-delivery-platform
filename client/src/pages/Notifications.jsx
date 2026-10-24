import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import api, { apiError } from '../services/api';
import useApi from '../hooks/useApi';
import { useSocketEvent } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { timeAgo } from '../utils/format';
import '../css/account.css';

export default function Notifications() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/orders/notifications');
  useSocketEvent('notification', () => reload());
  const markAll = async () => { try { await api.patch('/orders/notifications/read-all'); reload(); } catch (e) { toast.error(apiError(e)); } };
  const markOne = async (n) => { if (n.read) return; try { await api.patch(`/orders/notifications/${n.id}/read`); reload(); } catch (e) { /* non-critical */ } };

  return (
    <div className="container page acc-narrow">
      <div className="page-head">
        <h1>Notifications</h1>
        {data && data.unread > 0 ? <button type="button" className="btn btn--ghost btn--sm" onClick={markAll}><CheckCheck size={14} aria-hidden="true" /> Mark all as read ({data.unread})</button> : null}
      </div>
      {error ? <div className="alert alert--error" role="alert">{error} <button type="button" className="btn btn--sm btn--ghost" onClick={reload}>Try again</button></div>
        : loading && !data ? <div className="stack"><Skeleton h={70} /><Skeleton h={70} /></div>
        : data.notifications.length === 0 ? <EmptyState icon={Bell} title="You're all caught up" message="Order and payment updates will appear here." />
        : (
          <ul className="notif-list">
            {data.notifications.map((n) => (
              <li key={n.id} className={`notif ${n.read ? '' : 'is-unread'}`}>
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.message}</p>
                  <small className="muted">{timeAgo(n.createdAt)}</small>
                </div>
                <div className="row">
                  {n.order ? <Link to={`/orders/${n.order}`} className="btn btn--ghost btn--sm" onClick={() => markOne(n)}>View order</Link> : null}
                  {!n.read ? <button type="button" className="btn btn--soft btn--sm" onClick={() => markOne(n)}>Mark read</button> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
