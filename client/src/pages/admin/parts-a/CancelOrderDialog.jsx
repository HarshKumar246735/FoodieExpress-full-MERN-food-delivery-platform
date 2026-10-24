import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../../components/Modal';
import AuthField from '../../../components/AuthField';
import api, { apiError } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

/** Admin cancellation: confirmation + reason (stored on the order and sent to the customer). */
export default function CancelOrderDialog({ order, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setReason(''); setError(''); }, [order]);

  const go = async () => {
    if (reason.trim().length < 3) { setError('Please enter a reason (at least 3 characters)'); return; }
    setBusy(true);
    try {
      await api.post(`/admin/orders/${order.id}/cancel`, { reason: reason.trim() });
      toast.success(`Order ${order.orderNumber} cancelled`);
      onDone();
      onClose();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <ConfirmDialog open={Boolean(order)} danger busy={busy} title="Cancel this order?" confirmLabel="Cancel order" cancelLabel="Keep order" onCancel={onClose} onConfirm={go}
      message={order ? `Order ${order.orderNumber} will be cancelled. Paid online orders are marked refunded.` : ''}>
      <AuthField as="textarea" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} error={error} maxLength={200} placeholder="Why is this order being cancelled?" />
    </ConfirmDialog>
  );
}
