import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useToast } from '../context/ToastContext';
import AuthShell from '../components/AuthShell';
import AuthField from '../components/AuthField';
import { validatePassword } from '../utils/checkoutValidation';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <AuthShell title="Reset link missing" subtitle="This page needs a reset link." footer={<Link to="/login">Back to log in</Link>}>
        <div className="alert alert--warn">Open the link from your reset request, or request a new one.</div>
        <Link className="btn btn--primary" to="/forgot-password">Request a new link</Link>
      </AuthShell>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    const errs = { password: validatePassword(form.password), confirm: form.confirm !== form.password ? 'Passwords do not match' : '' };
    setErrors(errs);
    setServerError('');
    if (errs.password || errs.confirm) return;
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      toast.success('Password reset. Please log in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setServerError(apiError(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Choose a new password" subtitle="Reset links expire after 30 minutes." footer={<Link to="/login">Back to log in</Link>}>
      <form onSubmit={submit} noValidate>
        {serverError ? <div className="alert alert--error" role="alert">{serverError} <Link className="auth-link" to="/forgot-password">Request a new link</Link></div> : null}
        <AuthField label="New password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} error={errors.password} hint="At least 8 characters with a letter and a number" />
        <AuthField label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} error={errors.confirm} />
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>{busy ? 'Saving...' : 'Reset password'}</button>
      </form>
    </AuthShell>
  );
}
