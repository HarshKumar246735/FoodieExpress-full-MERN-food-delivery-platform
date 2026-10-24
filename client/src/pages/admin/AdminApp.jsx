import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ClipboardList, FolderTree, LayoutDashboard, MessageSquareWarning, ScrollText, Star, Store, Ticket, Truck, Users, Wallet } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import '../../css/admin.css';

const AdminOverview = lazy(() => import('./AdminOverview'));
const AdminUsers = lazy(() => import('./AdminUsers'));
const AdminRestaurants = lazy(() => import('./AdminRestaurants'));
const AdminDelivery = lazy(() => import('./AdminDelivery'));
const AdminOrders = lazy(() => import('./AdminOrders'));
const AdminCategories = lazy(() => import('./AdminCategories'));
const AdminCoupons = lazy(() => import('./AdminCoupons'));
const AdminReviews = lazy(() => import('./AdminReviews'));
const AdminComplaints = lazy(() => import('./AdminComplaints'));
const AdminTransactions = lazy(() => import('./AdminTransactions'));
const AdminAudit = lazy(() => import('./AdminAudit'));

const LINKS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/restaurants', label: 'Restaurants', icon: Store },
  { to: '/admin/delivery', label: 'Delivery partners', icon: Truck },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/complaints', label: 'Complaints', icon: MessageSquareWarning },
  { to: '/admin/transactions', label: 'Transactions', icon: Wallet },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
];


export default function AdminApp() {
  return (
    <Routes>
      <Route element={<DashboardLayout title="Admin" subtitle="Platform control centre" links={LINKS} />}>
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="restaurants" element={<AdminRestaurants />} />
        <Route path="delivery" element={<AdminDelivery />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="complaints" element={<AdminComplaints />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="audit" element={<AdminAudit />} />
      </Route>
    </Routes>
  );
}
