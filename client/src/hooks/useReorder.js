import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiError } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

/** Reorder a past order: server rebuilds the cart (prices/availability re-checked), then go to /cart. */
export default function useReorder() {
  const { setServerCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const reorder = useCallback(async (orderId) => {
    setBusyId(orderId);
    try {
      const { data } = await api.post(`/orders/${orderId}/reorder`);
      setServerCart(data.cart);
      toast.success(data.message || 'Items added to your cart');
      navigate('/cart');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusyId(null);
    }
  }, [setServerCart, toast, navigate]);
  return { reorder, busyId };
}
