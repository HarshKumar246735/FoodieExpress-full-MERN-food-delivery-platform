import { Star } from 'lucide-react';

export default function Rating({ value = 0, count, size = 14 }) {
  const v = Number(value) || 0;
  return (
    <span className="rating" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }} aria-label={`Rated ${v.toFixed(1)} out of 5`}>
      <Star size={size} fill="#f5a524" color="#f5a524" aria-hidden="true" />
      {v > 0 ? v.toFixed(1) : 'New'}
      {count !== undefined ? <span className="muted" style={{ fontWeight: 400 }}>({count})</span> : null}
    </span>
  );
}

/** Clickable 1-5 star input. */
export function RatingInput({ value, onChange, size = 28 }) {
  return (
    <div role="radiogroup" aria-label="Rating" style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 2 }}>
          <Star size={size} fill={n <= value ? '#f5a524' : 'none'} color="#f5a524" />
        </button>
      ))}
    </div>
  );
}
