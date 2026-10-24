import { Check, X } from 'lucide-react';
import { formatDateTime } from '../utils/format';

/**
 * Progress timeline. `timeline` = server TIMELINE ([{key,label,statuses}]), `history` = order.statusHistory.
 * Timestamps come from the history entries. Cancelled/rejected orders show a final failed step.
 */
export default function OrderTimeline({ timeline, history, status }) {
  const at = (statuses) => {
    const h = [...history].reverse().find((x) => statuses.includes(x.status));
    return h ? h.at : null;
  };
  const failed = status === 'CANCELLED' || status === 'REJECTED';
  const currentIdx = timeline.findIndex((s) => s.statuses.includes(status));
  const reached = (idx) => (failed ? Boolean(at(timeline[idx].statuses)) : currentIdx >= idx);
  return (
    <ol className="tl" aria-label="Order progress">
      {timeline.map((s, idx) => {
        const done = reached(idx);
        const current = !failed && idx === currentIdx;
        return (
          <li key={s.key} className={`tl__step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`} aria-current={current ? 'step' : undefined}>
            <span className="tl__dot" aria-hidden="true">{done ? <Check size={14} /> : null}</span>
            <div><strong>{s.label}</strong><small className="muted">{done ? formatDateTime(at(s.statuses)) : 'Pending'}</small></div>
          </li>
        );
      })}
      {failed ? (
        <li className="tl__step is-done is-failed">
          <span className="tl__dot" aria-hidden="true"><X size={14} /></span>
          <div><strong>{status === 'REJECTED' ? 'Rejected by restaurant' : 'Order cancelled'}</strong><small className="muted">{formatDateTime(at([status]))}</small></div>
        </li>
      ) : null}
    </ol>
  );
}
