import { useState } from 'react';
import { Tag, X } from 'lucide-react';
import { useCart } from '../context/CartContext';

/** Apply / remove a coupon. Messages come from the server's coupon rules. */
export default function CouponBox() {
  const { cart, applyCoupon, removeCoupon, busy } = useCart();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  const applied = cart.pricing && cart.pricing.coupon && cart.pricing.coupon.applied ? cart.pricing.coupon : null;

  const submit = async (e) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) { setMsg({ ok: false, text: 'Enter a coupon code.' }); return; }
    const r = await applyCoupon(c);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) setCode('');
  };

  return (
    <div className="coupon">
      <h3 className="coupon__title"><Tag size={18} aria-hidden="true" /> Coupon</h3>
      {applied ? (
        <div className="coupon__applied">
          <span><strong>{applied.code}</strong> <span className="muted">{applied.message}</span></span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { removeCoupon(); setMsg(null); }} disabled={busy}><X size={14} aria-hidden="true" /> Remove</button>
        </div>
      ) : (
        <form onSubmit={submit} className="coupon__form" noValidate>
          <label htmlFor="coupon-code" className="sr-only">Coupon code</label>
          <input id="coupon-code" className="input" placeholder="e.g. WELCOME50" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={24} autoComplete="off" />
          <button type="submit" className="btn btn--soft" disabled={busy}>Apply</button>
        </form>
      )}
      {cart.pricing && cart.pricing.coupon && !cart.pricing.coupon.applied ? <p className="field__error" role="alert">{cart.pricing.coupon.message}</p> : null}
      {msg && !applied ? <p className={msg.ok ? 'field__hint' : 'field__error'} role="status">{msg.text}</p> : null}
    </div>
  );
}
