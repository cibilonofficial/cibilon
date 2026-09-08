import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import type { PayoutRateCardEntry } from '@/types';

export function usePayoutRateCard() {
  const [entries, setEntries] = useState<PayoutRateCardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<{ data: Array<Omit<PayoutRateCardEntry, 'percentageRate'> & { percentageRate: string | null }> }>('/payout-rate-card');
      setEntries(response.data.map((entry) => ({ ...entry, percentageRate: entry.percentageRate == null ? null : Number(entry.percentageRate) })));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { entries, loading, refresh };
}
