export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="empty" role="status">
      {Icon ? <div className="empty__icon"><Icon size={28} /></div> : null}
      <h3>{title}</h3>
      {message ? <p className="muted">{message}</p> : null}
      {action || null}
    </div>
  );
}
