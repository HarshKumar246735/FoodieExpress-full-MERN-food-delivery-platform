import { rupee } from '../utils/format';

/** Renders the server's pricing object (never computes totals itself). */
export default function PriceBreakdown({ pricing, couponCode }) {
  if (!pricing) return null;
  return (
    <div className="ticket" aria-label="Price breakdown">
      <div className="ticket__row"><span>Subtotal</span><span>{rupee(pricing.subtotal)}</span></div>
      {pricing.discount > 0 ? <div className="ticket__row ticket__row--discount"><span>Discount{couponCode ? ` (${couponCode})` : ''}</span><span>-{rupee(pricing.discount)}</span></div> : null}
      <div className="ticket__row">
        <span>Delivery fee{pricing.freeShipping ? ' (coupon)' : pricing.deliveryWaivedByThreshold ? ' (free over threshold)' : ''}</span>
        <span>{pricing.deliveryFee > 0 ? rupee(pricing.deliveryFee) : 'Free'}</span>
      </div>
      <div className="ticket__row"><span>Taxes</span><span>{rupee(pricing.tax)}</span></div>
      <div className="ticket__row ticket__row--total"><span>To pay</span><span>{rupee(pricing.total)}</span></div>
    </div>
  );
}
