import { useEffect, useState } from 'react';
import { Modal, ConfirmDialog } from '../../../components/Modal';
import AuthField from '../../../components/AuthField';
import api, { apiError } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { PIN_RE } from '../../../utils/checkoutValidation';

/** Reject needs a reason (server requires it); the owner is notified with it. */
export function RejectModal({ restaurant, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setReason(''); setError(''); }, [restaurant]);
  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 3) { setError('Please give a short reason (at least 3 characters)'); return; }
    setBusy(true);
    try {
      await api.patch(`/admin/restaurants/${restaurant.id}/approval`, { approvalStatus: 'rejected', reason: reason.trim() });
      toast.success(`${restaurant.name} rejected`);
      onDone();
      onClose();
    } catch (ex) { setError(apiError(ex)); } finally { setBusy(false); }
  };
  return (
    <Modal open={Boolean(restaurant)} title="Reject restaurant" onClose={onClose} footer={<>
      <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
      <button type="submit" form="adm-reject" className="btn btn--danger" disabled={busy}>{busy ? 'Rejecting...' : 'Reject restaurant'}</button>
    </>}>
      <form id="adm-reject" onSubmit={submit} noValidate>
        <p>{restaurant ? `${restaurant.name} will be hidden from customers and the owner will see your reason.` : ''}</p>
        <AuthField as="textarea" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} error={error} maxLength={200} placeholder="e.g. Missing food licence details" />
      </form>
    </Modal>
  );
}

export function ApproveConfirm({ restaurant, onClose, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await api.patch(`/admin/restaurants/${restaurant.id}/approval`, { approvalStatus: 'approved' });
      toast.success(`${restaurant.name} approved and live`);
      onDone();
      onClose();
    } catch (ex) { toast.error(apiError(ex)); } finally { setBusy(false); }
  };
  return <ConfirmDialog open={Boolean(restaurant)} busy={busy} title="Approve restaurant?" message={restaurant ? `${restaurant.name} will become visible to customers and can receive orders.` : ''} confirmLabel="Approve" onCancel={onClose} onConfirm={go} />;
}

const EMPTY = { name: '', ownerId: '', description: '', cuisines: '', line: '', city: '', state: '', postalCode: '', approve: true };

export function CreateRestaurantModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [f, setF] = useState(EMPTY);
  const [owners, setOwners] = useState([]);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => {
    if (!open) return;
    setLoadingOwners(true);
    api.get('/admin/users', { params: { role: 'owner', status: 'active', limit: 100 } })
      .then(({ data }) => setOwners(data.users || []))
      .catch((e) => setServerError(apiError(e)))
      .finally(() => setLoadingOwners(false));
  }, [open]);

  const close = () => { setF(EMPTY); setErrors({}); setServerError(''); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (f.name.trim().length < 2) err.name = 'Restaurant name is required';
    if (!f.ownerId) err.ownerId = 'Choose an owner';
    if (f.postalCode && !PIN_RE.test(f.postalCode.trim())) err.postalCode = 'Enter a valid 6-digit postal code';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    setServerError('');
    try {
      await api.post('/admin/restaurants', {
        name: f.name.trim(),
        ownerId: f.ownerId,
        description: f.description.trim(),
        cuisines: f.cuisines.split(',').map((s) => s.trim()).filter(Boolean),
        address: { line: f.line.trim(), city: f.city.trim(), state: f.state.trim(), postalCode: f.postalCode.trim() },
        approve: f.approve,
      });
      toast.success(`${f.name.trim()} created${f.approve ? ' and approved' : ' (pending approval)'}`);
      setF(EMPTY);
      onCreated();
      onClose();
    } catch (ex) { setServerError(apiError(ex)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} size="lg" title="Create restaurant" onClose={close} footer={<>
      <button type="button" className="btn btn--ghost" onClick={close} disabled={busy}>Cancel</button>
      <button type="submit" form="adm-create-rest" className="btn btn--primary" disabled={busy}>{busy ? 'Creating...' : 'Create restaurant'}</button>
    </>}>
      <form id="adm-create-rest" onSubmit={submit} noValidate>
        {serverError ? <div className="alert alert--error" role="alert">{serverError}</div> : null}
        <div className="form-grid">
          <AuthField label="Restaurant name" value={f.name} onChange={set('name')} error={errors.name} />
          <AuthField label="Owner" as="select" value={f.ownerId} onChange={set('ownerId')} error={errors.ownerId} disabled={loadingOwners} hint={loadingOwners ? 'Loading owners...' : owners.length ? undefined : 'No active owner accounts. Create one in Users first.'}>
            <option value="">Select an owner</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.email})</option>)}
          </AuthField>
          <AuthField label="Cuisines" value={f.cuisines} onChange={set('cuisines')} placeholder="North Indian, Biryani" hint="Comma separated" className="full" />
          <AuthField label="Description" as="textarea" value={f.description} onChange={set('description')} maxLength={600} className="full" />
          <AuthField label="Street address" value={f.line} onChange={set('line')} className="full" />
          <AuthField label="City" value={f.city} onChange={set('city')} />
          <AuthField label="State" value={f.state} onChange={set('state')} />
          <AuthField label="Postal code" value={f.postalCode} onChange={set('postalCode')} error={errors.postalCode} inputMode="numeric" maxLength={6} />
        </div>
        <label className="check"><input type="checkbox" checked={f.approve} onChange={(e) => setF((s) => ({ ...s, approve: e.target.checked }))} /> Approve immediately</label>
      </form>
    </Modal>
  );
}
