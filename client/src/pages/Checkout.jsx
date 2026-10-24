import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, Check, CreditCard, FlaskConical, MapPin, Plus, ShoppingBag } from 'lucide-react';
import api, { apiError, apiCode } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import CartItems from '../components/CartItems';
import CouponBox from '../components/CouponBox';
import PriceBreakdown from '../components/PriceBreakdown';
import AddressForm from '../components/AddressForm';
import EmptyState from '../components/EmptyState';
import { DemoPaymentPanel, payWithRazorpay } from '../components/payments';
import { Skeleton } from '../components/Skeleton';
import useApi from '../hooks/useApi';
import { formatAddress } from '../utils/format';
import { BLOCKING } from './Cart';
import '../css/checkout.css';

const STEPS = ['Review cart', 'Delivery address', 'Payment', 'Confirm'];

export default function Checkout() {
  const { user, refresh: refreshUser } = useAuth();
  const { cart, loaded, refresh: refreshCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: cfg } = useApi('/payments/config');

  const [step, setStep] = useState(0);
  const [addressId, setAddressId] = useState('');
  const [newAddress, setNewAddress] = useState(null); // { address, save }
  const [adding, setAdding] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [method, setMethod] = useState('COD');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null); // order waiting for the DEMO payment panel
  const placingRef = useRef(false);

  const addresses = (user && user.addresses) || [];
  useEffect(() => {
    if (!addressId && !newAddress && addresses.length) {
      const d = addresses.find((a) => a.isDefault) || addresses[0];
      setAddressId(d.id);
    }
  }, [addresses, addressId, newAddress]);

  if (!loaded) return <div className="container page"><Skeleton h={300} /></div>;
  if (cart.items.length === 0 && !pendingOrder) {
    return <div className="container page"><EmptyState icon={ShoppingBag} title="Nothing to check out" message="Your cart is empty." action={<Link to="/restaurants" className="btn btn--primary">Browse restaurants</Link>} /></div>;
  }
  const p = cart.pricing;
  const blocked = cart.issues.some((i) => BLOCKING.includes(i.reason)) || (p && !p.meetsMinOrder) || (p && p.coupon && !p.coupon.applied);
  const hasAddress = Boolean(addressId || newAddress);
  const razorpayOn = cfg && cfg.razorpay.enabled;
  const demoOn = !cfg || cfg.demo.enabled;
  const selectedAddress = newAddress ? newAddress.address : addresses.find((a) => a.id === addressId);

  const finish = (orderId, status) => navigate(`/payment/${status === 'success' ? 'success' : 'failure'}/${orderId}`, { replace: true });

  const place = async () => {
    if (placingRef.current) return; // block double submits
    placingRef.current = true;
    setPlacing(true);
    setError('');
    try {
      const body = { paymentMethod: method, instructions: instructions.trim() || undefined };
      if (newAddress) { body.address = newAddress.address; body.saveAddress = newAddress.save; } else body.addressId = addressId;
      const { data } = await api.post('/orders', body);
      await refreshCart();
      if (newAddress && newAddress.save) await refreshUser();
      const order = data.order;
      if (data.next === 'CONFIRMATION') { finish(order.id, 'success'); return; }
      if (data.next === 'DEMO_PAYMENT') { setPendingOrder(order); return; }
      const r = await payWithRazorpay(order, user);
      if (r.status === 'success') finish(order.id, 'success');
      else { toast.error(r.message || 'Payment was not completed.'); finish(order.id, 'failure'); }
    } catch (e) {
      setError(apiError(e));
      if (apiCode(e)) await refreshCart();
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  if (pendingOrder) {
    return (
      <div className="container page co-narrow">
        <DemoPaymentPanel order={pendingOrder} onResult={(r) => finish(pendingOrder.id, r.status)} />
        <p className="muted">Closing this page leaves the order unpaid. You can pay later from <Link to="/orders">My orders</Link>.</p>
      </div>
    );
  }

  const next = () => { setError(''); setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="container page">
      <h1>Checkout</h1>
      <ol className="co-steps" aria-label="Checkout progress">
        {STEPS.map((s, i) => (
          <li key={s} className={`${i === step ? 'is-current' : ''} ${i < step ? 'is-done' : ''}`} aria-current={i === step ? 'step' : undefined}>
            <span className="co-steps__n">{i < step ? <Check size={14} aria-hidden="true" /> : i + 1}</span>{s}
          </li>
        ))}
      </ol>

      <div className="cart-layout">
        <div className="stack">
          {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
          {cart.issues.length > 0 ? <div className="alert alert--warn" role="alert">{cart.issues.map((i) => i.message).join(' · ')} <Link to="/cart">Fix in cart</Link></div> : null}

          {step === 0 ? (
            <section className="card"><h2>Review your order</h2>{cart.restaurant ? <p className="muted">From {cart.restaurant.name}</p> : null}<CartItems /></section>
          ) : null}

          {step === 1 ? (
            <section className="card">
              <h2><MapPin size={20} aria-hidden="true" /> Delivery address</h2>
              {!adding ? (
                <>
                  {addresses.length > 0 ? (
                    <div className="addr-list" role="radiogroup" aria-label="Saved addresses">
                      {addresses.map((a) => (
                        <label key={a.id} className={`addr-card ${!newAddress && addressId === a.id ? 'is-selected' : ''}`}>
                          <input type="radio" name="addr" checked={!newAddress && addressId === a.id} onChange={() => { setAddressId(a.id); setNewAddress(null); }} />
                          <span><strong>{a.label} · {a.fullName}</strong><br />{formatAddress(a)}<br /><span className="muted">{a.phone}</span></span>
                        </label>
                      ))}
                    </div>
                  ) : <p className="muted">You have no saved addresses yet.</p>}
                  {newAddress ? (
                    <div className="addr-card is-selected"><span><strong>New address · {newAddress.address.fullName}</strong><br />{formatAddress(newAddress.address)}</span></div>
                  ) : null}
                  <button type="button" className="btn btn--ghost" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" /> Add a new address</button>
                </>
              ) : (
                <AddressForm showSaveOption submitLabel="Use this address" onCancel={() => setAdding(false)} onSubmit={(address, { save }) => { setNewAddress({ address, save }); setAddressId(''); setAdding(false); }} />
              )}
              <div className="field" style={{ marginTop: 18 }}>
                <label htmlFor="co-instr">Delivery instructions (optional)</label>
                <textarea id="co-instr" className="textarea" rows={2} maxLength={300} placeholder="e.g. Ring the bell twice, leave at the door" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="card">
              <h2>Payment method</h2>
              <div className="pay-list" role="radiogroup" aria-label="Payment method">
                <label className={`pay-card ${method === 'COD' ? 'is-selected' : ''}`}><input type="radio" name="pm" checked={method === 'COD'} onChange={() => setMethod('COD')} /><Banknote size={22} aria-hidden="true" /><span><strong>Cash on Delivery</strong><small className="muted">Pay in cash when your order arrives.</small></span></label>
                <label className={`pay-card ${method === 'RAZORPAY' ? 'is-selected' : ''} ${razorpayOn ? '' : 'is-off'}`}><input type="radio" name="pm" disabled={!razorpayOn} checked={method === 'RAZORPAY'} onChange={() => setMethod('RAZORPAY')} /><CreditCard size={22} aria-hidden="true" /><span><strong>Razorpay (test mode)</strong><small className="muted">{razorpayOn ? 'Use Razorpay test cards. No real money is charged.' : 'Not configured on this server. Add Razorpay test keys to enable it.'}</small></span></label>
                <label className={`pay-card ${method === 'DEMO' ? 'is-selected' : ''} ${demoOn ? '' : 'is-off'}`}><input type="radio" name="pm" disabled={!demoOn} checked={method === 'DEMO'} onChange={() => setMethod('DEMO')} /><FlaskConical size={22} aria-hidden="true" /><span><strong>Demo payment <span className="badge badge--amber">DEMO</span></strong><small className="muted">Simulate a successful, failed or cancelled payment. No gateway involved.</small></span></label>
              </div>
              <CouponBox />
            </section>
          ) : null}

          {step === 3 ? (
            <section className="card">
              <h2>Confirm your order</h2>
              <dl className="co-review">
                <dt>Restaurant</dt><dd>{cart.restaurant && cart.restaurant.name}</dd>
                <dt>Deliver to</dt><dd>{selectedAddress ? `${selectedAddress.fullName}, ${formatAddress(selectedAddress)}` : 'No address selected'}</dd>
                {instructions.trim() ? (<><dt>Instructions</dt><dd>{instructions.trim()}</dd></>) : null}
                <dt>Payment</dt><dd>{method === 'COD' ? 'Cash on Delivery' : method === 'RAZORPAY' ? 'Razorpay (test mode)' : 'Demo payment (simulated)'}</dd>
              </dl>
              <CartItems readOnly />
            </section>
          ) : null}

          <div className="row row--between">
            <button type="button" className="btn btn--ghost" onClick={step === 0 ? () => navigate('/cart') : back} disabled={placing}>{step === 0 ? 'Back to cart' : 'Back'}</button>
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn btn--primary" onClick={next} disabled={blocked || (step === 1 && !hasAddress)}>Continue</button>
            ) : (
              <button type="button" className="btn btn--primary btn--lg" onClick={place} disabled={placing || blocked || !hasAddress}>{placing ? 'Placing order...' : `Place order · ₹${p.total}`}</button>
            )}
          </div>
        </div>
        <aside className="cart-side"><PriceBreakdown pricing={p} couponCode={p.coupon && p.coupon.applied ? p.coupon.code : ''} /></aside>
      </div>
    </div>
  );
}
