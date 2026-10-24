import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bike, CheckCircle2, Navigation, Wallet } from 'lucide-react';
import useApi from '../../hooks/useApi';
import api, { apiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import StatCard from '../../components/dash/StatCard';
import Panel from '../../components/dash/Panel';
import DataState from '../../components/dash/DataState';
import { rupee } from '../../utils/format';
import '../../css/delivery.css';

export default function DeliveryOverview() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/delivery/dashboard');
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  useSocketEvent('assignment:update', reload);

  const setOnline = async (isOnline) => {
    setBusy(true);
    try {
      await api.patch('/delivery/status', { isOnline });
      toast.success(isOnline ? 'You are online. New jobs will appear.' : 'You are offline.');
      await reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) { toast.error('Location is not supported on this device.'); return; }
    setSharing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.patch('/delivery/location', { lat: pos.coords.latitude, lng: pos.coords.longitude });
          toast.success('Location shared. Customers with an active order can see it for 2 minutes.');
        } catch (e) {
          toast.error(apiError(e));
        } finally {
          setSharing(false);
        }
      },
      (err) => {
        setSharing(false);
        toast.error(err.code === 1 ? 'Location permission was denied. You can still deliver without sharing it.' : 'Could not read your location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const s = data && data.stats;
  const chart = ((data && data.chart) || []).map((d) => ({ ...d, label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }) }));

  return (
    <>
      <div className="dash-head"><h1>Overview</h1></div>
      <DataState loading={loading && !data} error={error} onRetry={reload}>
        {data ? (
          <>
            <Panel>
              <div className="dv-status">
                <div>
                  <h2 className="panel__title">{data.isOnline ? 'You are online' : 'You are offline'}</h2>
                  <p className="muted">{data.isOnline ? 'You can accept new deliveries.' : 'Go online to see and accept available deliveries.'}{data.vehicle ? ` Vehicle: ${data.vehicle}.` : ''}</p>
                </div>
                <div className="row row--wrap">
                  <label className="switch">
                    <input type="checkbox" role="switch" checked={data.isOnline} disabled={busy} onChange={(e) => setOnline(e.target.checked)} />
                    <span className="switch__track" aria-hidden="true" />
                    <span>{data.isOnline ? 'Online' : 'Offline'}</span>
                  </label>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={shareLocation} disabled={sharing}><Navigation size={16} aria-hidden="true" /> {sharing ? 'Locating...' : 'Share my location'}</button>
                </div>
              </div>
            </Panel>

            <div className="stat-grid">
              <StatCard icon={CheckCircle2} tone="green" label="Delivered today" value={s.todayDeliveries} hint={`${s.totalDeliveries} in total`} />
              <StatCard icon={Wallet} tone="brand" label="Earned today" value={rupee(s.todayEarnings)} hint={`${rupee(s.earningPerDelivery)} per delivery`} />
              <StatCard icon={Wallet} tone="violet" label="Total earnings" value={rupee(s.totalEarnings)} />
              <StatCard icon={Bike} tone="blue" label="Active deliveries" value={s.activeDeliveries} hint={<Link to="/delivery/active">View</Link>} />
            </div>

            <Panel title="Last 7 days" subtitle="Completed deliveries and earnings per day">
              <div className="chart-box" role="img" aria-label="Chart of deliveries and earnings for the last seven days">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e2da" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="d" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="e" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v, n) => (n === 'Earnings' ? rupee(v) : v)} />
                    <Legend />
                    <Bar yAxisId="d" dataKey="deliveries" name="Deliveries" fill="#ff6a1a" radius={[6, 6, 0, 0]} />
                    <Line yAxisId="e" dataKey="earnings" name="Earnings" stroke="#201c19" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </>
        ) : null}
      </DataState>
    </>
  );
}
