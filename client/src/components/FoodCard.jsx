import { Link } from 'react-router-dom';
import { Clock, Flame, Minus, Plus } from 'lucide-react';
import FoodImage from './FoodImage';
import Rating from './Rating';
import { VegMark } from './Badges';
import { useCart } from '../context/CartContext';
import { rupee } from '../utils/format';
import '../css/foodcard.css';

/** Food tile with add-to-cart / quantity stepper. Prices are the server's (unitPrice already includes discounts). */
export default function FoodCard({ food, showRestaurant = true }) {
  const { addItem, setQuantity, quantityOf, busy } = useCart();
  const qty = quantityOf(food.id);
  const unavailable = !food.isAvailable;
  const rest = food.restaurant && typeof food.restaurant === 'object' ? food.restaurant : null;
  const href = `/food/${food.id}`;

  return (
    <article className={`fc ${unavailable ? 'fc--off' : ''}`}>
      <Link to={href} className="fc__media" aria-label={`View ${food.name}`} tabIndex={-1}>
        <FoodImage src={food.image} alt={`${food.name}${rest ? ` from ${rest.name}` : ''}`} ratio="4 / 3" label={food.name} />
        <div className="fc__tags">
          {food.discountPercent > 0 ? <span className="fc__tag fc__tag--deal">{food.discountPercent}% off</span> : null}
          {food.isBestseller ? <span className="fc__tag fc__tag--best"><Flame size={12} aria-hidden="true" /> Bestseller</span> : null}
        </div>
        {unavailable ? <span className="fc__sold">Unavailable</span> : null}
      </Link>
      <div className="fc__body">
        <div className="fc__title-row">
          <VegMark isVeg={food.isVeg} />
          <h3 className="fc__title"><Link to={href}>{food.name}</Link></h3>
        </div>
        {showRestaurant && rest ? (
          <Link to={`/restaurant/${rest.slug || rest.id}`} className="fc__rest muted">{rest.name}{rest.isOpenNow === false ? ' (closed now)' : ''}</Link>
        ) : null}
        <div className="fc__meta">
          <Rating value={food.rating} count={food.reviewCount} />
          <span className="fc__time muted"><Clock size={14} aria-hidden="true" /> {food.prepTime} min</span>
        </div>
        <div className="fc__foot">
          <div className="fc__price">
            <strong>{rupee(food.unitPrice)}</strong>
            {food.discountPercent > 0 ? <s className="muted">{rupee(food.price)}</s> : null}
          </div>
          {unavailable ? (
            <button type="button" className="btn btn--ghost btn--sm" disabled>Unavailable</button>
          ) : qty > 0 ? (
            <div className="fc-stepper" role="group" aria-label={`Quantity of ${food.name}`}>
              <button type="button" onClick={() => setQuantity(food.id, qty - 1)} aria-label={`Remove one ${food.name}`} disabled={busy}><Minus size={16} /></button>
              <span aria-live="polite">{qty}</span>
              <button type="button" onClick={() => setQuantity(food.id, Math.min(20, qty + 1))} aria-label={`Add one more ${food.name}`} disabled={busy || qty >= 20}><Plus size={16} /></button>
            </div>
          ) : (
            <button type="button" className="btn btn--soft btn--sm" onClick={() => addItem(food, 1)} disabled={busy} aria-label={`Add ${food.name} to cart`}>
              <Plus size={16} aria-hidden="true" /> Add
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
