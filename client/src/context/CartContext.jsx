import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { apiCode, apiData, apiError } from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { ConfirmDialog } from '../components/Modal';

/**
 * One cart API for guests and signed-in customers.
 *  - Signed in: the cart lives on the server (persisted in MongoDB, restored after refresh).
 *  - Guest: items live in localStorage and are priced by POST /cart/preview (same server pricing rules).
 * Prices shown here always come from the server response; the browser never computes totals.
 */
const CartContext = createContext(null);
const LS_KEY = 'fx_guest_cart_v1';

const EMPTY = { restaurant: null, items: [], issues: [], itemCount: 0, couponCode: '', pricing: null };

const readGuest = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (raw && Array.isArray(raw.items)) return raw;
  } catch (e) {
    /* ignore */
  }
  return { items: [], couponCode: '' };
};
const writeGuest = (g) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(g));
  } catch (e) {
    /* storage may be unavailable */
  }
};

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [cart, setCart] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [conflict, setConflict] = useState(null); // { food, qty, current, next }
  const guestRef = useRef(readGuest());
  const isCustomer = Boolean(user && user.role === 'customer');

  const loadGuest = useCallback(async () => {
    const g = guestRef.current;
    if (!g.items.length) {
      setCart(EMPTY);
      return EMPTY;
    }
    const { data } = await api.post('/cart/preview', { items: g.items.map((i) => ({ foodId: i.foodId, quantity: i.quantity })), couponCode: g.couponCode || undefined });
    // Drop items the server no longer knows about so the cart can't get stuck.
    const known = new Set(data.cart.items.map((i) => i.food.id));
    const cleaned = g.items.filter((i) => known.has(i.foodId));
    if (cleaned.length !== g.items.length) {
      guestRef.current = { ...g, items: cleaned };
      writeGuest(guestRef.current);
    }
    setCart(data.cart);
    return data.cart;
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (isCustomer) {
        const { data } = await api.get('/cart');
        setCart(data.cart);
        return data.cart;
      }
      if (user) {
        setCart(EMPTY); // owners/admins/partners have no cart
        return EMPTY;
      }
      return await loadGuest();
    } catch (e) {
      return null;
    } finally {
      setLoaded(true);
    }
  }, [isCustomer, user, loadGuest]);

  // (Re)load whenever the signed-in identity changes. On login, merge the guest cart first.
  useEffect(() => {
    if (authLoading) return;
    (async () => {
      if (isCustomer && guestRef.current.items.length) {
        try {
          const { data } = await api.post('/cart/merge', { items: guestRef.current.items, couponCode: guestRef.current.couponCode });
          setCart(data.cart);
          guestRef.current = { items: [], couponCode: '' };
          writeGuest(guestRef.current);
          setLoaded(true);
          return;
        } catch (e) {
          /* fall through to a normal refresh */
        }
      }
      await refresh();
    })();
  }, [authLoading, user && user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback(
    async (fn) => {
      setBusy(true);
      try {
        return await fn();
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const addItem = useCallback(
    async (food, quantity = 1, { replace = false } = {}) => {
      if (user && !isCustomer) {
        toast.info('Ordering is available on customer accounts only.');
        return false;
      }
      try {
        await run(async () => {
          if (isCustomer) {
            const { data } = await api.post('/cart/items', { foodId: food.id, quantity, replace });
            setCart(data.cart);
          } else {
            const g = guestRef.current;
            const sameRestaurant = g.restaurantId ? g.restaurantId === food.restaurant.id : true;
            if (!sameRestaurant && g.items.length && !replace) {
              const err = new Error('conflict');
              err.guestConflict = { current: g.restaurantName || 'another restaurant', next: food.restaurant.name };
              throw err;
            }
            const base = !sameRestaurant ? { items: [], couponCode: '' } : g;
            const existing = base.items.find((i) => i.foodId === food.id);
            const items = existing ? base.items.map((i) => (i.foodId === food.id ? { ...i, quantity: Math.min(20, i.quantity + quantity) } : i)) : [...base.items, { foodId: food.id, quantity }];
            guestRef.current = { ...base, items, restaurantId: food.restaurant.id, restaurantName: food.restaurant.name };
            writeGuest(guestRef.current);
            await loadGuest();
          }
        });
        toast.success(`${food.name} added to cart`);
        return true;
      } catch (e) {
        if (apiCode(e) === 'CART_RESTAURANT_CONFLICT') {
          const d = apiData(e) || {};
          setConflict({ food, quantity, current: d.currentRestaurant, next: d.newRestaurant });
        } else if (e.guestConflict) {
          setConflict({ food, quantity, current: e.guestConflict.current, next: e.guestConflict.next });
        } else {
          toast.error(apiError(e));
        }
        return false;
      }
    },
    [user, isCustomer, run, loadGuest, toast]
  );

  const setQuantity = useCallback(
    async (foodId, quantity) => {
      try {
        await run(async () => {
          if (isCustomer) {
            const { data } = await api.patch(`/cart/items/${foodId}`, { quantity });
            setCart(data.cart);
          } else {
            const g = guestRef.current;
            const items = quantity <= 0 ? g.items.filter((i) => i.foodId !== foodId) : g.items.map((i) => (i.foodId === foodId ? { ...i, quantity } : i));
            guestRef.current = { ...g, items, couponCode: items.length ? g.couponCode : '' };
            writeGuest(guestRef.current);
            await loadGuest();
          }
        });
      } catch (e) {
        toast.error(apiError(e));
      }
    },
    [isCustomer, run, loadGuest, toast]
  );

  const removeItem = useCallback((foodId) => setQuantity(foodId, 0), [setQuantity]);

  const clear = useCallback(async () => {
    try {
      await run(async () => {
        if (isCustomer) {
          const { data } = await api.delete('/cart');
          setCart(data.cart);
        } else {
          guestRef.current = { items: [], couponCode: '' };
          writeGuest(guestRef.current);
          setCart(EMPTY);
        }
      });
    } catch (e) {
      toast.error(apiError(e));
    }
  }, [isCustomer, run, toast]);

  /** Returns { ok, message }. Invalid coupons never change the cart. */
  const applyCoupon = useCallback(
    async (code) => {
      try {
        return await run(async () => {
          if (isCustomer) {
            const { data } = await api.post('/cart/coupon', { code });
            setCart(data.cart);
            return { ok: true, message: data.message };
          }
          const g = guestRef.current;
          const { data } = await api.post('/cart/preview', { items: g.items.map((i) => ({ foodId: i.foodId, quantity: i.quantity })), couponCode: code });
          if (data.cart.pricing.coupon && !data.cart.pricing.coupon.applied) return { ok: false, message: data.cart.pricing.coupon.message };
          guestRef.current = { ...g, couponCode: code.toUpperCase() };
          writeGuest(guestRef.current);
          setCart(data.cart);
          return { ok: true, message: data.cart.pricing.coupon.message };
        });
      } catch (e) {
        return { ok: false, message: apiError(e) };
      }
    },
    [isCustomer, run]
  );

  const removeCoupon = useCallback(async () => {
    try {
      await run(async () => {
        if (isCustomer) {
          const { data } = await api.delete('/cart/coupon');
          setCart(data.cart);
        } else {
          guestRef.current = { ...guestRef.current, couponCode: '' };
          writeGuest(guestRef.current);
          await loadGuest();
        }
      });
    } catch (e) {
      toast.error(apiError(e));
    }
  }, [isCustomer, run, loadGuest, toast]);

  const quantityOf = useCallback((foodId) => (cart.items.find((i) => i.food.id === foodId) || { quantity: 0 }).quantity, [cart]);

  /** Replace the cart with a fresh server cart view (used by reorder). */
  const setServerCart = useCallback((c) => setCart(c), []);

  const value = useMemo(
    () => ({ cart, busy, loaded, addItem, setQuantity, removeItem, clear, applyCoupon, removeCoupon, quantityOf, refresh, setServerCart, itemCount: cart.itemCount || 0 }),
    [cart, busy, loaded, addItem, setQuantity, removeItem, clear, applyCoupon, removeCoupon, quantityOf, refresh, setServerCart]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={Boolean(conflict)}
        title="Start a new cart?"
        message={conflict ? `Your cart has items from ${conflict.current}. Adding ${conflict.food.name} from ${conflict.next} will clear it.` : ''}
        confirmLabel="Clear cart and add"
        cancelLabel="Keep my cart"
        onCancel={() => setConflict(null)}
        onConfirm={async () => {
          const c = conflict;
          setConflict(null);
          await addItem(c.food, c.quantity, { replace: true });
        }}
      />
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
