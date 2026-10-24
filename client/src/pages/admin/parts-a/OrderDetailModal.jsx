import { Modal } from '../../../components/Modal';
import { OrderStatusBadge, PaymentStatusBadge, VegMark } from '../../../components/Badges';
import { formatAddress, formatDateTime, PAYMENT_METHOD, rupee } from '../../../utils/format';

/** Read-only order detail for admins: items, address, payment, status history. */
export default function OrderDetailModal({ order, onClose, onCancel, canCancel }) {
  const o = order;
  const restaurant = o && (typeof o.restaurant === 'object' ? o.restaurant.name : (o.restaurantSnapshot && o.restaurantSnapshot.name) || '');
  return (
    <Modal open={Boolean(o)} size="lg" title={o ? `Order ${o.orderNumber}` : 'Order'} onClose={onClose} footer={<>
      {canCancel ? <button type="button" className="btn btn--danger" onClick={onCancel}>Cancel order</button> : null}
      <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
    </>}>
      {o ? (
        <div className="adm-detail">
          <div className="row row--wrap">
            <OrderStatusBadge status={o.status} />
            <PaymentStatusBadge status={o.paymentStatus} />
            <span className="muted">{PAYMENT_METHOD[o.paymentMethod] || o.paymentMethod}</span>
            <span className="muted">Placed {formatDateTime(o.createdAt)}</span>
          </div>
          <dl className="kv">
            <dt>Restaurant</dt><dd>{restaurant || '-'}</dd>
            <dt>Customer</dt><dd>{typeof o.customer === 'object' ? o.customer.name : '-'}</dd>
            <dt>Deliver to</dt><dd>{o.address ? <>{o.address.fullName}, {o.address.phone}<br />{formatAddress(o.address)}</> : '-'}</dd>
            {o.instructions ? <><dt>Instructions</dt><dd>{o.instructions}</dd></> : null}
            <dt>Partner</dt><dd>{o.deliveryPartner ? `${o.deliveryPartner.name}${o.deliveryPartner.vehicle ? ` (${o.deliveryPartner.vehicle})` : ''}` : 'Not assigned'}</dd>
            {o.cancelReason ? <><dt>Cancel reason</dt><dd>{o.cancelReason}</dd></> : null}
            {o.rejectionReason ? <><dt>Rejection reason</dt><dd>{o.rejectionReason}</dd></> : null}
          </dl>

          <h4 className="adm-h4">Items</h4>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={`${i.food}-${i.name}`}><td><span className="row"><VegMark isVeg={i.isVeg} /> {i.name}</span></td><td>{i.quantity}</td><td>{rupee(i.unitPrice)}</td><td>{rupee(i.lineTotal)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ticket adm-ticket">
            <div className="ticket__row"><span>Subtotal</span><span>{rupee(o.pricing.subtotal)}</span></div>
            {o.pricing.discount > 0 ? <div className="ticket__row ticket__row--discount"><span>Discount{o.coupon && o.coupon.code ? ` (${o.coupon.code})` : ''}</span><span>-{rupee(o.pricing.discount)}</span></div> : null}
            <div className="ticket__row"><span>Delivery</span><span>{o.pricing.deliveryFee ? rupee(o.pricing.deliveryFee) : 'Free'}</span></div>
            <div className="ticket__row"><span>Tax</span><span>{rupee(o.pricing.tax)}</span></div>
            <div className="ticket__row ticket__row--total"><span>Total</span><span>{rupee(o.pricing.total)}</span></div>
          </div>

          <h4 className="adm-h4">Status history</h4>
          <ol className="adm-history">
            {(o.statusHistory || []).map((h, i) => (
              <li key={`${h.status}-${i}`}><OrderStatusBadge status={h.status} /> <span className="muted">{formatDateTime(h.at)}{h.note ? ` - ${h.note}` : ''}</span></li>
            ))}
          </ol>
        </div>
      ) : null}
    </Modal>
  );
}
