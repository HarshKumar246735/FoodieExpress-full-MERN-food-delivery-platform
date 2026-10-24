import { useState } from 'react';
import { Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import FoodImage from '../../components/FoodImage';
import { ConfirmDialog } from '../../components/Modal';
import { VegMark } from '../../components/Badges';
import useApi from '../../hooks/useApi';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { rupee } from '../../utils/format';
import { scope, useOwner } from './OwnerContext';
import RestaurantSwitcher, { ApprovalNotice } from './RestaurantSwitcher';
import MenuItemForm from './MenuItemForm';

export default function OwnerMenu() {
  const toast = useToast();
  const { restaurantId, restaurant } = useOwner();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | food
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const approved = restaurant && restaurant.approvalStatus === 'approved';
  const { data, loading, error, reload } = useApi('/owner/menu', { params: scope(restaurantId, { q: q.trim() || undefined, category: category || undefined }), enabled: Boolean(restaurantId) });
  const foods = (data && data.foods) || [];
  const categories = (data && data.categories) || [];
  const params = restaurantId ? { restaurant: restaurantId } : undefined;

  const toggle = async (f) => {
    try {
      await api.patch(`/owner/menu/${f.id}/availability`, { isAvailable: !f.isAvailable }, { params });
      toast.success(`${f.name} marked ${f.isAvailable ? 'unavailable' : 'available'}`);
      reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/owner/menu/${deleting.id}`, { params });
      toast.success('Menu item deleted');
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
        <h1>Menu</h1>
        <div className="row row--wrap">
          <RestaurantSwitcher />
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')} disabled={!approved}><Plus size={16} aria-hidden="true" /> Add item</button>
        </div>
      </div>
      <ApprovalNotice restaurant={restaurant} />
      <Panel>
        <div className="toolbar">
          <input className="input toolbar__grow" type="search" placeholder="Search your menu" aria-label="Search menu" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <DataState loading={loading && !data} error={error} onRetry={reload}>
          {foods.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} title="No menu items" message={q || category ? 'No items match your search.' : 'Add your first dish to start receiving orders.'} action={approved && !q && !category ? <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>Add item</button> : null} />
          ) : (
            <div className="table-wrap">
              <table className="table own-menu">
                <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Available</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {foods.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <div className="row">
                          <div className="thumb"><FoodImage src={f.image} alt={f.name} ratio="1 / 1" label={f.name.slice(0, 2)} /></div>
                          <div><div className="row"><VegMark isVeg={f.isVeg} /><strong>{f.name}</strong></div><span className="muted">{f.prepTime} min</span></div>
                        </div>
                      </td>
                      <td>{f.category && f.category.name}</td>
                      <td>{rupee(f.unitPrice)}{f.discountPercent > 0 ? <s className="muted own-s"> {rupee(f.price)}</s> : null}</td>
                      <td>
                        <label className="switch">
                          <input type="checkbox" checked={f.isAvailable} onChange={() => toggle(f)} disabled={!approved} aria-label={`${f.name} available`} />
                          <span className="switch__track" />
                        </label>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="icon-btn" onClick={() => setEditing(f)} aria-label={`Edit ${f.name}`} disabled={!approved}><Pencil size={16} /></button>
                          <button type="button" className="icon-btn" onClick={() => setDeleting(f)} aria-label={`Delete ${f.name}`} disabled={!approved}><Trash2 size={16} /></button>
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

      {editing ? (
        <MenuItemForm key={editing === 'new' ? 'new' : editing.id} open food={editing === 'new' ? null : editing} categories={categories} restaurantId={restaurantId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      ) : null}
      <ConfirmDialog open={Boolean(deleting)} danger busy={busy} title="Delete menu item?" message={deleting ? `${deleting.name} will be removed from your menu. Past orders are not affected.` : ''} confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={remove} />
    </>
  );
}
