import { useCallback, useEffect, useMemo, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LayoutDashboard, Receipt, Star, Store, UtensilsCrossed } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { PageLoader } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import useApi from '../../hooks/useApi';
import { OwnerContext } from './OwnerContext';
import OwnerOverview from './OwnerOverview';
import OwnerMenu from './OwnerMenu';
import OwnerOrders from './OwnerOrders';
import OwnerRestaurant from './OwnerRestaurant';
import OwnerReviews from './OwnerReviews';
import '../../css/owner.css';

const LINKS = [
  { to: '/owner', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/owner/orders', label: 'Orders', icon: Receipt },
  { to: '/owner/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/owner/restaurant', label: 'Restaurant', icon: Store },
  { to: '/owner/reviews', label: 'Ratings', icon: Star },
];

export default function OwnerApp() {
  const { data, loading, error, reload } = useApi('/owner/restaurants');
  const [selected, setSelected] = useState('');
  const restaurants = (data && data.restaurants) || [];
  useEffect(() => {
    if (!selected && restaurants.length) setSelected(restaurants[0].id);
  }, [restaurants, selected]);
  const restaurant = restaurants.find((r) => r.id === selected) || null;
  const doReload = useCallback(() => reload(), [reload]);
  const ctx = useMemo(() => ({ restaurants, restaurantId: selected, restaurant, setRestaurantId: setSelected, reload: doReload }), [restaurants, selected, restaurant, doReload]);

  if (loading && !data) return <PageLoader />;
  if (error) return <div className="container page"><div className="alert alert--error" role="alert">{error} <button type="button" className="btn btn--sm btn--ghost" onClick={reload}>Try again</button></div></div>;
  if (!restaurants.length) {
    return <div className="container page"><EmptyState icon={Store} title="No restaurant linked to your account" message="Ask an administrator to create a restaurant for you, then sign in again." /></div>;
  }

  return (
    <OwnerContext.Provider value={ctx}>
      <Routes>
        <Route element={<DashboardLayout title="Restaurant" subtitle={restaurant ? restaurant.name : ''} links={LINKS} />}>
          <Route index element={<OwnerOverview />} />
          <Route path="orders" element={<OwnerOrders />} />
          <Route path="menu" element={<OwnerMenu />} />
          <Route path="restaurant" element={<OwnerRestaurant />} />
          <Route path="reviews" element={<OwnerReviews />} />
          <Route path="*" element={<EmptyState title="Page not found" message="That dashboard page does not exist." />} />
        </Route>
      </Routes>
    </OwnerContext.Provider>
  );
}
