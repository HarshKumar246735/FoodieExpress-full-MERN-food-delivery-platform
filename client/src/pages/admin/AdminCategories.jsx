import { useEffect, useState } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import useApi from '../../hooks/useApi';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import FoodImage from '../../components/FoodImage';
import AuthField from '../../components/AuthField';
import { Badge } from '../../components/Badges';
import { ConfirmDialog, Modal } from '../../components/Modal';
import '../../css/admin-extra.css';

const BLANK = { name: '', description: '', image: '', sortOrder: 0, isActive: true };

function CategoryForm({ open, category, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(BLANK);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setF(category ? { name: category.name, description: category.description || '', image: category.image || '', sortOrder: category.sortOrder || 0, isActive: category.isActive } : BLANK);
      setErr({});
    }
  }, [open, category]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (f.name.trim().length < 2) v.name = 'Name must be at least 2 characters';
    if (f.name.trim().length > 60) v.name = 'Name must be 60 characters or fewer';
    if (f.description.length > 240) v.description = 'Description must be 240 characters or fewer';
    if (f.image && !/^(https?:\/\/|\/)/i.test(f.image.trim())) v.image = 'Use a full http(s) URL';
    if (Number.isNaN(Number(f.sortOrder))) v.sortOrder = 'Enter a number';
    setErr(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const payload = { name: f.name.trim(), description: f.description.trim(), image: f.image.trim(), sortOrder: Number(f.sortOrder) || 0 };
      if (category) await api.put(`/admin/categories/${category.id}`, { ...payload, isActive: f.isActive });
      else await api.post('/admin/categories', payload);
      toast.success(category ? 'Category updated' : 'Category created');
      onSaved();
    } catch (ex) {
      toast.error(apiError(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={category ? 'Edit category' : 'New category'} onClose={onClose}>
      <form onSubmit={submit} noValidate id="cat-form">
        <AuthField label="Name" value={f.name} onChange={set('name')} error={err.name} maxLength={60} autoFocus />
        <AuthField label="Description" as="textarea" value={f.description} onChange={set('description')} error={err.description} hint={`${f.description.length}/240`} />
        <AuthField label="Image URL" value={f.image} onChange={set('image')} error={err.image} placeholder="https://..." />
        <div className="ax-form-grid">
          <AuthField label="Sort order" type="number" value={f.sortOrder} onChange={set('sortOrder')} error={err.sortOrder} hint="Lower numbers appear first" />
          {category ? (
            <div className="field">
              <span className="label">Visibility</span>
              <label className="switch"><input type="checkbox" checked={f.isActive} onChange={set('isActive')} /><span className="switch__track" /><span>{f.isActive ? 'Active' : 'Hidden from customers'}</span></label>
            </div>
          ) : null}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Saving...' : category ? 'Save changes' : 'Create category'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminCategories() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/admin/categories');
  const [editing, setEditing] = useState(null); // null | 'new' | category
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const cats = (data && data.categories) || [];

  const toggle = async (c) => {
    try {
      await api.put(`/admin/categories/${c.id}`, { isActive: !c.isActive });
      toast.success(`${c.name} is now ${c.isActive ? 'hidden' : 'active'}`);
      reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/categories/${deleting.id}`);
      toast.success('Category deleted');
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(apiError(e)); // e.g. "This category still has food items..."
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dash-head">
        <div><h1>Categories</h1><p className="muted" style={{ margin: 0 }}>{cats.length} categories shown to customers on the storefront.</p></div>
        <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}><Plus size={18} aria-hidden="true" /> New category</button>
      </div>
      <Panel>
        <DataState loading={loading && !data} error={error} onRetry={reload}>
          {cats.length === 0 ? (
            <EmptyState icon={Tags} title="No categories yet" message="Create your first category to organise the menu." action={<button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>New category</button>} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Category</th><th>Slug</th><th>Items</th><th>Order</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {cats.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="ax-cat">
                          <div className="thumb"><FoodImage src={c.image} alt="" ratio="1 / 1" label={c.name.slice(0, 2)} /></div>
                          <div className="ax-cell-main"><strong>{c.name}</strong><small className="ax-clip">{c.description}</small></div>
                        </div>
                      </td>
                      <td className="ax-mono">{c.slug}</td>
                      <td>{c.itemCount}</td>
                      <td>{c.sortOrder}</td>
                      <td>
                        <label className="switch" title="Show or hide on the storefront">
                          <input type="checkbox" checked={c.isActive} onChange={() => toggle(c)} aria-label={`${c.name} active`} /><span className="switch__track" />
                          <Badge tone={c.isActive ? 'green' : ''}>{c.isActive ? 'Active' : 'Hidden'}</Badge>
                        </label>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}><Pencil size={14} /> Edit</button>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}><Trash2 size={14} /> Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </Panel>
      <CategoryForm open={Boolean(editing)} category={editing && editing !== 'new' ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      <ConfirmDialog open={Boolean(deleting)} danger busy={busy} title="Delete category?" confirmLabel="Delete" message={deleting ? `Delete "${deleting.name}"? ${deleting.itemCount > 0 ? `It still has ${deleting.itemCount} food item(s), so the server will refuse; deactivate it instead.` : 'This cannot be undone.'}` : ''} onCancel={() => setDeleting(null)} onConfirm={remove} />
    </>
  );
}
