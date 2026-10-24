import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../services/api';
import AuthShell from '../components/AuthShell';
import AuthField from '../components/AuthField';
import { validateEmail } from '../utils/checkoutValidation';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const err = validateEmail(email);
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setResult(data);
    } catch (e2) {
      setError(apiError(e2));
    } finally {
      setBusy(false);
    }
  };

  // The server returns devResetUrl only outside production. Turn it into an in-app path.
  let devPath = '';
  if (result && result.devResetUrl) {
    try { const u = new URL(result.devResetUrl); devPath = `${u.pathname}${u.search}`; } catch (e) { devPath = ''; }
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your account email and we will generate a reset link." footer={<Link to="/login">Back to log in</Link>}>
      {result ? (
        <div>
          <div className="alert alert--success" role="status">{result.message}</div>
          <p className="muted">This project has no email service configured, so no email is sent. The reset link is printed in the server log.</p>
          {devPath ? (
            <div className="auth-dev">
              <strong>Development only</strong>
              <p style={{ margin: '4px 0 10px' }}>The server is not in production mode, so the link is shown here to let you test the flow:</p>
              <Link className="btn btn--primary btn--sm" to={devPath}>Open reset page</Link>
            </div>
          ) : null}
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <AuthField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>{busy ? 'Generating...' : 'Generate reset link'}</button>
        </form>
      )}
    </AuthShell>
  );
}
