import { useOwner } from './OwnerContext';

/** Shown only when the owner has more than one restaurant. */
export default function RestaurantSwitcher() {
  const { restaurants, restaurantId, setRestaurantId } = useOwner();
  if (restaurants.length < 2) return null;
  return (
    <div className="field own-switch">
      <label htmlFor="own-rest">Restaurant</label>
      <select id="own-rest" className="select" value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
        {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
    </div>
  );
}

/** Explains a pending/rejected restaurant (API answers 403 NOT_APPROVED). */
export function ApprovalNotice({ restaurant }) {
  if (!restaurant || restaurant.approvalStatus === 'approved') return null;
  return (
    <div className="alert alert--warn" role="status">
      {restaurant.name} is <strong>{restaurant.approvalStatus}</strong>. You can edit the profile now; menu changes and orders unlock once an administrator approves it.
    </div>
  );
}
