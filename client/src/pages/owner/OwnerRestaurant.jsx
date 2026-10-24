import { useEffect, useState } from 'react';
import Panel from '../../components/dash/Panel';
import AuthField from '../../components/AuthField';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { DAYS } from '../../utils/format';
import { PIN_RE } from '../../utils/checkoutValidation';
import { useOwner } from './OwnerContext';
import RestaurantSwitcher, { ApprovalNotice } from './RestaurantSwitcher';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toForm = (r) => ({
  name: r.name, description: r.description || '', logo: r.logo || '', coverImage: r.coverImage || '', cuisines: (r.cuisines || []).join(', '),
  prepTime: r.prepTime, deliveryFee: r.deliveryFee, minOrder: r.minOrder, priceForTwo: r.priceForTwo,
  address: { line: r.address.line || '', city: r.address.city || '', state: r.address.state || '', postalCode: r.address.postalCode || '' },
  hours: Array.from({ length: 7 }, (_, day) => {
    const h = (r.openingHours || []).find((x) => x.day === day);
    return h ? { day, open: h.open, close: h.close, closed: h.closed } : { day, open: '10:00', close: '23:00', closed: false };
  }),
});

export default function OwnerRestaurant() {
  const toast = useToast();
  const { restaurant, restaurantId, reload } = useOwner();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const approved = restaurant && restaurant.approvalStatus === 'approved';
  const params = restaurantId ? { restaurant: restaurantId } : undefined;

  useEffect(() => { if (restaurant) { setForm(toForm(restaurant)); setIsOpen(restaurant.isOpen); setErrors({}); } }, [restaurant]);
  if (!form) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setAddr = (k) => (e) => setForm((f) => ({ ...f, address: { ...f.address, [k]: e.target.value } }));
  const setHour = (i, k, v) => setForm((f) => ({ ...f, hours: f.hours.map((h, n) => (n === i ? { ...h, [k]: v } : h)) }));

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Name is required';
    [['prepTime', 5, 120], ['deliveryFee', 0, 10000], ['minOrder', 0, 100000], ['priceForTwo', 0, 100000]].forEach(([k, lo, hi]) => {
      const v = Number(form[k]);
      if (form[k] === '' || Number.isNaN(v) || v < lo || v > hi) e[k] = `Enter a number between ${lo} and ${hi}`;
    });
    if (form.address.postalCode && !PIN_RE.test(form.address.postalCode)) e.postalCode = 'Enter a valid 6-digit postal code';
    if (!form.cuisines.split(',').some((c) => c.trim())) e.cuisines = 'Add at least one cuisine';
    form.hours.forEach((h, i) => { if (!h.closed && (!TIME.test(h.open) || !TIME.test(h.close))) e[`hours${i}`] = 'Use HH:MM times'; });
    return e;
  };

  const save = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) { toast.error('Please fix the highlighted fields'); return; }
    setBusy(true);
    try {
      await api.put('/owner/restaurant', {
        name: form.name.trim(), description: form.description.trim(), logo: form.logo.trim(), coverImage: form.coverImage.trim(),
        cuisines: form.cuisines.split(',').map((c) => c.trim()).filter(Boolean), prepTime: Number(form.prepTime), deliveryFee: Number(form.deliveryFee),
        minOrder: Number(form.minOrder), priceForTwo: Number(form.priceForTwo), address: form.address, openingHours: form.hours,
      }, { params });
      toast.success('Restaurant profile saved');
      reload();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleOpen = async () => {
    const next = !isOpen;
    setIsOpen(next);
    try {
      await api.patch('/owner/restaurant/open', { isOpen: next }, { params });
      toast.success(next ? 'You are now accepting orders' : 'Orders paused: restaurant shown as closed');
      reload();
    } catch (err) {
      setIsOpen(!next);
      toast.error(apiError(err));
    }
  };

  return (
    <>
      <div className="dash-head"><h1>Restaurant profile</h1><RestaurantSwitcher /></div>
      <ApprovalNotice restaurant={restaurant} />
      <Panel title="Accepting orders" subtitle="Pause new orders at any time, independent of opening hours.">
        <label className="switch">
          <input type="checkbox" checked={isOpen} onChange={toggleOpen} disabled={!approved} />
          <span className="switch__track" />
          <span>{isOpen ? 'Open for orders' : 'Closed'}</span>
        </label>
      </Panel>

      <form onSubmit={save} noValidate className="stack">
        <Panel title="Details">
          <div className="form-grid">
            <AuthField className="full" label="Restaurant name" value={form.name} onChange={set('name')} error={errors.name} maxLength={80} />
            <AuthField className="full" as="textarea" label="Description" value={form.description} onChange={set('description')} maxLength={600} />
            <AuthField className="full" label="Cuisines (comma separated, max 6)" value={form.cuisines} onChange={set('cuisines')} error={errors.cuisines} />
            <AuthField label="Logo image URL" value={form.logo} onChange={set('logo')} />
            <AuthField label="Cover image URL" value={form.coverImage} onChange={set('coverImage')} />
            <AuthField label="Preparation time (min)" type="number" value={form.prepTime} onChange={set('prepTime')} error={errors.prepTime} />
            <AuthField label="Price for two (₹)" type="number" value={form.priceForTwo} onChange={set('priceForTwo')} error={errors.priceForTwo} />
            <AuthField label="Delivery fee (₹)" type="number" value={form.deliveryFee} onChange={set('deliveryFee')} error={errors.deliveryFee} />
            <AuthField label="Minimum order (₹)" type="number" value={form.minOrder} onChange={set('minOrder')} error={errors.minOrder} />
          </div>
        </Panel>
        <Panel title="Address">
          <div className="form-grid">
            <AuthField className="full" label="Street / locality" value={form.address.line} onChange={setAddr('line')} />
            <AuthField label="City" value={form.address.city} onChange={setAddr('city')} />
            <AuthField label="State" value={form.address.state} onChange={setAddr('state')} />
            <AuthField label="Postal code" inputMode="numeric" maxLength={6} value={form.address.postalCode} onChange={setAddr('postalCode')} error={errors.postalCode} />
          </div>
        </Panel>
        <Panel title="Opening hours" subtitle="24-hour times. Tick 'Closed' for days off.">
          <ul className="own-hours">
            {form.hours.map((h, i) => (
              <li key={h.day}>
                <span className="own-hours__day">{DAYS[h.day]}</span>
                <label className="check"><input type="checkbox" checked={h.closed} onChange={(e) => setHour(i, 'closed', e.target.checked)} /> Closed</label>
                <input type="time" className="input" aria-label={`${DAYS[h.day]} opens`} value={h.open} disabled={h.closed} onChange={(e) => setHour(i, 'open', e.target.value)} />
                <span aria-hidden="true">to</span>
                <input type="time" className="input" aria-label={`${DAYS[h.day]} closes`} value={h.close} disabled={h.closed} onChange={(e) => setHour(i, 'close', e.target.value)} />
                {errors[`hours${i}`] ? <span className="field__error" role="alert">{errors[`hours${i}`]}</span> : null}
              </li>
            ))}
          </ul>
        </Panel>
        <div className="row"><button type="submit" className="btn btn--primary btn--lg" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button></div>
      </form>
    </>
  );
}
