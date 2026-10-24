import { Link, useParams } from 'react-router-dom';
import { Clock, Minus, Plus, Store, Utensils } from 'lucide-react';
import useApi from '../hooks/useApi';
import { useCart } from '../context/CartContext';
import FoodImage from '../components/FoodImage';
import FoodCard from '../components/FoodCard';
import Rating from '../components/Rating';
import { VegMark } from '../components/Badges';
import EmptyState from '../components/EmptyState';
import SectionHeader from '../components/SectionHeader';
import Carousel from '../components/Carousel';
import { Skeleton } from '../components/Skeleton';
import { rupee } from '../utils/format';
import '../css/fooddetail.css';

export default function FoodDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/food/${id}`);
  const { addItem, setQuantity, quantityOf, busy } = useCart();

  if (loading && !data) return <div className="container page"><Skeleton h={360} /></div>;
  if (error) {
    return (
      <div className="container page">
        <EmptyState icon={Utensils} title="Dish not available" message={error} action={<div className="row"><button type="button" className="btn btn--ghost" onClick={reload}>Try again</button><Link to="/food" className="btn btn--primary">Browse dishes</Link></div>} />
      </div>
    );
  }
  const f = data.food;
  const qty = quantityOf(f.id);
  const rest = f.restaurant;
  const closed = rest && rest.isOpenNow === false;
  const cat = f.category && typeof f.category === 'object' ? f.category : null;

  return (
    <div className="container page">
      <nav aria-label="Breadcrumb" className="muted crumbs">
        <Link to="/food">Dishes</Link>{cat ? <> / <Link to={`/category/${cat.slug}`}>{cat.name}</Link></> : null} / <span>{f.name}</span>
      </nav>
      <div className="fd">
        <div className="fd__media">
          <FoodImage src={f.image} alt={`${f.name}${rest ? ` from ${rest.name}` : ''}`} ratio="4 / 3" label={f.name} eager />
          {f.imageCredit ? <small className="muted fd__credit">Photo: {f.imageCredit}</small> : null}
        </div>
        <div className="fd__info">
          <div className="row"><VegMark isVeg={f.isVeg} /><span className="muted">{f.isVeg ? 'Vegetarian' : 'Non-vegetarian'}</span>{f.isBestseller ? <span className="badge badge--amber">Bestseller</span> : null}</div>
          <h1>{f.name}</h1>
          <div className="row row--wrap"><Rating value={f.rating} count={f.reviewCount} /><span className="muted"><Clock size={14} aria-hidden="true" /> {f.prepTime} min</span></div>
          <p>{f.description}</p>
          {f.ingredients && f.ingredients.length ? <p className="muted"><strong>Ingredients:</strong> {f.ingredients.join(', ')}</p> : null}
          {rest ? <p><Store size={16} aria-hidden="true" /> From <Link to={`/restaurant/${rest.slug || rest.id}`}><strong>{rest.name}</strong></Link>{closed ? <span className="badge badge--red"> Closed now</span> : null}</p> : null}
          <div className="fd__price"><strong>{rupee(f.unitPrice)}</strong>{f.discountPercent > 0 ? <><s className="muted">{rupee(f.price)}</s><span className="badge badge--green">{f.discountPercent}% off</span></> : null}</div>
          {!f.isAvailable ? <div className="alert alert--warn">This dish is currently unavailable.</div> : qty > 0 ? (
            <div className="row">
              <div className="fc-stepper fc-stepper--lg" role="group" aria-label={`Quantity of ${f.name}`}>
                <button type="button" onClick={() => setQuantity(f.id, qty - 1)} disabled={busy} aria-label="Remove one"><Minus size={18} /></button>
                <span aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQuantity(f.id, Math.min(20, qty + 1))} disabled={busy || qty >= 20} aria-label="Add one more"><Plus size={18} /></button>
              </div>
              <Link to="/cart" className="btn btn--primary">View cart</Link>
            </div>
          ) : (
            <button type="button" className="btn btn--primary btn--lg" onClick={() => addItem(f, 1)} disabled={busy}><Plus size={18} aria-hidden="true" /> Add to cart</button>
          )}
        </div>
      </div>
      {data.related && data.related.length > 0 ? (
        <section className="home-sec" aria-labelledby="rel-h">
          <SectionHeader id="rel-h" title="You may also like" to={cat ? `/category/${cat.slug}` : '/food'} />
          <Carousel label="Related dishes">{data.related.map((x) => <FoodCard key={x.id} food={x} />)}</Carousel>
        </section>
      ) : null}
    </div>
  );
}
