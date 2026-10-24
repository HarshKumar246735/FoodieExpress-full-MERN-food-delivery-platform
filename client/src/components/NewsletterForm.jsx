import { useState } from 'react';
import api, { apiError } from '../services/api';
import { useToast } from '../context/ToastContext';
import '../css/section.css';

export default function NewsletterForm({ buttonLabel = 'Subscribe', idPrefix = 'nl' }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/newsletter', { email: email.trim() });
      toast.success(data.message || 'Thanks for subscribing!');
      setEmail('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="nl-form" onSubmit={submit} noValidate>
      <label htmlFor={`${idPrefix}-email`} className="sr-only">Email address</label>
      <input id={`${idPrefix}-email`} type="email" className={`input ${error ? 'input--error' : ''}`} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={Boolean(error)} aria-describedby={error ? `${idPrefix}-err` : undefined} />
      <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Subscribing...' : buttonLabel}</button>
      {error ? <p id={`${idPrefix}-err`} className="field__error nl-form__error" role="alert">{error}</p> : null}
    </form>
  );
}
