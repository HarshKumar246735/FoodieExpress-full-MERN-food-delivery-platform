export function Skeleton({ h = 16, w = '100%', radius, className = '', style }) {
  return <div className={`skeleton ${className}`} style={{ height: h, width: w, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function CardSkeleton({ count = 8, kind = 'food' }) {
  return (
    <div className={`grid ${kind === 'food' ? 'grid--foods' : 'grid--restaurants'}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card card--flat" style={{ padding: 0, overflow: 'hidden' }}>
          <Skeleton h={kind === 'food' ? 170 : 150} radius="0" />
          <div style={{ padding: 14, display: 'grid', gap: 10 }}>
            <Skeleton h={18} w="70%" />
            <Skeleton h={14} w="45%" />
            <Skeleton h={34} w="100%" radius="999px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="center-block" role="status" aria-label="Loading">
      <span className="spinner" />
    </div>
  );
}
