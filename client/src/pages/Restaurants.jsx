import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Store } from 'lucide-react';
import useApi from '../hooks/useApi';
import FilterPanel, { countActive, useParamsPatch } from '../components/FilterPanel';
import RestaurantCard from '../components/RestaurantCard';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/Skeleton';
import '../css/listing.css';

const KEYS = ['cuisine', 'minRating', 'maxPrep', 'maxFee', 'maxPriceForTwo', 'open', 'sort'];

export default function Restaurants() {
  const [sp, patch] = useParamsPatch();
  const values = useMemo(() => Object.fromEntries(sp.entries()), [sp]);
  const [draft, setDraft] = useState(values.q || '');
  const [showFilters, setShowFilters] = useState(false);
  const page = Math.max(1, Number(values.page) || 1);
  const params = useMemo(() => {
    const p = { page, limit: 12 };
    if (values.q) p.q = values.q;
    KEYS.forEach((k) => { if (values[k]) p[k] = values[k]; });
    return p;
  }, [values, page]);
  const { data, loading, error, reload } = useApi('/restaurants', { params });
  const cuisines = useApi('/cuisines');
  const active = countActive(values, KEYS);
  const clearAll = () => { const r = {}; [...KEYS, 'q', 'page'].forEach((k) => { r[k] = ''; }); setDraft(''); patch(r); };
  const list = (data && data.restaurants) || [];
  const pg = (data && data.pagination) || { page: 1, pages: 1, total: 0 };

  return (
    <div className="container page">
      <div className="page-head"><h1>Restaurants</h1><p className="muted">Search by name or cuisine, then filter by rating, delivery time and more.</p></div>
      <div className="lst">
        <form className="lst__search" role="search" onSubmit={(e) => { e.preventDefault(); patch({ q: draft.trim() }); }}>
          <Search size={18} aria-hidden="true" />
          <label htmlFor="rs-q" className="sr-only">Search restaurants</label>
          <input id="rs-q" type="search" className="lst__input" placeholder="Search restaurants or cuisines" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit" className="btn btn--primary btn--sm">Search</button>
        </form>
        <div className="lst__layout">
          <aside className={`lst__aside ${showFilters ? 'is-open' : ''}`}>
            <FilterPanel kind="restaurant" values={values} onChange={patch} onClear={clearAll} cuisines={(cuisines.data && cuisines.data.cuisines) || []} activeCount={active} />
          </aside>
          <section className="lst__main" aria-live="polite">
            <div className="lst__bar">
              <p className="muted lst__count">{loading ? 'Loading restaurants...' : `${pg.total} restaurant${pg.total === 1 ? '' : 's'}`}</p>
              <button type="button" className="btn btn--ghost btn--sm lst__filter-btn" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}><SlidersHorizontal size={16} aria-hidden="true" /> Filters{active ? ` (${active})` : ''}</button>
            </div>
            {error ? (
              <div className="alert alert--error" role="alert">{error} <button type="button" className="btn btn--sm btn--ghost" onClick={reload}>Try again</button></div>
            ) : loading && !data ? <CardSkeleton count={6} kind="restaurant" /> : list.length === 0 ? (
              <EmptyState icon={Store} title="No restaurants match" message="Try removing a filter or searching for another cuisine." action={<button type="button" className="btn btn--primary" onClick={clearAll}>Clear search and filters</button>} />
            ) : (
              <>
                <div className={`grid grid--restaurants ${loading ? 'lst__dim' : ''}`}>{list.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}</div>
                <Pagination page={pg.page} pages={pg.pages} onChange={(n) => { patch({ page: n }, { keepPage: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
