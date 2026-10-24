import { useCallback, useEffect, useRef, useState } from 'react';
import api, { apiError } from '../services/api';

/**
 * GET helper: const { data, loading, error, reload } = useApi('/food', { params });
 * Pass url = null to skip. Re-fetches when url or the JSON of params changes.
 * Stale responses from an earlier request are ignored.
 */
export default function useApi(url, { params, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: Boolean(url && enabled), error: '' });
  const seq = useRef(0);
  const key = JSON.stringify(params || {});

  const load = useCallback(async () => {
    if (!url || !enabled) return;
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const { data } = await api.get(url, { params: params || undefined });
      if (mine === seq.current) setState({ data, loading: false, error: '' });
    } catch (e) {
      if (mine === seq.current) setState({ data: null, loading: false, error: apiError(e) });
    }
  }, [url, key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
