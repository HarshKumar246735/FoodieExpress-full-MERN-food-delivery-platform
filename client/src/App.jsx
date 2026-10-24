import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { PageLoader } from './components/Skeleton';

const page = (loader) => lazy(loader);
const Home = page(() => import('./pages/Home'));
const Categories = page(() => import('./pages/Categories'));
const CategoryPage = page(() => import('./pages/CategoryPage'));
const Restaurants = page(() => import('./pages/Restaurants'));
const RestaurantDetail = page(() => import('./pages/RestaurantDetail'));
const FoodListing = page(() => import('./pages/FoodListing'));
const FoodDetail = page(() => import('./pages/FoodDetail'));
const Cart = page(() => import('./pages/Cart'));
const StaticPage = page(() => import('./pages/StaticPage'));
const NotFound = page(() => import('./pages/NotFound'));
const Login = page(() => import('./pages/Login'));
const Register = page(() => import('./pages/Register'));
const ForgotPassword = page(() => import('./pages/ForgotPassword'));
const ResetPassword = page(() => import('./pages/ResetPassword'));
const Profile = page(() => import('./pages/Profile'));
const Checkout = page(() => import('./pages/Checkout'));
const PaymentSuccess = page(() => import('./pages/PaymentSuccess'));
const PaymentFailure = page(() => import('./pages/PaymentFailure'));
const Orders = page(() => import('./pages/Orders'));
const OrderDetail = page(() => import('./pages/OrderDetail'));
const OrderTracking = page(() => import('./pages/OrderTracking'));
const Notifications = page(() => import('./pages/Notifications'));
const Support = page(() => import('./pages/Support'));
const OwnerApp = page(() => import('./pages/owner/OwnerApp'));
const DeliveryApp = page(() => import('./pages/delivery/DeliveryApp'));
const AdminApp = page(() => import('./pages/admin/AdminApp'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="categories" element={<Categories />} />
            <Route path="category/:slug" element={<CategoryPage />} />
            <Route path="restaurants" element={<Restaurants />} />
            <Route path="restaurant/:id" element={<RestaurantDetail />} />
            <Route path="food" element={<FoodListing />} />
            <Route path="food/:id" element={<FoodDetail />} />
            <Route path="cart" element={<Cart />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            {['about', 'help', 'contact', 'terms', 'privacy', 'careers', 'partner'].map((s) => (
              <Route key={s} path={s} element={<StaticPage slug={s} />} />
            ))}

            <Route element={<ProtectedRoute roles={['customer']} />}>
              <Route path="checkout" element={<Checkout />} />
              <Route path="payment/success/:orderId" element={<PaymentSuccess />} />
              <Route path="payment/failure/:orderId" element={<PaymentFailure />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:id" element={<OrderDetail />} />
              <Route path="orders/:id/track" element={<OrderTracking />} />
              <Route path="support" element={<Support />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="profile" element={<Profile />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Role dashboards have their own layout and nested routes. */}
          <Route element={<ProtectedRoute roles={['owner']} />}>
            <Route path="owner/*" element={<OwnerApp />} />
          </Route>
          <Route element={<ProtectedRoute roles={['delivery']} />}>
            <Route path="delivery/*" element={<DeliveryApp />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="admin/*" element={<AdminApp />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
