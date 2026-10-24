import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, homeForRole } from '../context/AuthContext';
import { PageLoader } from './Skeleton';

/** Frontend guard only (UX). The API enforces the same rules on the server. */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return <Outlet />;
}
