import { useEffect, useState } from 'react';

/**
 * Stands in for the pending state of a data fetch so the skeletons are
 * exercised. Drop this in favour of the real query's `isLoading` later.
 */
export function useMockLoading(ms = 550): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return loading;
}
