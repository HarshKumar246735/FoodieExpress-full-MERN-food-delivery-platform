import { useState } from 'react';
import { History } from 'lucide-react';
import useApi from '../../hooks/useApi';
import { useSocketEvent } from '../../context/SocketContext';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { formatDateTime, rupee } from '../../utils/format';
import '../../css/delivery.css';

export default function DeliveryHistory() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi('/delivery/assignments', { params: { scope: 'history', page, limit: 10 } });
  useSocketEvent('assignment:update', reload);
  const list = (data && data.assignments) || [];
  return (
    <>
      <div className="dash-head"><h1>Delivery history</h1></div>
      <DataState loading={loading && !data} error={error} onRetry={reload}>
        {list.length === 0 ? (
          <EmptyState icon={History} title="No completed deliveries yet" message="Delivered orders and your earnings will be listed here." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Completed deliveries</caption>
                <thead><tr><th>Order</th><th>Restaurant</th><th>Area</th><th>Order value</th><th>Earned</th><th>Delivered</th></tr></thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.order ? a.order.orderNumber : '-'}</strong></td>
                      <td>{a.order ? a.order.pickup.name : '-'}</td>
                      <td>{a.order ? a.order.dropoff.city : '-'}</td>
                      <td>{a.order ? rupee(a.order.total) : '-'}</td>
                      <td>{rupee(a.earning)}</td>
                      <td>{formatDateTime(a.deliveredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />
          </>
        )}
      </DataState>
    </>
  );
}
