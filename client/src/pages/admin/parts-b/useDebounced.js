import { useEffect, useState } from 'react';

/** Returns `value` after it has been stable for `ms` milliseconds (for search boxes). */
export default function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
