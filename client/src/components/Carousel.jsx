import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '../css/home.css';

/** Horizontal scroll-snap row with working prev/next buttons (hidden when everything fits). */
export default function Carousel({ children, label, itemWidth = 270 }) {
  const ref = useRef(null);
  const [can, setCan] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCan({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return undefined;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', update);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', update); };
  }, [update, children]);
  const scroll = (dir) => ref.current && ref.current.scrollBy({ left: dir * Math.max(240, ref.current.clientWidth * 0.8), behavior: 'smooth' });
  return (
    <div className="car" role="region" aria-label={label}>
      {can.left ? <button type="button" className="car__btn car__btn--l" onClick={() => scroll(-1)} aria-label={`Scroll ${label} left`}><ChevronLeft size={20} /></button> : null}
      <div className="car__track" ref={ref} onScroll={update} style={{ '--car-item': `${itemWidth}px` }} tabIndex={0}>
        {Array.isArray(children) ? children.map((c, i) => <div className="car__item" key={(c && c.key) || i}>{c}</div>) : <div className="car__item">{children}</div>}
      </div>
      {can.right ? <button type="button" className="car__btn car__btn--r" onClick={() => scroll(1)} aria-label={`Scroll ${label} right`}><ChevronRight size={20} /></button> : null}
    </div>
  );
}
