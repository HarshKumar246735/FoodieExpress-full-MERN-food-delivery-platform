import { ChevronLeft, ChevronRight } from 'lucide-react';

/** pagination = { page, pages } as returned by the API. */
export default function Pagination({ page = 1, pages = 1, onChange }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i += 1) nums.push(i);
  return (
    <nav className="pager" aria-label="Pagination">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
      {nums[0] > 1 ? <><button type="button" onClick={() => onChange(1)}>1</button><span className="muted">...</span></> : null}
      {nums.map((n) => (
        <button key={n} type="button" className={n === page ? 'is-active' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>{n}</button>
      ))}
      {nums[nums.length - 1] < pages ? <><span className="muted">...</span><button type="button" onClick={() => onChange(pages)}>{pages}</button></> : null}
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRight size={16} /></button>
    </nav>
  );
}
