import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import CartItems from '../components/CartItems';
import CouponBox from '../components/CouponBox';
import PriceBreakdown from '../components/PriceBreakdown';
import EmptyState from '../components/EmptyState';
import { ConfirmDialog } from '../components/Modal';
import { Skeleton } from '../components/Skeleton';
import { rupee } from '../utils/format';
import '../css/cart.css';

export const BLOCKING = ['REMOVED', 'UNAVAILABLE', 'RESTAURANT_UNAVAILABLE', 'RESTAURANT_CLOSED', 'MIXED_RESTAURANTS'];

export default function Cart() {
  const { cart, loaded, clear, busy } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false);

  if (!loaded) return <div className="container page"><Skeleton h={300} /></div>;
  if (user && user.role !== 'customer') {
    return <div className="container page"><EmptyState icon={ShoppingBag} title="Carts are for customers" message="Sign in with a customer account to order food." action={<Link to="/" className="btn btn--primary">Back home</Link>} /></div>;
  }
  if (cart.items.length === 0) {
    return (
      <div className="container page">
        <EmptyState icon={ShoppingBag} title="Your cart is empty" message="Add something delicious from a restaurant to get started." action={<div className="row"><Link to="/restaurants" className="btn btn--primary">Browse restaurants</Link><Link to="/food" className="btn btn--ghost">See all dishes</Link></div>} />
      </div>
    );
  }
  const p = cart.pricing;
  const blocked = cart.issues.some((i) => BLOCKING.includes(i.reason));
  const belowMin = p && !p.meetsMinOrder;
  const proceed = () => {
    if (!user) navigate('/login', { state: { from: '/checkout' } });
    else navigate('/checkout');
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div><h1>Your cart</h1>{cart.restaurant ? <p className="muted">From <Link to={`/restaurant/${cart.restaurant.slug || cart.restaurant.id}`}><strong>{cart.restaurant.name}</strong></Link></p> : null}</div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmClear(true)} disabled={busy}><Trash2 size={16} aria-hidden="true" /> Clear cart</button>
      </div>

      {cart.issues.length > 0 ? (
        <div className="alert alert--warn" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> <strong>Please review your cart</strong>
          <ul className="cart-issues">{cart.issues.map((i, k) => <li key={`${i.reason}-${i.foodId || k}`}>{i.message}</li>)}</ul>
        </div>
      ) : null}

      <div className="cart-layout">
        <section className="card" aria-label="Items in your cart"><CartItems /></section>
        <aside className="cart-side">
          <CouponBox />
          <PriceBreakdown pricing={p} couponCode={p.coupon && p.coupon.applied ? p.coupon.code : ''} />
          {belowMin ? <div className="alert alert--warn" role="status">Minimum order is {rupee(p.minOrder)}. Add {rupee(p.minOrderShortfall)} more to continue.</div> : null}
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={proceed} disabled={blocked || belowMin || busy}>{user ? 'Proceed to checkout' : 'Log in to checkout'}</button>
          <Link to={cart.restaurant ? `/restaurant/${cart.restaurant.slug || cart.restaurant.id}` : '/restaurants'} className="btn btn--ghost btn--block">Add more items</Link>
        </aside>
      </div>

      <ConfirmDialog open={confirmClear} danger title="Clear your cart?" message="All items will be removed from your cart." confirmLabel="Clear cart" onCancel={() => setConfirmClear(false)} onConfirm={async () => { setConfirmClear(false); await clear(); }} />
    </div>
  );
}
