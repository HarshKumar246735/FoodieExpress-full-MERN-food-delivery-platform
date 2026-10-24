import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import AuthField from '../../../components/AuthField';
import api, { apiError } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { validateEmail, validatePassword, validatePhone } from '../../../utils/checkoutValidation';

const EMPTY = { name: '', email: '', phone: '', password: '', role: 'customer', vehicle: '' };

/** Admin-only account creation (the public site can never create admins). */
export default function CreateUserModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const close = () => { setF(EMPTY); setErrors({}); setServerError(''); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (f.name.trim().length < 2) err.name = 'Name must be at least 2 characters';
    const em = validateEmail(f.email); if (em) err.email = em;
    const ph = validatePhone(f.phone, true); if (ph) err.phone = ph;
    const pw = validatePassword(f.password); if (pw) err.password = pw;
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    setServerError('');
    try {
      const payload = { name: f.name.trim(), email: f.email.trim(), password: f.password, role: f.role };
      if (f.phone.trim()) payload.phone = f.phone.trim();
      if (f.role === 'delivery' && f.vehicle.trim()) payload.vehicle = f.vehicle.trim();
      await api.post('/admin/users', payload);
      toast.success(`${f.role} account created for ${f.email.trim()}`);
      setF(EMPTY);
      onCreated();
      onClose();
    } catch (ex) {
      setServerError(apiError(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Create user" onClose={close} footer={<>
      <button type="button" className="btn btn--ghost" onClick={close} disabled={busy}>Cancel</button>
      <button type="submit" form="adm-create-user" className="btn btn--primary" disabled={busy}>{busy ? 'Creating...' : 'Create user'}</button>
    </>}>
      <form id="adm-create-user" onSubmit={submit} noValidate>
        {serverError ? <div className="alert alert--error" role="alert">{serverError}</div> : null}
        <div className="form-grid">
          <AuthField label="Full name" value={f.name} onChange={set('name')} error={errors.name} autoComplete="off" />
          <AuthField label="Email" type="email" value={f.email} onChange={set('email')} error={errors.email} autoComplete="off" />
          <AuthField label="Phone (optional)" value={f.phone} onChange={set('phone')} error={errors.phone} inputMode="numeric" maxLength={10} />
          <AuthField label="Role" as="select" value={f.role} onChange={set('role')}>
            <option value="customer">Customer</option>
            <option value="owner">Restaurant owner</option>
            <option value="delivery">Delivery partner</option>
            <option value="admin">Administrator</option>
          </AuthField>
          {f.role === 'delivery' ? <AuthField label="Vehicle" value={f.vehicle} onChange={set('vehicle')} placeholder="Motorbike" className="full" /> : null}
          <AuthField label="Temporary password" type="password" value={f.password} onChange={set('password')} error={errors.password} hint="8+ characters with a letter and a number" autoComplete="new-password" className="full" />
        </div>
        {f.role === 'admin' ? <div className="alert alert--warn">Administrators have full access to every part of the platform.</div> : null}
      </form>
    </Modal>
  );
}
