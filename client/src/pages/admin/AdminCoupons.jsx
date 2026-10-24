import { useEffect, useState } from 'react';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import useApi from '../../hooks/useApi';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import AuthField from '../../components/AuthField';
import { Badge } from '../../components/Badges';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { formatDate, rupee } from '../../utils/format';
import '../../css/admin-extra.css';

const BLANK = { code: '', description: '', type: 'FLAT', value: '', minOrder: '0', maxDiscount: '0', usageLimit: '0', perUserLimit: '0', startsAt: '', expiresAt: '', isActive: true };
const TYPE_LABEL = { FLAT: 'Flat amount off', PERCENT: 'Percentage off', FREESHIP: 'Free delivery' };

// <input type="date"> value <-> ISO string
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const endOfDayIso = (s) => new Date(`${s}T23:59:59`).toISOString();
const startOfDayIso = (s) => new Date(`${s}T00:00:00`).toISOString();

const describe = (c) => (c.type === 'FREESHIP' ? 'Free delivery' : c.type === 'PERCENT' ? `${c.value}% off${c.maxDiscount ? ` (max ${rupee(c.maxDiscount)})` : ''}` : `${rupee(c.value)} off`);

function couponState(c) {
  const now = Date.now();
  if (!c.isActive) return { label: 'Inactive', tone: '' };
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return { label: 'Expired', tone: 'red' };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: 'Scheduled', tone: 'blue' };
  if (c.usageLimit > 0 && c.usedCount >= c.usageLimit) return { label: 'Fully used', tone: 'amber' };
  return { label: 'Live', tone: 'green' };
}

function CouponForm({ open, coupon, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(BLANK);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErr({});
    setF(coupon ? { code: coupon.code, description: coupon.description || '', type: coupon.type, value: String(coupon.value ?? ''), minOrder: String(coupon.minOrder ?? 0), maxDiscount: String(coupon.maxDiscount ?? 0), usageLimit: String(coupon.usageLimit ?? 0), perUserLimit: String(coupon.perUserLimit ?? 0), startsAt: toDateInput(coupon.startsAt), expiresAt: toDateInput(coupon.expiresAt), isActive: coupon.isActive } : BLANK);
  }, [open, coupon]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    const num = (x) => (x === '' ? NaN : Number(x));
    if (!coupon && !/^[A-Za-z0-9_-]{2,24}$/.test(f.code.trim())) v.code = '2-24 characters: letters, numbers, - and _';
    if (f.description.length > 200) v.description = 'Keep it under 200 characters';
    if (f.type !== 'FREESHIP') {
      const val = num(f.value);
      if (Number.isNaN(val) || val <= 0) v.value = 'Enter a value greater than 0';
      else if (f.type === 'PERCENT' && val > 100) v.value = 'A percentage cannot exceed 100';
      const md = num(f.maxDiscount);
      if (Number.isNaN(md) || md < 0) v.maxDiscount = 'Enter 0 or more (0 = no cap)';
    }
    const mo = num(f.minOrder);
    if (Number.isNaN(mo) || mo < 0) v.minOrder = 'Enter 0 or more';
    ['usageLimit', 'perUserLimit'].forEach((k) => {
      const n = num(f[k]);
      if (!Number.isInteger(n) || n < 0) v[k] = 'Enter a whole number, 0 or more (0 = unlimited)';
    });
    if (f.startsAt && f.expiresAt && f.startsAt > f.expiresAt) v.expiresAt = 'Expiry must be after the start date';
    setErr(v);
    if (Object.keys(v).length) return;

    const payload = {
      description: f.description.trim(),
      type: f.type,
      value: f.type === 'FREESHIP' ? 0 : Number(f.value),
      minOrder: Number(f.minOrder),
      maxDiscount: f.type === 'FREESHIP' ? 0 : Number(f.maxDiscount),
      usageLimit: Number(f.usageLimit),
      perUserLimit: Number(f.perUserLimit),
      startsAt: f.startsAt ? startOfDayIso(f.startsAt) : null,
      expiresAt: f.expiresAt ? endOfDayIso(f.expiresAt) : null,
      isActive: f.isActive,
    };
    setBusy(true);
    try {
      if (coupon) await api.put(`/admin/coupons/${coupon._id}`, payload);
      else await api.post('/admin/coupons', { ...payload, code: f.code.trim().toUpperCase() });
      toast.success(coupon ? 'Coupon updated' : 'Coupon created');
      onSaved();
    } catch (ex) {
      const dup = ex.response && ex.response.data && /duplicate|E11000/i.test(JSON.stringify(ex.response.data));
      toast.error(dup ? 'A coupon with this code already exists' : apiError(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={coupon ? `Edit ${coupon.code}` : 'New coupon'} onClose={onClose} size="lg">
      <form onSubmit={submit} noValidate>
        <div className="ax-form-grid">
          <AuthField label="Code" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value.toUpperCase() }))} error={err.code} disabled={Boolean(coupon)} hint={coupon ? 'Codes cannot be changed after creation' : 'e.g. WELCOME50'} maxLength={24} autoFocus={!coupon} />
          <AuthField label="Discount type" as="select" value={f.type} onChange={set('type')}>
            {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </AuthField>
          <AuthField className="full" label="Description" value={f.description} onChange={set('description')} error={err.description} placeholder="Shown to customers" />
          {f.type !== 'FREESHIP' ? <AuthField label={f.type === 'PERCENT' ? 'Percent off (%)' : 'Amount off (₹)'} type="number" min="0" step="any" value={f.value} onChange={set('value')} error={err.value} /> : null}
          {f.type !== 'FREESHIP' ? <AuthField label="Maximum discount (₹)" type="number" min="0" value={f.maxDiscount} onChange={set('maxDiscount')} error={err.maxDiscount} hint="0 = no cap" /> : null}
          <AuthField label="Minimum order (₹)" type="number" min="0" value={f.minOrder} onChange={set('minOrder')} error={err.minOrder} />
          <AuthField label="Total usage limit" type="number" min="0" value={f.usageLimit} onChange={set('usageLimit')} error={err.usageLimit} hint="0 = unlimited" />
          <AuthField label="Per-user limit" type="number" min="0" value={f.perUserLimit} onChange={set('perUserLimit')} error={err.perUserLimit} hint="0 = unlimited" />
          <AuthField label="Starts on" type="date" value={f.startsAt} onChange={set('startsAt')} hint="Optional" />
          <AuthField label="Expires on" type="date" value={f.expiresAt} onChange={set('expiresAt')} error={err.expiresAt} hint="Optional; valid until the end of this day" />
          <div className="field">
            <span className="label">Status</span>
            <label className="switch"><input type="checkbox" checked={f.isActive} onChange={set('isActive')} /><span className="switch__track" /><span>{f.isActive ? 'Active' : 'Inactive'}</span></label>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Saving...' : coupon ? 'Save changes' : 'Create coupon'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminCoupons() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/admin/coupons');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const coupons = (data && data.coupons) || [];

  const toggle = async (c) => {
    try {
      await api.put(`/admin/coupons/${c._id}`, { isActive: !c.isActive });
      toast.success(`${c.code} ${c.isActive ? 'deactivated' : 'activated'}`);
      reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/coupons/${deleting._id}`);
      toast.success('Coupon deleted');
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dash-head">
        <div><h1>Coupons</h1><p className="muted" style={{ margin: 0 }}>Limits and expiry are enforced by the server at checkout.</p></div>
        <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}><Plus size={18} aria-hidden="true" /> New coupon</button>
      </div>
      <Panel>
        <DataState loading={loading && !data} error={error} onRetry={reload}>
          {coupons.length === 0 ? (
            <EmptyState icon={Tag} title="No coupons yet" message="Create a coupon to run a promotion." action={<button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>New coupon</button>} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Code</th><th>Offer</th><th>Min order</th><th>Used</th><th>Per user</th><th>Validity</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {coupons.map((c) => {
                    const st = couponState(c);
                    return (
                      <tr key={c._id}>
                        <td><span className="ax-code">{c.code}</span></td>
                        <td><div className="ax-cell-main"><strong>{describe(c)}</strong><small className="ax-clip">{c.description}</small></div></td>
                        <td>{c.minOrder ? rupee(c.minOrder) : 'None'}</td>
                        <td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ' / ∞'}</td>
                        <td>{c.perUserLimit || '∞'}</td>
                        <td><small>{c.startsAt ? `From ${formatDate(c.startsAt)}` : 'Any time'}<br />{c.expiresAt ? `Until ${formatDate(c.expiresAt)}` : 'No expiry'}</small></td>
                        <td>
                          <label className="switch">
                            <input type="checkbox" checked={c.isActive} onChange={() => toggle(c)} aria-label={`${c.code} active`} /><span className="switch__track" />
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </label>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(c)} aria-label={`Edit ${c.code}`}><Pencil size={14} /> Edit</button>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDeleting(c)} aria-label={`Delete ${c.code}`}><Trash2 size={14} /> Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </Panel>
      <CouponForm open={Boolean(editing)} coupon={editing && editing !== 'new' ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      <ConfirmDialog open={Boolean(deleting)} danger busy={busy} title="Delete coupon?" confirmLabel="Delete" message={deleting ? `Delete ${deleting.code}? Past orders keep their discount. Consider deactivating instead.` : ''} onCancel={() => setDeleting(null)} onConfirm={remove} />
    </>
  );
}
