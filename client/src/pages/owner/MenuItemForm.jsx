import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import Modal from '../../components/Modal';
import AuthField from '../../components/AuthField';
import FoodImage from '../../components/FoodImage';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const blank = { name: '', description: '', category: '', price: '', discountedPrice: '', prepTime: 20, isVeg: true, image: '', ingredients: '' };

const fromFood = (f) => ({
  name: f.name, description: f.description || '', category: f.category && f.category.id ? f.category.id : '', price: f.price,
  discountedPrice: f.discountedPrice || '', prepTime: f.prepTime, isVeg: f.isVeg, image: f.image || '', ingredients: (f.ingredients || []).join(', '),
});

/** Add / edit modal. Mirrors validators.foodInput; the server stays the source of truth. */
export default function MenuItemForm({ open, food, categories, restaurantId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(food ? fromFood(food) : blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Name is required (2-100 characters)';
    if (!form.category) e.category = 'Choose a category';
    const price = Number(form.price);
    if (!(price >= 1 && price <= 100000)) e.price = 'Price must be at least ₹1';
    if (form.discountedPrice !== '' && form.discountedPrice !== null) {
      const dp = Number(form.discountedPrice);
      if (!(dp >= 1)) e.discountedPrice = 'Enter a valid discounted price';
      else if (dp >= price) e.discountedPrice = 'Must be lower than the price';
    }
    const prep = Number(form.prepTime);
    if (!(Number.isInteger(prep) && prep >= 1 && prep <= 120)) e.prepTime = 'Whole minutes, 1-120';
    if (form.description.length > 500) e.description = 'Max 500 characters';
    return e;
  };

  const upload = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Only JPG, PNG or WebP images are allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be 5 MB or smaller'); return; }
    const fd = new FormData();
    fd.append('image', file);
    setUploading(true);
    try {
      const { data } = await api.post('/owner/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' }, params: restaurantId ? { restaurant: restaurantId } : undefined });
      setForm((f) => ({ ...f, image: data.url }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = {
      name: form.name.trim(), description: form.description.trim(), category: form.category, price: Number(form.price),
      discountedPrice: form.discountedPrice === '' ? null : Number(form.discountedPrice), prepTime: Number(form.prepTime),
      isVeg: form.isVeg, image: form.image.trim(), ingredients: form.ingredients,
    };
    setBusy(true);
    try {
      const params = restaurantId ? { restaurant: restaurantId } : undefined;
      if (food) await api.put(`/owner/menu/${food.id}`, payload, { params });
      else await api.post('/owner/menu', payload, { params });
      toast.success(food ? 'Menu item updated' : 'Menu item added');
      onSaved();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      size="lg"
      title={food ? `Edit ${food.name}` : 'Add menu item'}
      onClose={() => !busy && onClose()}
      footer={<><button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" form="own-food" className="btn btn--primary" disabled={busy || uploading}>{busy ? 'Saving...' : 'Save item'}</button></>}
    >
      <form id="own-food" onSubmit={submit} noValidate>
        <div className="form-grid">
          <AuthField className="full" label="Name" value={form.name} onChange={set('name')} error={errors.name} maxLength={100} />
          <AuthField className="full" as="textarea" label="Description" value={form.description} onChange={set('description')} error={errors.description} maxLength={500} />
          <AuthField as="select" label="Category" value={form.category} onChange={set('category')} error={errors.category}>
            <option value="">Choose...</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </AuthField>
          <AuthField label="Preparation time (min)" type="number" min="1" max="120" value={form.prepTime} onChange={set('prepTime')} error={errors.prepTime} />
          <AuthField label="Price (₹)" type="number" min="1" step="1" inputMode="decimal" value={form.price} onChange={set('price')} error={errors.price} />
          <AuthField label="Discounted price (₹, optional)" type="number" min="1" step="1" inputMode="decimal" value={form.discountedPrice} onChange={set('discountedPrice')} error={errors.discountedPrice} />
          <AuthField className="full" label="Ingredients (comma separated)" value={form.ingredients} onChange={set('ingredients')} />
          <div className="field full">
            <span className="label">Diet</span>
            <label className="check"><input type="checkbox" checked={form.isVeg} onChange={set('isVeg')} /> Vegetarian</label>
          </div>
          <div className="field full own-img">
            <span className="label">Photo</span>
            <div className="own-img__row">
              <div className="own-img__preview"><FoodImage src={form.image} alt="Menu item preview" ratio="4 / 3" label="No photo" /></div>
              <div className="stack">
                <input ref={fileRef} id="own-file" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files[0])} />
                <label htmlFor="own-file" className="btn btn--ghost btn--sm" aria-disabled={uploading}><ImagePlus size={16} aria-hidden="true" /> {uploading ? 'Uploading...' : 'Upload image'}</label>
                <input className="input" type="text" placeholder="...or paste an image URL" aria-label="Image URL" value={form.image} onChange={set('image')} maxLength={500} />
                <span className="field__hint">JPG, PNG or WebP, up to 5 MB.</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
