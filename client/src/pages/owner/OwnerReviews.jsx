import { useState } from 'react';
import { Star } from 'lucide-react';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import Rating from '../../components/Rating';
import useApi from '../../hooks/useApi';
import { formatDate } from '../../utils/format';
import { scope, useOwner } from './OwnerContext';
import RestaurantSwitcher from './RestaurantSwitcher';

export default function OwnerReviews() {
  const { restaurantId, restaurant } = useOwner();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi('/owner/reviews', { params: scope(restaurantId, { page, limit: 10 }), enabled: Boolean(restaurantId) });
  const total = data ? data.distribution.reduce((n, d) => n + d.count, 0) : 0;
  const max = data ? Math.max(1, ...data.distribution.map((d) => d.count)) : 1;

  return (
    <>
      <div className="dash-head"><h1>Customer ratings</h1><RestaurantSwitcher /></div>
      <DataState loading={loading && !data} error={error} onRetry={reload}>
        {data ? (
          <div className="dash-grid-2 own-reviews">
            <Panel title="Overall" subtitle={restaurant ? restaurant.name : ''}>
              <div className="own-score">
                <strong>{restaurant && restaurant.rating ? restaurant.rating.toFixed(1) : 'New'}</strong>
                <span className="muted">{total} review{total === 1 ? '' : 's'}</span>
              </div>
              <ul className="own-bars" aria-label="Rating distribution">
                {data.distribution.map((d) => (
                  <li key={d.star}>
                    <span>{d.star} <Star size={12} fill="#f5a524" color="#f5a524" aria-hidden="true" /></span>
                    <div className="own-bar" role="presentation"><i style={{ width: `${(d.count / max) * 100}%` }} /></div>
                    <span className="muted">{d.count}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Reviews">
              {data.reviews.length === 0 ? (
                <EmptyState icon={Star} title="No reviews yet" message="Reviews appear after customers receive their orders." />
              ) : (
                <>
                  <ul className="own-list">
                    {data.reviews.map((v) => (
                      <li key={v.id}>
                        <div><strong>{v.user}</strong> <Rating value={v.rating} />{v.comment ? <p className="own-quote">{v.comment}</p> : <p className="muted own-quote">No comment</p>}</div>
                        <span className="muted">{formatDate(v.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                  <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />
                </>
              )}
            </Panel>
          </div>
        ) : null}
      </DataState>
    </>
  );
}
