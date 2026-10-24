import { ORDER_STATUS, PAYMENT_STATUS } from '../utils/format';

export const VegMark = ({ isVeg }) => <span className={`veg-mark ${isVeg ? '' : 'veg-mark--non'}`} title={isVeg ? 'Vegetarian' : 'Non-vegetarian'} role="img" aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'} />;

export const Badge = ({ tone = '', children }) => <span className={`badge ${tone ? `badge--${tone}` : ''}`}>{children}</span>;

const TONE = { amber: 'amber', blue: 'blue', violet: 'violet', green: 'green', red: 'red' };
export const OrderStatusBadge = ({ status }) => {
  const s = ORDER_STATUS[status] || { label: status, tone: '' };
  return <Badge tone={TONE[s.tone]}>{s.label}</Badge>;
};
export const PaymentStatusBadge = ({ status }) => {
  const s = PAYMENT_STATUS[status] || { label: status, tone: '' };
  return <Badge tone={TONE[s.tone]}>{s.label}</Badge>;
};
