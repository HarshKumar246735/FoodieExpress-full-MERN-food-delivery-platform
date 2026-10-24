import { useState } from 'react';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import api, { apiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthField from '../components/AuthField';
import AddressForm from '../components/AddressForm';
import { ConfirmDialog } from '../components/Modal';
import { validatePassword, validatePhone } from '../utils/checkoutValidation';
import { formatAddress } from '../utils/format';
import '../css/account.css';

function ProfileForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [vehicle, setVehicle] = useState(user.vehicle || '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    const pe = validatePhone(phone, true);
    if (pe) errs.phone = pe;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const body = { name: name.trim(), phone: phone.trim() || undefined };
      if (user.role === 'delivery') body.vehicle = vehicle.trim();
      const { data } = await api.put('/auth/profile', body);
      setUser(data.user);
      toast.success('Profile updated');
    } catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };
  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Your details</h2>
      <AuthField label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" />
      <AuthField label="Email" value={user.email} readOnly hint="Email cannot be changed here." />
      <AuthField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} inputMode="numeric" maxLength={10} autoComplete="tel-national" />
      {user.role === 'delivery' ? <AuthField label="Vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} maxLength={40} /> : null}
      <p className="muted">Account type: <strong>{user.role}</strong></p>
      <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.currentPassword) errs.currentPassword = 'Enter your current password';
    const pe = validatePassword(f.newPassword);
    if (pe) errs.newPassword = pe;
    if (f.confirm !== f.newPassword) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.put('/auth/password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      toast.success('Password changed');
      setF({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };
  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Change password</h2>
      <AuthField label="Current password" type="password" value={f.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} autoComplete="current-password" />
      <AuthField label="New password" type="password" value={f.newPassword} onChange={set('newPassword')} error={errors.newPassword} autoComplete="new-password" hint="8+ characters with a letter and a number" />
      <AuthField label="Confirm new password" type="password" value={f.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
      <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Updating...' : 'Update password'}</button>
    </form>
  );
}

function Addresses() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | address
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (address) => {
    setBusy(true);
    try {
      const { data } = editing === 'new' ? await api.post('/auth/addresses', address) : await api.put(`/auth/addresses/${editing.id}`, address);
      setUser(data.user);
      toast.success('Address saved');
      setEditing(null);
    } catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };
  const makeDefault = async (a) => {
    try { const { data } = await api.put(`/auth/addresses/${a.id}`, { ...a, isDefault: true }); setUser(data.user); toast.success('Default address updated'); } catch (err) { toast.error(apiError(err)); }
  };
  const remove = async () => {
    setBusy(true);
    try { const { data } = await api.delete(`/auth/addresses/${del.id}`); setUser(data.user); toast.success('Address deleted'); setDel(null); } catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };
  return (
    <section className="card">
      <div className="row row--between"><h2><MapPin size={20} aria-hidden="true" /> Saved addresses</h2>{!editing ? <button type="button" className="btn btn--soft btn--sm" onClick={() => setEditing('new')}><Plus size={14} aria-hidden="true" /> Add address</button> : null}</div>
      {editing ? <AddressForm initial={editing === 'new' ? { fullName: user.name, phone: user.phone } : editing} busy={busy} onCancel={() => setEditing(null)} onSubmit={save} />
        : user.addresses.length === 0 ? <p className="muted">No saved addresses yet.</p>
        : (
          <ul className="acc-addrs">
            {user.addresses.map((a) => (
              <li key={a.id} className="addr-card">
                <span><strong>{a.label} · {a.fullName}</strong>{a.isDefault ? <span className="badge badge--green"> Default</span> : null}<br />{formatAddress(a)}<br /><span className="muted">{a.phone}</span></span>
                <span className="row row--wrap">
                  {!a.isDefault ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => makeDefault(a)}><Star size={14} aria-hidden="true" /> Make default</button> : null}
                  <button type="button" className="icon-btn" onClick={() => setEditing(a)} aria-label={`Edit ${a.label} address`}><Pencil size={16} /></button>
                  <button type="button" className="icon-btn" onClick={() => setDel(a)} aria-label={`Delete ${a.label} address`}><Trash2 size={16} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      <ConfirmDialog open={Boolean(del)} danger busy={busy} title="Delete this address?" message={del ? formatAddress(del) : ''} confirmLabel="Delete" onCancel={() => setDel(null)} onConfirm={remove} />
    </section>
  );
}

export default function Profile() {
  const { user } = useAuth();
  return (
    <div className="container page">
      <div className="page-head"><h1>My profile</h1></div>
      <div className="acc-grid">
        <ProfileForm />
        <PasswordForm />
        {user.role === 'customer' ? <div className="acc-wide"><Addresses /></div> : null}
      </div>
    </div>
  );
}
