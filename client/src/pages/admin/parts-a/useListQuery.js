import { useEffect, useMemo, useRef, useState } from 'react';
import useApi from '../../../hooks/useApi';
import { debounce } from '../../../utils/format';

/**
 * Paged + searchable list state shared by the admin tables.
 * const L = useListQuery('/admin/users', { role: '', status: '' }, 15);
 * L.q / L.setSearch (debounced), L.filters / L.setFilter, L.page / L.setPage, plus useApi's data/loading/error/reload.
 */
export default function useListQuery(url, initialFilters = {}, limit = 15) {
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const commit = useRef(debounce((v) => { setQ(v); setPage(1); }, 350));
  useEffect(() => () => commit.current.cancel(), []);

  const params = useMemo(() => {
    const p = { page, limit };
    if (q) p.q = q;
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }, [page, limit, q, filters]);

  const api = useApi(url, { params });
  return {
    ...api,
    page,
    setPage,
    draft,
    setSearch: (v) => { setDraft(v); commit.current(v); },
    q,
    filters,
    setFilter: (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); },
    clear: () => { setFilters(initialFilters); setDraft(''); setQ(''); setPage(1); },
    hasFilters: Boolean(q) || Object.keys(filters).some((k) => filters[k]),
  };
}
