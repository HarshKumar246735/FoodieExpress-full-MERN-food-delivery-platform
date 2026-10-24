import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, homeForRole } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiError } from '../services/api';
import AuthShell from '../components/AuthShell';
import AuthField from '../components/AuthField';
import { validateEmail, validatePassword, validatePhone } from '../utils/checkoutValidation';

export default function Register() {
  const { user, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user && !busy) return <Navigate to={homeForRole(user.role)} replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {
      name: form.name.trim().length < 2 ? 'Name must be at least 2 characters' : '',
      email: validateEmail(form.email),
      phone: validatePhone(form.phone, true),
      password: validatePassword(form.password),
      confirm: form.confirm !== form.password ? 'Passwords do not match' : '',
    };
    setErrors(errs);
    setServerError('');
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      const payload = { name: form.name.trim(), email: form.email.trim(), password: form.password };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      const data = await register(payload);
      toast.success(`Welcome to FoodieExpress, ${data.user.name.split(' ')[0]}!`);
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(apiError(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Order in a few taps and track every delivery." footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
      <form onSubmit={submit} noValidate>
        {serverError ? <div className="alert alert--error" role="alert">{serverError}</div> : null}
        <AuthField label="Full name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
        <AuthField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <AuthField label="Mobile number (optional)" type="tel" inputMode="numeric" maxLength={10} autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} hint="10 digits, starting with 6-9" />
        <AuthField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters with a letter and a number" />
        <AuthField label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
