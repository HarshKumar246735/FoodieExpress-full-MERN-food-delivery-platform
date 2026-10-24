import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bike, Clock, MapPin, Store, Wallet } from 'lucide-react';
import useApi from '../hooks/useApi';
import FoodImage from '../components/FoodImage';
import FoodCard from '../components/FoodCard';
import Rating from '../components/Rating';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { Skeleton } from '../components/Skeleton';
import { DAYS, formatDate, rupee, formatAddress } from '../utils/format';
import '../css/restaurantdetail.css';

function Reviews({ id }) {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useApi(`/restaurants/${id}/reviews`, { params: { page, limit: 6 } });
  if (error) return <p className="muted">Reviews could not be loaded.</p>;
  if (loading && !data) return <Skeleton h={80} />;
  if (!data || data.reviews.length === 0) return <p className="muted">No reviews yet. Order and be the first to review.</p>;
  return (
    <>
      <ul className="rd-reviews">
        {data.reviews.map((r) => (
          <li key={r.id}>
            <div className="row row--between"><strong>{r.user}</strong><span className="muted">{formatDate(r.createdAt)}</span></div>
            <Rating value={r.rating} />
            {r.comment ? <p>{r.comment}</p> : null}
          </li>
        ))}
      </ul>
      <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />
    </>
  );
}

export default function RestaurantDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/restaurants/${id}`);
  const [tab, setTab] = useState('all');

  if (loading && !data) return <div className="container page"><Skeleton h={220} /><div style={{ height: 16 }} /><Skeleton h={300} /></div>;
  if (error) {
    return (
      <div className="container page">
        <EmptyState icon={Store} title="Restaurant not available" message={error} action={<div className="row"><button type="button" className="btn btn--ghost" onClick={reload}>Try again</button><Link to="/restaurants" className="btn btn--primary">All restaurants</Link></div>} />
      </div>
    );
  }
  const r = data.restaurant;
  const closed = r.isOpenNow === false;
  const today = new Date().getDay();
  const groups = tab === 'all' ? data.menu : data.menu.filter((g) => g.category.id === tab);

  return (
    <div className="page">
      <section className="rd-hero">
        <FoodImage src={r.coverImage || r.logo} alt={`${r.name} restaurant`} ratio="21 / 6" label={r.name} eager className="rd-hero__img" />
        <div className="container rd-hero__card card">
          <div>
            <h1>{r.name}</h1>
            <p className="muted">{(r.cuisines || []).join(' · ')}</p>
            <p className="rd-hero__desc">{r.description}</p>
            <p className="muted"><MapPin size={14} aria-hidden="true" /> {formatAddress(r.address)}</p>
          </div>
          <ul className="rd-facts">
            <li><Rating value={r.rating} count={r.reviewCount} /></li>
            <li><Clock size={16} aria-hidden="true" /> {r.prepTime} min</li>
            <li><Bike size={16} aria-hidden="true" /> {r.deliveryFee > 0 ? `${rupee(r.deliveryFee)} delivery` : 'Free delivery'}</li>
            <li><Wallet size={16} aria-hidden="true" /> Min order {rupee(r.minOrder)}</li>
            <li><span className={`badge ${closed ? 'badge--red' : 'badge--green'}`}>{closed ? 'Closed now' : 'Open now'}</span></li>
          </ul>
        </div>
      </section>

      <div className="container rd-layout">
        <div>
          {closed ? <div className="alert alert--warn" role="status">This restaurant is closed right now. You can browse the menu, but orders cannot be placed until it opens.</div> : null}
          <div className="rd-tabs" role="tablist" aria-label="Menu categories">
            <button type="button" role="tab" aria-selected={tab === 'all'} className={`chip ${tab === 'all' ? 'is-active' : ''}`} onClick={() => setTab('all')}>All ({data.itemCount})</button>
            {data.menu.map((g) => (
              <button key={g.category.id} type="button" role="tab" aria-selected={tab === g.category.id} className={`chip ${tab === g.category.id ? 'is-active' : ''}`} onClick={() => setTab(g.category.id)}>{g.category.name} ({g.items.length})</button>
            ))}
          </div>
          {groups.length === 0 ? <EmptyState icon={Store} title="Menu coming soon" message="This restaurant has not added any dishes yet." /> : groups.map((g) => (
            <section key={g.category.id} aria-labelledby={`menu-${g.category.id}`} className="rd-group">
              <h2 id={`menu-${g.category.id}`}>{g.category.name}</h2>
              <div className="grid grid--foods">{g.items.map((f) => <FoodCard key={f.id} food={{ ...f, restaurant: { ...f.restaurant, isOpenNow: r.isOpenNow } }} showRestaurant={false} />)}</div>
            </section>
          ))}
          <section className="rd-group" aria-labelledby="reviews-h"><h2 id="reviews-h">Customer reviews</h2><Reviews id={r.id} /></section>
        </div>
        <aside className="rd-side card">
          <h2>Opening hours</h2>
          <table className="rd-hours"><tbody>
            {DAYS.map((d, i) => {
              const h = (r.openingHours || []).find((x) => x.day === i);
              return (<tr key={d} className={i === today ? 'is-today' : ''}><th scope="row">{d}</th><td>{!h || h.closed ? 'Closed' : `${h.open} – ${h.close}`}</td></tr>);
            })}
          </tbody></table>
          <p className="muted">Approx. {rupee(r.priceForTwo)} for two</p>
        </aside>
      </div>
    </div>
  );
}
