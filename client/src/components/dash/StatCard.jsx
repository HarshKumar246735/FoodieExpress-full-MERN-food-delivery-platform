/** KPI tile used by every dashboard. `tone` colours the icon chip: brand | green | blue | violet | amber | red. */
export default function StatCard({ icon: Icon, label, value, hint, tone = 'brand' }) {
  return (
    <div className="stat">
      {Icon ? <div className={`stat__icon stat__icon--${tone}`} aria-hidden="true"><Icon size={20} /></div> : null}
      <div className="stat__body">
        <span className="stat__label">{label}</span>
        <strong className="stat__value">{value}</strong>
        {hint ? <span className="stat__hint muted">{hint}</span> : null}
      </div>
    </div>
  );
}
