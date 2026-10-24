import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Utensils } from 'lucide-react';
import FilterPanel, { countActive, useParamsPatch } from './FilterPanel';
import FoodCard from './FoodCard';
import Pagination from './Pagination';
import EmptyState from './EmptyState';
import { CardSkeleton } from './Skeleton';
import useApi from '../hooks/useApi';
import '../css/listing.css';

const FILTER_KEYS = ['diet', 'minPrice', 'maxPrice', 'minRating', 'maxPrep', 'discount', 'bestseller', 'open', 'sort'];
const PAGE_SIZE = 20;

/**
 * Shared browsing experience (category page and global search): URL-driven filters, search box,
 * sorting and backend pagination. `fixed` pins API params, e.g. { category: 'pizza' }.
 */
export default function FoodBrowser({ fixed = {}, searchPlaceholder = 'Search dishes, ingredients or restaurants' }) {
  const [sp, patch] = useParamsPatch();
  const [showFilters, setShowFilters] = useState(false);
  const values = useMemo(() => Object.fromEntries(sp.entries()), [sp]);
  const [draft, setDraft] = useState(values.q || '');
  const page = Math.max(1, Number(values.page) || 1);

  const params = useMemo(() => {
    const p = { ...fixed, page, limit: PAGE_SIZE };
    if (values.q) p.q = values.q;
    if (values.diet === 'veg') p.veg = 'true';
    if (values.diet === 'non') p.nonVeg = 'true';
    ['minPrice', 'maxPrice', 'minRating', 'maxPrep', 'sort'].forEach((k) => { if (values[k]) p[k] = values[k]; });
    ['discount', 'bestseller', 'open'].forEach((k) => { if (values[k] === 'true') p[k] = 'true'; });
    return p;
  }, [fixed, page, values]);

  const { data, loading, error, reload } = useApi('/food', { params });
  const active = countActive(values, FILTER_KEYS);
  const clearAll = () => {
    const reset = {};
    [...FILTER_KEYS, 'q', 'page'].forEach((k) => { reset[k] = ''; });
    setDraft('');
    patch(reset);
  };
  const foods = (data && data.foods) || [];
  const pg = (data && data.pagination) || { page: 1, pages: 1, total: 0 };

  return (
    <div className="lst">
      <form className="lst__search" role="search" onSubmit={(e) => { e.preventDefault(); patch({ q: draft.trim() }); }}>
        <Search size={18} aria-hidden="true" />
        <label htmlFor="lst-q" className="sr-only">Search food</label>
        <input id="lst-q" type="search" className="lst__input" placeholder={searchPlaceholder} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="btn btn--primary btn--sm">Search</button>
      </form>

      <div className="lst__layout">
        <aside className={`lst__aside ${showFilters ? 'is-open' : ''}`}>
          <FilterPanel kind="food" values={values} onChange={patch} onClear={clearAll} activeCount={active} />
        </aside>
        <section className="lst__main" aria-live="polite">
          <div className="lst__bar">
            <p className="muted lst__count">{loading ? 'Loading dishes...' : `${pg.total} ${pg.total === 1 ? 'dish' : 'dishes'}${values.q ? ` for "${values.q}"` : ''}`}</p>
            <button type="button" className="btn btn--ghost btn--sm lst__filter-btn" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
              <SlidersHorizontal size={16} aria-hidden="true" /> Filters{active ? ` (${active})` : ''}
            </button>
          </div>

          {error ? (
            <div className="alert alert--error" role="alert">
              {error} <button type="button" className="btn btn--sm btn--ghost" onClick={reload}>Try again</button>
            </div>
          ) : loading && !data ? (
            <CardSkeleton count={8} />
          ) : foods.length === 0 ? (
            <EmptyState icon={Utensils} title="No dishes match" message="Try removing a filter or searching for something else." action={<button type="button" className="btn btn--primary" onClick={clearAll}>Clear search and filters</button>} />
          ) : (
            <>
              <div className={`grid grid--foods ${loading ? 'lst__dim' : ''}`}>
                {foods.map((f) => <FoodCard key={f.id} food={f} />)}
              </div>
              <Pagination page={pg.page} pages={pg.pages} onChange={(n) => { patch({ page: n }, { keepPage: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
