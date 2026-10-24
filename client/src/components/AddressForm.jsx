import { useState } from 'react';
import AuthField from './AuthField';
import { EMPTY_ADDRESS, validateAddress } from '../utils/checkoutValidation';

/** Controlled address form with inline validation. onSubmit receives the clean address. */
export default function AddressForm({ initial, submitLabel = 'Save address', onSubmit, onCancel, busy = false, showSaveOption = false }) {
  const [a, setA] = useState({ ...EMPTY_ADDRESS, ...(initial || {}) });
  const [errors, setErrors] = useState({});
  const [save, setSave] = useState(true);
  const set = (k) => (e) => { setA((s) => ({ ...s, [k]: e.target.value })); if (errors[k]) setErrors((x) => ({ ...x, [k]: '' })); };

  const submit = (e) => {
    e.preventDefault();
    const errs = validateAddress(a);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const clean = Object.fromEntries(['label', 'fullName', 'phone', 'house', 'street', 'city', 'state', 'postalCode'].map((k) => [k, String(a[k] || '').trim()]));
    onSubmit(clean, { save });
  };

  return (
    <form onSubmit={submit} noValidate className="addr-form">
      <div className="form-grid">
        <AuthField label="Full name" value={a.fullName} onChange={set('fullName')} error={errors.fullName} autoComplete="name" />
        <AuthField label="Phone number" value={a.phone} onChange={set('phone')} error={errors.phone} inputMode="numeric" maxLength={10} autoComplete="tel-national" hint="10-digit mobile number" />
        <AuthField label="House / building" value={a.house} onChange={set('house')} error={errors.house} className="full" autoComplete="address-line1" />
        <AuthField label="Street / locality" value={a.street} onChange={set('street')} error={errors.street} className="full" autoComplete="address-line2" />
        <AuthField label="City" value={a.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" />
        <AuthField label="State" value={a.state} onChange={set('state')} error={errors.state} autoComplete="address-level1" />
        <AuthField label="Postal code" value={a.postalCode} onChange={set('postalCode')} error={errors.postalCode} inputMode="numeric" maxLength={6} autoComplete="postal-code" />
        <AuthField label="Label" value={a.label} onChange={set('label')} hint="Home, Work, ..." maxLength={30} />
      </div>
      {showSaveOption ? <label className="check"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Save this address for next time</label> : null}
      <div className="row" style={{ marginTop: 14 }}>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Saving...' : submitLabel}</button>
        {onCancel ? <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button> : null}
      </div>
    </form>
  );
}
