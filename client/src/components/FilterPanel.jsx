import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../css/filters.css';

/** URL-backed query state. patch({ key: value }) sets/removes keys and resets the page unless told otherwise. */
export function useParamsPatch() {
  const [params, setParams] = useSearchParams();
  const patch = useCallback(
    (changes, { keepPage = false } = {}) => {
      const next = new URLSearchParams(params);
      Object.entries(changes).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '' || v === false) next.delete(k);
        else next.set(k, String(v));
      });
      if (!keepPage && !('page' in changes)) next.delete('page');
      setParams(next);
    },
    [params, setParams]
  );
  return [params, patch];
}

const FOOD_SORTS = [
  ['popularity', 'Popularity'],
  ['rating', 'Rating'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['newest', 'Newest'],
];
const RESTAURANT_SORTS = [
  ['rating', 'Rating'],
  ['delivery_time', 'Delivery time'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['popularity', 'Most reviewed'],
  ['newest', 'Newest'],
];
const RATINGS = [['', 'Any'], ['3', '3+'], ['4', '4+'], ['4.5', '4.5+']];
const PREPS = [['', 'Any'], ['20', 'Up to 20 min'], ['30', 'Up to 30 min'], ['45', 'Up to 45 min']];

function ChipGroup({ legend, options, value, onChange }) {
  return (
    <fieldset className="flt__group">
      <legend>{legend}</legend>
      <div className="flt__chips">
        {options.map(([v, label]) => (
          <button key={v || 'any'} type="button" className={`chip ${String(value || '') === v ? 'is-active' : ''}`} aria-pressed={String(value || '') === v} onClick={() => onChange(v)}>{label}</button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ id, label, checked, onChange }) {
  return (
    <label className="check flt__toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/**
 * kind: 'food' | 'restaurant'. values: plain object of the current URL params. onChange(patch) updates the URL.
 */
export default function FilterPanel({ kind = 'food', values, onChange, onClear, cuisines = [], activeCount = 0 }) {
  const [minPrice, setMinPrice] = useState(values.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(values.maxPrice || '');
  useEffect(() => { setMinPrice(values.minPrice || ''); setMaxPrice(values.maxPrice || ''); }, [values.minPrice, values.maxPrice]);

  const commitPrice = () => {
    const lo = minPrice === '' ? '' : Math.max(0, Number(minPrice) || 0);
    const hi = maxPrice === '' ? '' : Math.max(0, Number(maxPrice) || 0);
    if (lo !== '' && hi !== '' && lo > hi) onChange({ minPrice: hi, maxPrice: lo });
    else onChange({ minPrice: lo, maxPrice: hi });
  };
  const sorts = kind === 'food' ? FOOD_SORTS : RESTAURANT_SORTS;
  const defaultSort = kind === 'food' ? 'popularity' : 'rating';

  return (
    <form className="flt" onSubmit={(e) => { e.preventDefault(); commitPrice(); }} aria-label="Filters">
      <div className="flt__head">
        <h2 className="flt__title">Filters</h2>
        {activeCount > 0 ? <button type="button" className="flt__clear" onClick={onClear}>Clear all ({activeCount})</button> : null}
      </div>

      <div className="flt__group">
        <label htmlFor="flt-sort" className="flt__legend">Sort by</label>
        <select id="flt-sort" className="select" value={values.sort || defaultSort} onChange={(e) => onChange({ sort: e.target.value === defaultSort ? '' : e.target.value })}>
          {sorts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {kind === 'food' ? (
        <ChipGroup legend="Diet" value={values.diet || ''} onChange={(v) => onChange({ diet: v })} options={[['', 'All'], ['veg', 'Veg'], ['non', 'Non-veg']]} />
      ) : (
        <div className="flt__group">
          <label htmlFor="flt-cuisine" className="flt__legend">Cuisine</label>
          <select id="flt-cuisine" className="select" value={values.cuisine || ''} onChange={(e) => onChange({ cuisine: e.target.value })}>
            <option value="">All cuisines</option>
            {cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {kind === 'food' ? (
        <fieldset className="flt__group">
          <legend>Price (₹)</legend>
          <div className="flt__price">
            <input type="number" min="0" inputMode="numeric" className="input" placeholder="Min" aria-label="Minimum price" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} onBlur={commitPrice} />
            <span aria-hidden="true">to</span>
            <input type="number" min="0" inputMode="numeric" className="input" placeholder="Max" aria-label="Maximum price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} onBlur={commitPrice} />
          </div>
        </fieldset>
      ) : null}

      <ChipGroup legend="Minimum rating" value={values.minRating || ''} onChange={(v) => onChange({ minRating: v })} options={RATINGS} />
      <ChipGroup legend={kind === 'food' ? 'Preparation time' : 'Delivery time'} value={values.maxPrep || ''} onChange={(v) => onChange({ maxPrep: v })} options={PREPS} />

      <div className="flt__group flt__toggles">
        {kind === 'food' ? (
          <>
            <Toggle id="flt-discount" label="Discounted items" checked={values.discount === 'true'} onChange={(c) => onChange({ discount: c ? 'true' : '' })} />
            <Toggle id="flt-best" label="Bestsellers only" checked={values.bestseller === 'true'} onChange={(c) => onChange({ bestseller: c ? 'true' : '' })} />
          </>
        ) : null}
        <Toggle id="flt-open" label={kind === 'food' ? 'From restaurants open now' : 'Open now'} checked={values.open === 'true'} onChange={(c) => onChange({ open: c ? 'true' : '' })} />
      </div>
    </form>
  );
}

/** Number of non-default filters in the URL (used for the "Clear all" link and the mobile filter badge). */
export const countActive = (values, keys) => keys.filter((k) => values[k]).length;
