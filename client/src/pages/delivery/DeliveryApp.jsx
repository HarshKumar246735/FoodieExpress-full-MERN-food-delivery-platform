import { Route, Routes } from 'react-router-dom';
import { Bike, History, LayoutDashboard, PackageSearch } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import DeliveryOverview from './DeliveryOverview';
import DeliveryAvailable from './DeliveryAvailable';
import DeliveryActive from './DeliveryActive';
import DeliveryHistory from './DeliveryHistory';
import NotFound from '../NotFound';

const LINKS = [
  { to: '/delivery', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/delivery/available', label: 'Available jobs', icon: PackageSearch },
  { to: '/delivery/active', label: 'My deliveries', icon: Bike },
  { to: '/delivery/history', label: 'History', icon: History },
];

export default function DeliveryApp() {
  return (
    <Routes>
      <Route element={<DashboardLayout title="Delivery partner" subtitle="Pick up and deliver orders" links={LINKS} />}>
        <Route index element={<DeliveryOverview />} />
        <Route path="available" element={<DeliveryAvailable />} />
        <Route path="active" element={<DeliveryActive />} />
        <Route path="history" element={<DeliveryHistory />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
