import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import FoodImage from './FoodImage';
import { VegMark } from './Badges';
import { useCart } from '../context/CartContext';
import { rupee } from '../utils/format';

/** Editable list of cart lines (stepper, remove). `readOnly` shows a compact summary. */
export default function CartItems({ readOnly = false }) {
  const { cart, setQuantity, removeItem, busy } = useCart();
  return (
    <ul className="cart-items">
      {cart.items.map((i) => (
        <li key={i.food.id} className={`cart-line ${i.unavailable ? 'cart-line--off' : ''}`}>
          <Link to={`/food/${i.food.id}`} className="cart-line__img" tabIndex={-1} aria-hidden="true"><FoodImage src={i.food.image} alt="" ratio="1 / 1" label={i.food.name} /></Link>
          <div className="cart-line__main">
            <div className="row"><VegMark isVeg={i.food.isVeg} /><Link to={`/food/${i.food.id}`} className="cart-line__name">{i.food.name}</Link></div>
            <span className="muted">{rupee(i.food.unitPrice)} each{i.unavailable ? ' · Unavailable' : ''}</span>
          </div>
          {readOnly ? <span className="muted">x{i.quantity}</span> : (
            <div className="fc-stepper" role="group" aria-label={`Quantity of ${i.food.name}`}>
              <button type="button" onClick={() => setQuantity(i.food.id, i.quantity - 1)} disabled={busy} aria-label={`Remove one ${i.food.name}`}><Minus size={16} /></button>
              <span aria-live="polite">{i.quantity}</span>
              <button type="button" onClick={() => setQuantity(i.food.id, Math.min(20, i.quantity + 1))} disabled={busy || i.quantity >= 20} aria-label={`Add one more ${i.food.name}`}><Plus size={16} /></button>
            </div>
          )}
          <strong className="cart-line__total">{rupee(i.lineTotal)}</strong>
          {readOnly ? null : <button type="button" className="icon-btn" onClick={() => removeItem(i.food.id)} disabled={busy} aria-label={`Remove ${i.food.name} from cart`}><Trash2 size={18} /></button>}
        </li>
      ))}
    </ul>
  );
}
