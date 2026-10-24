import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, Phone } from 'lucide-react';
import useApi from '../../hooks/useApi';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import EmptyState from '../../components/EmptyState';
import RouteMap from '../../components/RouteMap';
import { ConfirmDialog } from '../../components/Modal';
import { OrderStatusBadge } from '../../components/Badges';
import { simulatedDropoff } from '../../utils/geo';
import { rupee } from '../../utils/format';
import { JobSummary } from './DeliveryParts';
import '../../css/delivery.css';

// next status the partner can trigger from each assignment status
const NEXT = {
  ACCEPTED: { to: 'PICKED_UP', label: 'Mark picked up', help: 'Tap when you have collected the food from the restaurant.' },
  PICKED_UP: { to: 'OUT_FOR_DELIVERY', label: 'Start delivery', help: 'Tap when you leave the restaurant.' },
  OUT_FOR_DELIVERY: { to: 'DELIVERED', label: 'Mark delivered', help: 'Tap after handing the order to the customer.' },
};
const PROGRESS = { ACCEPTED: 0, PICKED_UP: 0.12, OUT_FOR_DELIVERY: 0.6 };
const STEPS = ['ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const STEP_LABEL = { ACCEPTED: 'Accepted', PICKED_UP: 'Picked up', OUT_FOR_DELIVERY: 'On the way', DELIVERED: 'Delivered' };

function Delivery({ a, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [release, setRelease] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const o = a.order;
  const next = NEXT[a.status];
  const restLoc = o && o.pickup.location;
  // Customer coordinates are SIMULATED from the postal code (no geocoder); the map labels this clearly.
  const postal = o ? (o.dropoff.address.match(/\b\d{6}\b/) || [''])[0] : '';
  const drop = o ? (o.dropoff.location && Number.isFinite(o.dropoff.location.lat) ? o.dropoff.location : simulatedDropoff(restLoc, postal)) : null;

  const advance = async () => {
    setBusy(true);
    try {
      await api.patch(`/delivery/assignments/${a.id}/status`, { status: next.to });
      toast.success(next.to === 'DELIVERED' ? 'Delivery completed. Nice work!' : 'Status updated.');
      setConfirmDone(false);
      onChanged();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  const doRelease = async () => {
    setBusy(true);
    try {
      await api.post(`/delivery/assignments/${a.id}/reject`);
      toast.info('Delivery released back to the pool.');
      setRelease(false);
      onChanged();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={o ? `Order ${o.orderNumber}` : 'Delivery'} subtitle={o ? `Order status: ${o.status.replace(/_/g, ' ').toLowerCase()}` : ''} actions={o ? <OrderStatusBadge status={o.status} /> : null}>
      <ol className="dv-steps" aria-label="Delivery progress">
        {STEPS.map((s) => {
          const done = STEPS.indexOf(s) < STEPS.indexOf(a.status);
          return <li key={s} className={`dv-step ${s === a.status ? 'is-current' : ''} ${done ? 'is-done' : ''}`} aria-current={s === a.status ? 'step' : undefined}>{STEP_LABEL[s]}</li>;
        })}
      </ol>
      <JobSummary a={a} />
      {o && o.instructions ? <div className="alert alert--info">Customer note: {o.instructions}</div> : null}
      {o && o.collectCash ? <div className="alert alert--warn">Cash on delivery: collect {rupee(o.collectCash)} from the customer.</div> : null}
      {restLoc && drop ? <RouteMap restaurant={{ lat: restLoc.lat, lng: restLoc.lng, name: o.pickup.name }} dropoff={{ lat: drop.lat, lng: drop.lng, label: 'Delivery address (approximate, simulated)' }} simulatedProgress={PROGRESS[a.status] ?? null} height={260} /> : null}
      {next ? <p className="field__hint dv-help">{next.help}</p> : null}
      <div className="row row--wrap">
        {next ? <button type="button" className="btn btn--primary" disabled={busy} onClick={() => (next.to === 'DELIVERED' ? setConfirmDone(true) : advance())}>{busy ? 'Updating...' : next.label}</button> : null}
        {o && o.dropoff.phone ? <a className="btn btn--ghost" href={`tel:${o.dropoff.phone.replace(/[^\d+]/g, '')}`}><Phone size={16} aria-hidden="true" /> Call customer</a> : null}
        {a.status === 'ACCEPTED' ? <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setRelease(true)}>Release delivery</button> : null}
      </div>
      <ConfirmDialog open={confirmDone} title="Confirm delivery" message={o && o.collectCash ? `Have you collected ${rupee(o.collectCash)} in cash and handed over the order?` : 'Have you handed the order to the customer?'} confirmLabel="Yes, delivered" busy={busy} onCancel={() => setConfirmDone(false)} onConfirm={advance} />
      <ConfirmDialog open={release} title="Release this delivery?" message="It goes back to the available pool for other partners." confirmLabel="Release" danger busy={busy} onCancel={() => setRelease(false)} onConfirm={doRelease} />
    </Panel>
  );
}

export default function DeliveryActive() {
  const { data, loading, error, reload } = useApi('/delivery/assignments', { params: { scope: 'mine', limit: 10 } });
  useSocketEvent('assignment:update', reload);
  useSocketEvent('order:update', reload);
  const list = (data && data.assignments) || [];
  return (
    <>
      <div className="dash-head"><h1>My deliveries</h1><button type="button" className="btn btn--ghost btn--sm" onClick={reload}>Refresh</button></div>
      <DataState loading={loading && !data} error={error} onRetry={reload}>
        {list.length === 0 ? (
          <EmptyState icon={Bike} title="No active deliveries" message="Accept a job to start delivering." action={<Link to="/delivery/available" className="btn btn--primary">Find jobs</Link>} />
        ) : (
          <div className="stack">{list.map((a) => <Delivery key={a.id} a={a} onChanged={reload} />)}</div>
        )}
      </DataState>
    </>
  );
}
