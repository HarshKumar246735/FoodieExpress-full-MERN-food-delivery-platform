import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LayoutDashboard, LogOut, MapPin, Menu, Search, ShoppingBag, User, UtensilsCrossed, X, ClipboardList } from 'lucide-react';
import api from '../services/api';
import { useAuth, homeForRole } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useSocketEvent } from '../context/SocketContext';
import { debounce } from '../utils/format';
import { VegMark } from './Badges';
import '../css/navbar.css';

export const AREAS = ['Indiranagar', 'Koramangala', 'HSR Layout', 'Jayanagar', 'Whitefield', 'Malleshwaram', 'Bellandur', 'MG Road / Brigade Road'];
const LOC_KEY = 'fx_location';
const readLoc = () => {
  try { return localStorage.getItem(LOC_KEY) || AREAS[0]; } catch (e) { return AREAS[0]; }
};
const ROLE_LABEL = { owner: 'Restaurant dashboard', delivery: 'Delivery dashboard', admin: 'Admin dashboard' };

function LocationPicker() {
  const [loc, setLoc] = useState(readLoc);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, []);
  const pick = (a) => {
    setLoc(a);
    setOpen(false);
    try { localStorage.setItem(LOC_KEY, a); } catch (e) { /* storage unavailable */ }
  };
  return (
    <div className="nav-loc" ref={ref}>
      <button type="button" className="nav-loc__btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Delivery location: ${loc}. Change location`}>
        <MapPin size={18} aria-hidden="true" />
        <span className="nav-loc__text"><small>Deliver to</small><strong>{loc}</strong></span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="nav-pop nav-loc__list" role="listbox" aria-label="Delivery locations">
          {AREAS.map((a) => (
            <li key={a} role="option" aria-selected={a === loc}>
              <button type="button" className={a === loc ? 'is-active' : ''} onClick={() => pick(a)}>{a}</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef(null);
  const seq = useRef(0);

  const fetchSuggest = useRef(
    debounce(async (text) => {
      const mine = ++seq.current;
      try {
        const { data } = await api.get('/search/suggest', { params: { q: text } });
        if (mine === seq.current) setRes(data);
      } catch (e) {
        if (mine === seq.current) setRes(null);
      }
    }, 250)
  ).current;

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { seq.current += 1; fetchSuggest.cancel(); setRes(null); return; }
    fetchSuggest(t);
  }, [q, fetchSuggest]);

  useEffect(() => {
    const close = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const items = [];
  if (res) {
    res.foods.forEach((f) => items.push({ key: `f${f.id}`, to: `/food/${f.id}`, kind: 'dish', f }));
    res.restaurants.forEach((r) => items.push({ key: `r${r.id}`, to: `/restaurant/${r.slug || r.id}`, kind: 'restaurant', r }));
    res.categories.forEach((c) => items.push({ key: `c${c.id}`, to: `/category/${c.slug}`, kind: 'category', c }));
  }

  const go = (to) => { setOpen(false); setQ(''); setRes(null); navigate(to); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  };
  const submit = (e) => {
    e.preventDefault();
    if (active >= 0 && items[active]) { go(items[active].to); return; }
    const t = q.trim();
    if (t) go(`/food?q=${encodeURIComponent(t)}`);
  };
  const showList = open && q.trim().length >= 2;

  return (
    <form className="nav-search" role="search" onSubmit={submit} ref={wrap}>
      <Search size={18} aria-hidden="true" />
      <input
        type="search" className="nav-search__input" placeholder="Search dishes, restaurants or cuisines" aria-label="Search dishes, restaurants or cuisines"
        value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        role="combobox" aria-expanded={showList} aria-controls="nav-suggest" aria-autocomplete="list" aria-activedescendant={active >= 0 ? `nav-sg-${active}` : undefined} autoComplete="off"
      />
      {showList ? (
        <ul className="nav-pop nav-suggest" id="nav-suggest" role="listbox">
          {items.length === 0 ? (
            <li className="nav-suggest__empty muted">{res ? `No matches for "${q.trim()}"` : 'Searching...'}</li>
          ) : items.map((it, i) => (
            <li key={it.key} id={`nav-sg-${i}`} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'is-active' : ''} onMouseEnter={() => setActive(i)} onClick={() => go(it.to)}>
                {it.kind === 'dish' ? (<><VegMark isVeg={it.f.isVeg} /><span className="nav-suggest__main">{it.f.name}<small className="muted"> {it.f.restaurant}</small></span><em>₹{it.f.price}</em></>) : null}
                {it.kind === 'restaurant' ? (<><UtensilsCrossed size={16} aria-hidden="true" /><span className="nav-suggest__main">{it.r.name}<small className="muted"> {(it.r.cuisines || []).slice(0, 2).join(', ')}</small></span><em>Restaurant</em></>) : null}
                {it.kind === 'category' ? (<><ClipboardList size={16} aria-hidden="true" /><span className="nav-suggest__main">{it.c.name}</span><em>Category</em></>) : null}
              </button>
            </li>
          ))}
          {q.trim() ? <li><button type="button" className="nav-suggest__all" onClick={() => go(`/food?q=${encodeURIComponent(q.trim())}`)}>See all results for "{q.trim()}"</button></li> : null}
        </ul>
      ) : null}
    </form>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const userRef = useRef(null);

  useEffect(() => { setMenu(false); setUserOpen(false); }, [pathname]);
  useEffect(() => {
    const close = (e) => { if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const loadUnread = useCallback(async () => {
    if (!user) { setUnread(0); return; }
    try {
      const { data } = await api.get('/orders/notifications');
      setUnread(data.unread || 0);
    } catch (e) { /* bell is non-critical */ }
  }, [user]);
  useEffect(() => { loadUnread(); }, [loadUnread, pathname]);
  useSocketEvent('notification', () => loadUnread());
  useSocketEvent('order:update', () => loadUnread());

  const doLogout = async () => {
    try { await logout(); toast.info('You have been logged out.'); navigate('/'); } catch (e) { toast.error('Could not log out. Try again.'); }
  };
  const isCustomer = !user || user.role === 'customer';
  const dash = user && user.role !== 'customer' ? homeForRole(user.role) : null;

  return (
    <header className="nav">
      <div className="container nav__inner">
        <Link to="/" className="nav__brand" aria-label="FoodieExpress home">
          <span className="nav__logo" aria-hidden="true"><UtensilsCrossed size={20} /></span>
          <span className="nav__name">Foodie<b>Express</b></span>
        </Link>
        <LocationPicker />
        <SearchBox />
        <nav className="nav__links" aria-label="Primary">
          <NavLink to="/restaurants">Restaurants</NavLink>
          <NavLink to="/categories">Categories</NavLink>
        </nav>
        <div className="nav__actions">
          {isCustomer ? (
            <Link to="/cart" className="icon-btn nav__cart" aria-label={`Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}>
              <ShoppingBag size={20} aria-hidden="true" />
              {itemCount > 0 ? <span className="nav__count" aria-hidden="true">{itemCount > 99 ? '99+' : itemCount}</span> : null}
            </Link>
          ) : null}
          {user ? (
            <>
              <Link to="/notifications" className="icon-btn nav__bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
                <Bell size={20} aria-hidden="true" />
                {unread > 0 ? <span className="nav__count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span> : null}
              </Link>
              <div className="nav-user" ref={userRef}>
                <button type="button" className="nav-user__btn" onClick={() => setUserOpen((o) => !o)} aria-haspopup="menu" aria-expanded={userOpen}>
                  <span className="nav-user__avatar" aria-hidden="true">{(user.name || '?').charAt(0).toUpperCase()}</span>
                  <span className="nav-user__name">{(user.name || 'Account').split(' ')[0]}</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                {userOpen ? (
                  <div className="nav-pop nav-user__menu" role="menu">
                    <div className="nav-user__who"><strong>{user.name}</strong><small className="muted">{user.email}</small></div>
                    {dash ? <Link role="menuitem" to={dash}><LayoutDashboard size={16} aria-hidden="true" /> {ROLE_LABEL[user.role]}</Link> : null}
                    <Link role="menuitem" to="/profile"><User size={16} aria-hidden="true" /> My profile</Link>
                    {user.role === 'customer' ? <Link role="menuitem" to="/orders"><ClipboardList size={16} aria-hidden="true" /> My orders</Link> : null}
                    <Link role="menuitem" to="/notifications"><Bell size={16} aria-hidden="true" /> Notifications{unread ? ` (${unread})` : ''}</Link>
                    <button type="button" role="menuitem" onClick={doLogout}><LogOut size={16} aria-hidden="true" /> Log out</button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="nav__auth">
              <Link to="/login" className="btn btn--ghost btn--sm">Log in</Link>
              <Link to="/register" className="btn btn--primary btn--sm">Sign up</Link>
            </div>
          )}
          <button type="button" className="icon-btn nav__burger" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-controls="nav-mobile" aria-label={menu ? 'Close menu' : 'Open menu'}>
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {menu ? (
        <div className="nav-mobile" id="nav-mobile">
          <div className="container nav-mobile__inner">
            <LocationPicker />
            <Link to="/restaurants">Restaurants</Link>
            <Link to="/categories">Categories</Link>
            <Link to="/food">All dishes</Link>
            {isCustomer ? <Link to="/cart">Cart{itemCount ? ` (${itemCount})` : ''}</Link> : null}
            {user ? (
              <>
                {dash ? <Link to={dash}>{ROLE_LABEL[user.role]}</Link> : null}
                <Link to="/profile">My profile</Link>
                {user.role === 'customer' ? <Link to="/orders">My orders</Link> : null}
                <Link to="/notifications">Notifications{unread ? ` (${unread})` : ''}</Link>
                <button type="button" className="btn btn--ghost" onClick={doLogout}>Log out</button>
              </>
            ) : (
              <div className="nav-mobile__auth">
                <Link to="/login" className="btn btn--ghost">Log in</Link>
                <Link to="/register" className="btn btn--primary">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
