import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';

interface Comparison { current: number; previous: number; percent: number | null }
interface Comparisons {
  leads: Comparison;
  approved: Comparison;
  completed: Comparison;
  rejected: Comparison;
  paid: Comparison;
}

export function comparisonProps(value?: Comparison) {
  if (!value) return { footnote: 'Monthly comparison unavailable' };
  const counts = `${value.current} this month · ${value.previous} last month (IST)`;
  return { delta: value.percent ?? undefined, footnote: counts, deltaLabel: counts };
}

export function useMonthlyComparisons() {
  const { applications, payouts } = useData();
  const { user } = useAuth();
  const [data, setData] = useState<Comparisons>();
  useEffect(() => {
    let cancelled = false;
    let request = 0;
    setData(undefined);
    const refresh = async () => {
      const version = ++request;
      try {
        const response = await apiRequest<{ data: Comparisons }>('/reports/monthly-comparisons');
        if (!cancelled && version === request) setData(response.data);
      } catch {
        if (!cancelled && version === request) setData(undefined);
      }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [applications, payouts, user?.id]);
  return data;
}
