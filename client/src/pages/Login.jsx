import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, homeForRole } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiError } from '../services/api';
import AuthShell from '../components/AuthShell';
import AuthField from '../components/AuthField';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../utils/demoAccounts';
import { validateEmail } from '../utils/checkoutValidation';

export default function Login() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state && location.state.from;
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user && !busy) return <Navigate to={from || homeForRole(user.role)} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = { email: validateEmail(form.email), password: form.password ? '' : 'Password is required' };
    setErrors(errs);
    setServerError('');
    if (errs.email || errs.password) return;
    setBusy(true);
    try {
      const data = await login(form.email.trim(), form.password);
      toast.success(`Welcome back, ${data.user.name.split(' ')[0]}!`);
      navigate(from || homeForRole(data.user.role), { replace: true });
    } catch (err) {
      setServerError(apiError(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Log in"
      subtitle="Pick up where you left off: your cart and orders are waiting."
      footer={<>New to FoodieExpress? <Link to="/register">Create an account</Link></>}
    >
      <form onSubmit={submit} noValidate>
        {serverError ? <div className="alert alert--error" role="alert">{serverError}</div> : null}
        <AuthField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <AuthField label="Password" type="password" autoComplete="current-password" value={form.password} onChange={set('password')} error={errors.password} />
        <div className="auth-row"><span /><Link className="auth-link" to="/forgot-password">Forgot password?</Link></div>
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
      </form>

      <section className="auth-demo" aria-label="Demo accounts">
        <h2>Demo accounts</h2>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>Seeded sample accounts for trying each role. Choose one to fill the form (password: {DEMO_PASSWORD}). Available after running <code>npm run seed</code>.</p>
        <div className="auth-demo__list">
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.email} type="button" className="chip" onClick={() => { setForm({ email: a.email, password: DEMO_PASSWORD }); setErrors({}); setServerError(''); }}>{a.role}</button>
          ))}
        </div>
      </section>
    </AuthShell>
  );
}
