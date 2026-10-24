import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, ExternalLink, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import '../css/dashboard.css';

/**
 * Shared shell for the owner, delivery and admin dashboards.
 * <DashboardLayout title="Restaurant" links={[{ to: '/owner', label: 'Overview', icon: Home, end: true }, ...]} />
 * Child routes render through <Outlet />. The bell shows the unread in-app notification count (live via Socket.IO).
 */
export default function DashboardLayout({ title, subtitle, links }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/orders/notifications');
      setUnread(data.unread || 0);
    } catch (e) {
      /* non-critical */
    }
  }, []);
  useEffect(() => { loadUnread(); }, [loadUnread]);
  useSocketEvent('notification', (n) => {
    setUnread((c) => c + 1);
    if (n && n.title) toast.info(n.title);
  });

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="dash">
      <aside className={`dash__side ${open ? 'is-open' : ''}`} aria-label={`${title} navigation`}>
        <div className="dash__brand">
          <Link to="/" className="dash__logo" onClick={() => setOpen(false)}>Foodie<span>Express</span></Link>
          <button type="button" className="icon-btn dash__close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <p className="dash__role">{title}</p>
        <nav className="dash__nav">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `dash__link ${isActive ? 'is-active' : ''}`} onClick={() => setOpen(false)}>
              {Icon ? <Icon size={18} aria-hidden="true" /> : null}
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="dash__side-foot">
          <Link to="/" className="dash__link"><ExternalLink size={18} aria-hidden="true" /><span>View storefront</span></Link>
          <button type="button" className="dash__link dash__link--btn" onClick={signOut}><LogOut size={18} aria-hidden="true" /><span>Sign out</span></button>
        </div>
      </aside>
      {open ? <button type="button" className="dash__scrim" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}

      <div className="dash__main">
        <header className="dash__top">
          <button type="button" className="icon-btn dash__burger" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
          <div className="dash__top-title">
            <strong>{title}</strong>
            {subtitle ? <span className="muted">{subtitle}</span> : null}
          </div>
          <div className="row">
            <Link to="/notifications" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => setUnread(0)}>
              <Bell size={18} />
              {unread > 0 ? <span className="dash__dot">{unread > 9 ? '9+' : unread}</span> : null}
            </Link>
            <span className="dash__user">{user && user.name}</span>
          </div>
        </header>
        <main className="dash__content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
