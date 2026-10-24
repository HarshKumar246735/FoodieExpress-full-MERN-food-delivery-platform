import { Link } from 'react-router-dom';
import { Bike, Clock } from 'lucide-react';
import FoodImage from './FoodImage';
import Rating from './Rating';
import { rupee } from '../utils/format';
import '../css/restaurantcard.css';

export default function RestaurantCard({ restaurant: r }) {
  const closed = r.isOpenNow === false;
  return (
    <Link to={`/restaurant/${r.slug || r.id}`} className={`rc ${closed ? 'rc--closed' : ''}`} aria-label={`${r.name}, ${closed ? 'closed now' : 'open'}`}>
      <div className="rc__cover">
        <FoodImage src={r.coverImage || r.logo} alt={`${r.name} restaurant`} ratio="16 / 9" label={r.name} />
        {closed ? <span className="rc__closed">Closed now</span> : null}
        {r.logo ? (
          <div className="rc__logo"><FoodImage src={r.logo} alt={`${r.name} logo`} ratio="1 / 1" label={r.name.slice(0, 2)} /></div>
        ) : null}
      </div>
      <div className="rc__body">
        <h3 className="rc__name">{r.name}</h3>
        <p className="rc__cuisines muted">{(r.cuisines || []).slice(0, 3).join(', ')}</p>
        <div className="rc__meta">
          <Rating value={r.rating} count={r.reviewCount} />
          <span className="muted"><Clock size={14} aria-hidden="true" /> {r.prepTime} min</span>
          <span className="muted"><Bike size={14} aria-hidden="true" /> {r.deliveryFee > 0 ? rupee(r.deliveryFee) : 'Free'}</span>
        </div>
        <p className="rc__two muted">{rupee(r.priceForTwo)} for two</p>
      </div>
    </Link>
  );
}
